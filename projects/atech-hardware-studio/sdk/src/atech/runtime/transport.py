"""Transport layer: SerialTransport (real hardware), MockTransport (tests).

Handles the wire-format envelope expected by the firmware-side ``AtechSerial``
class. User-facing :class:`Event` / :class:`Action` stay clean; envelope
translation lives here.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
from dataclasses import dataclass
from typing import Any, Optional, Protocol

import serial
from serial.tools import list_ports

from atech.runtime.models import Action, Event

logger = logging.getLogger(__name__)

# USB Vendor IDs commonly seen on Atech / ESP32-S3 boards.
# Espressif's official VID; SiLabs CP210x and QinHeng CH34x cover most
# third-party USB-UART bridges that show up on dev boards.
_ATECH_USB_VIDS: set[int] = {
    0x303A,  # Espressif (native USB-CDC on ESP32-S3)
    0x10C4,  # Silicon Labs CP210x
    0x1A86,  # QinHeng CH340/CH341
    0x0403,  # FTDI
}


@dataclass
class SerialPortInfo:
    """A discovered serial port that may host an Atech board."""

    device: str
    description: str
    vid: Optional[int]
    pid: Optional[int]
    serial_number: Optional[str]

    def __str__(self) -> str:
        vid = f"{self.vid:#06x}" if self.vid is not None else "?"
        pid = f"{self.pid:#06x}" if self.pid is not None else "?"
        return f"{self.device}\t{self.description}\tvid={vid} pid={pid}"


class PortUnavailableError(RuntimeError):
    """The serial port exists but could not be opened (in use, or no permission)."""


def _explain_open_failure(port: str, exc: Exception) -> str:
    text = str(exc)
    low = text.lower()
    if "exclusively lock" in low or "resource busy" in low or "access is denied" in low or "errno 16" in low:
        return (
            f"{port} is in use by another program. Only one program can talk to the board "
            "at a time: stop the other one (an `atech monitor` in another terminal? a serial "
            "monitor in your editor?), or run `atech free-port`. To listen and send together, "
            "do both in one Python script with board.events() and board.call()."
        )
    if "permission denied" in low or "errno 13" in low:
        return (
            f"no permission to open {port}. On Linux, add yourself to the serial group and log "
            "in again:  sudo usermod -aG dialout $USER   (the group is `uucp` on Arch)."
        )
    return f"could not open {port}: {text}"


class Transport(Protocol):
    """Send actions to a board, receive events from a board."""

    def send(self, action: Action) -> None: ...
    def recv(self, timeout: Optional[float] = None) -> Optional[Event]: ...
    def latest(self, key: str) -> Optional[Event]: ...
    def wait_ack(self, key: str, timeout: float) -> Optional[dict]: ...
    def boot_report(self, *, reset: bool = True, timeout: float = 5.0) -> Optional[dict]: ...
    def close(self) -> None: ...


# Device-name hints for board-like ports across OSes (used when the USB VID is
# unavailable, e.g. some Linux/mac setups). Linux: ttyACM*/ttyUSB*; macOS:
# cu.usbmodem*/cu.usbserial*/cu.SLAB*/cu.wchusbserial*; Windows: COM* with a USB VID.
_PORT_NAME_HINTS = (
    "ttyacm", "ttyusb", "usbmodem", "usbserial", "slab", "wchusbserial",
)


def _board_score(info: "SerialPortInfo") -> int:
    """Higher = more likely an Atech board. 0 = unlikely (e.g. /dev/ttyS* COM-on-motherboard)."""
    if info.vid in _ATECH_USB_VIDS:
        return 2
    name = (info.device or "").lower()
    if "bluetooth" in name or "debug-console" in name:
        return 0
    if name.replace("/dev/", "").startswith("com"):  # Windows COM3, etc.
        # A board is a USB device, so Windows reports a VID for it. COM ports
        # without one are the built-in port or a Bluetooth link.
        return 1 if info.vid is not None else 0
    if any(h in name for h in _PORT_NAME_HINTS):
        return 1
    return 0


def all_ports() -> list[SerialPortInfo]:
    """Every serial port on this machine, board or not."""
    return [
        SerialPortInfo(
            device=p.device,
            description=p.description or "",
            vid=p.vid,
            pid=p.pid,
            serial_number=p.serial_number,
        )
        for p in list_ports.comports()
    ]


def discover_ports() -> list[SerialPortInfo]:
    """Return serial ports that look like Atech boards, most-likely first.

    Ranks by USB VID (Espressif / common UART bridges) then by device-name
    pattern, so it works on Linux (ttyACM/ttyUSB), macOS (cu.usbmodem/usbserial)
    and Windows (USB COM*). Ports that do not look like a board (Bluetooth, debug
    consoles, Linux ``/dev/ttyS*``, built-in Windows COM ports) are never returned: with no board plugged in
    the result is empty, so nothing is ever "sent" to the wrong device. Use
    :func:`all_ports` to see everything and pass ``port=`` explicitly.
    """
    return sorted(
        (p for p in all_ports() if _board_score(p) > 0),
        key=_board_score,
        reverse=True,
    )


def free_port(device: str) -> list[str]:
    """Best-effort: kill any process holding ``device`` so it can be opened.

    Uses ``fuser``/``lsof`` on Linux & macOS. On Windows (or if neither tool is
    present) this is a no-op — pyserial releases the handle on close there.
    Returns a list of human-readable descriptions of what was killed.
    """
    import shutil as _shutil
    import subprocess as _sp

    killed: list[str] = []
    if _shutil.which("fuser"):
        try:
            # fuser prints PIDs to stdout; diagnostics ("No such file") go to stderr.
            r = _sp.run(["fuser", "-k", device], capture_output=True, text=True, timeout=5)
            pids = [tok for tok in r.stdout.split() if tok.isdigit()]
            if pids:
                killed.append(f"killed pid(s) {' '.join(pids)}")
        except Exception:
            logger.debug("fuser failed on %s", device, exc_info=True)
    elif _shutil.which("lsof"):
        try:
            r = _sp.run(["lsof", "-t", device], capture_output=True, text=True, timeout=5)
            for pid in r.stdout.split():
                if not pid.isdigit():
                    continue
                _sp.run(["kill", "-9", pid], capture_output=True, timeout=5)
                killed.append(f"killed pid {pid}")
        except Exception:
            logger.debug("lsof/kill failed on %s", device, exc_info=True)
    return killed


# --------------------------------------------------------------- envelope


def _wire_value_for_action(value: Any) -> str:
    """Stringify an action value for the firmware (which reads value as char*)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value, separators=(",", ":"))
    return json.dumps(value)


def encode_action(action: Action) -> bytes:
    """Serialize an :class:`Action` into the firmware's wire envelope."""
    envelope: dict[str, Any] = {
        "action": action.key,
        "value": _wire_value_for_action(action.value),
    }
    if action.module_type:
        envelope["module_type"] = action.module_type
    return (json.dumps(envelope, separators=(",", ":")) + "\n").encode("utf-8")


def decode_event(line: str) -> Optional[Event]:
    """Parse one inbound wire line into an :class:`Event`, or None if not an event.

    The firmware shares stdout with module logs; non-JSON lines (and JSON that
    isn't an event envelope) are silently ignored.
    """
    text = line.strip()
    if not text or not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if data.get("type") != "event":
        return None
    payload = data.get("payload")
    if not isinstance(payload, dict):
        return None
    event_type = payload.get("event_type")
    key = payload.get("key", "")
    if not event_type or not isinstance(key, str):
        return None
    try:
        return Event(
            type=event_type,
            key=key,
            value=payload.get("value"),
            module_type=payload.get("source") or None,
            received_at=time.time(),
        )
    except Exception as exc:
        logger.debug("ignoring malformed event payload %r: %s", text[:120], exc)
        return None


def decode_boot(line: str) -> Optional[dict]:
    """Parse a boot-diagnostics line into its payload dict, or None.

    Wire shape (emitted once at the end of the firmware's ``setup()``):
      {"type":"boot","payload":{"reset_reason":"POWERON","free_heap":N,
        "modules":[{"instance":"th","module":"aht20","ok":true,"detectable":true}]}}
    """
    text = line.strip()
    if not text or not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if data.get("type") != "boot":
        return None
    payload = data.get("payload")
    return payload if isinstance(payload, dict) else None


def decode_ack(line: str) -> Optional[dict]:
    """Parse an action acknowledgement into its payload dict, or None.

    Wire shape (one per action the firmware received):
      {"type":"ack","payload":{"action":"led_fill","ok":true}}
      {"type":"ack","payload":{"action":"nope","ok":false,"error":"unknown action"}}
    """
    text = line.strip()
    if not text or not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if data.get("type") != "ack":
        return None
    payload = data.get("payload")
    if not isinstance(payload, dict) or not isinstance(payload.get("action"), str):
        return None
    return payload


class _AckBox:
    """Acknowledgements received so far, waitable by action key."""

    def __init__(self) -> None:
        self._acks: list[dict] = []
        self._cond = threading.Condition()

    def put(self, payload: dict) -> None:
        with self._cond:
            self._acks.append(payload)
            del self._acks[:-64]
            self._cond.notify_all()

    def clear(self, key: str) -> None:
        with self._cond:
            self._acks = [a for a in self._acks if a.get("action") != key]

    def wait(self, key: str, timeout: float) -> Optional[dict]:
        deadline = time.monotonic() + timeout
        with self._cond:
            while True:
                for i, a in enumerate(self._acks):
                    if a.get("action") == key:
                        return self._acks.pop(i)
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None
                self._cond.wait(remaining)


class _Inbox:
    """What a transport received from the firmware: events, the boot report, acknowledgements.

    Feed it one line at a time with :meth:`_handle_line`.
    """

    def __init__(self) -> None:
        self._rx: queue.Queue[Event] = queue.Queue()
        self._latest: dict[str, Event] = {}
        self._latest_lock = threading.Lock()
        self._boot: Optional[dict] = None
        self._boot_event = threading.Event()
        self._acks = _AckBox()

    def _handle_line(self, raw: bytes) -> None:
        text = raw.decode("utf-8", errors="replace")
        boot = decode_boot(text)
        if boot is not None:
            self._boot = boot
            self._boot_event.set()
            return
        ack = decode_ack(text)
        if ack is not None:
            self._acks.put(ack)
            return
        event = decode_event(text)
        if event is None:
            return
        with self._latest_lock:
            self._latest[event.key] = event
        self._rx.put(event)

    def wait_ack(self, key: str, timeout: float) -> Optional[dict]:
        """The firmware's answer to the last ``key`` action, or None if none came in time."""
        return self._acks.wait(key, timeout)

    def recv(self, timeout: Optional[float] = None) -> Optional[Event]:
        try:
            return self._rx.get(timeout=timeout)
        except queue.Empty:
            return None

    def latest(self, key: str) -> Optional[Event]:
        with self._latest_lock:
            return self._latest.get(key)


# --------------------------------------------------------------- transports


class SerialTransport(_Inbox):
    """Line-delimited JSON over USB serial, with a background reader thread."""

    def __init__(
        self,
        port: str,
        baud: int = 115200,
        read_timeout: float = 0.2,
        write_timeout: float = 1.0,
    ) -> None:
        try:
            # exclusive: two programs reading one port each get half the bytes, so
            # acknowledgements and events go missing at random. Refuse instead.
            self._serial = serial.Serial(
                port=port,
                baudrate=baud,
                timeout=read_timeout,
                write_timeout=write_timeout,
                exclusive=True,
            )
        except serial.SerialException as exc:
            raise PortUnavailableError(_explain_open_failure(port, exc)) from None
        super().__init__()
        self._stop = threading.Event()
        self._reader = threading.Thread(
            target=self._read_loop,
            name=f"atech-serial-reader-{port}",
            daemon=True,
        )
        self._reader.start()

    def _read_loop(self) -> None:
        buf = bytearray()
        while not self._stop.is_set():
            try:
                # read(256) would wait the full timeout for 256 bytes, delaying every
                # event and acknowledgement by ~200 ms. Take one byte as soon as it is
                # there, then whatever else has already arrived.
                chunk = self._serial.read(1)
                if chunk:
                    waiting = self._serial.in_waiting
                    if waiting:
                        chunk += self._serial.read(waiting)
            except (serial.SerialException, OSError, TypeError, ValueError):
                # Port closed underneath us (close() race), or the board dropped off
                # USB: a reset re-enumerates the ESP32-S3's native USB port, and the
                # old handle is dead from then on. Reopen it instead of reading a
                # dead handle forever.
                if self._stop.is_set():
                    break
                logger.debug("serial read failed; reopening the port", exc_info=True)
                self._reopen()
                continue
            except Exception:
                if self._stop.is_set():
                    break
                logger.exception("unexpected serial read error")
                time.sleep(0.2)
                continue

            if not chunk:
                continue
            buf.extend(chunk)
            while True:
                nl = buf.find(b"\n")
                if nl < 0:
                    break
                line = bytes(buf[:nl])
                del buf[: nl + 1]
                self._handle_line(line)

    def _reopen(self) -> None:
        """Wait for the port to come back and open it again (quietly)."""
        try:
            self._serial.close()
        except Exception:
            pass
        while not self._stop.is_set():
            time.sleep(0.25)
            try:
                self._serial.open()
                return
            except (serial.SerialException, OSError):
                continue

    def reset(self) -> None:
        """Pulse DTR/RTS to hard-reset the ESP32 so it re-runs setup() (and
        re-emits its boot report). Best-effort; no-op if the port lacks the lines."""
        try:
            self._serial.setDTR(False)
            self._serial.setRTS(True)
            time.sleep(0.1)
            self._serial.setRTS(False)
        except Exception:
            logger.debug("board reset (DTR/RTS) not supported on this port", exc_info=True)

    def boot_report(self, *, reset: bool = True, timeout: float = 5.0) -> Optional[dict]:
        """Return the board's boot-diagnostics payload, or None if none arrived.

        With ``reset=True`` the board is rebooted first so a *fresh* report is
        captured (the report is only emitted once per boot, in setup())."""
        if reset:
            self._boot = None
            self._boot_event.clear()
            self.reset()
        if self._boot is None:
            self._boot_event.wait(timeout)
        return self._boot

    def send(self, action: Action) -> None:
        self._acks.clear(action.key)
        self._serial.write(encode_action(action))
        self._serial.flush()

    def close(self) -> None:
        self._stop.set()
        try:
            self._serial.close()
        except Exception:
            logger.debug("error closing serial port", exc_info=True)


class MockTransport:
    """In-memory transport for tests and local development.

    Use ``push_event`` to inject events as if the board sent them.
    Use ``sent`` to inspect actions written by the host.
    """

    def __init__(self) -> None:
        self._rx: queue.Queue[Event] = queue.Queue()
        self._latest: dict[str, Event] = {}
        self._sent: list[Action] = []
        self._sent_wire: list[bytes] = []
        self._boot: Optional[dict] = None
        self._acks = _AckBox()
        self._closed = False

    def push_boot(self, payload: dict) -> None:
        """Test helper: inject a boot-diagnostics payload."""
        self._boot = payload

    def boot_report(self, *, reset: bool = True, timeout: float = 5.0) -> Optional[dict]:
        return self._boot

    def push_event(self, event: Event) -> None:
        if event.received_at is None:
            event = event.model_copy(update={"received_at": time.time()})
        self._latest[event.key] = event
        self._rx.put(event)

    def push_wire(self, line: str) -> None:
        """Test helper: feed a raw wire line and let the envelope decoder run."""
        ack = decode_ack(line)
        if ack is not None:
            self._acks.put(ack)
            return
        event = decode_event(line)
        if event is not None:
            self.push_event(event)

    def send(self, action: Action) -> None:
        if self._closed:
            raise RuntimeError("transport is closed")
        self._sent.append(action)
        self._sent_wire.append(encode_action(action))

    def wait_ack(self, key: str, timeout: float) -> Optional[dict]:
        return self._acks.wait(key, timeout)

    def recv(self, timeout: Optional[float] = None) -> Optional[Event]:
        try:
            return self._rx.get(timeout=timeout)
        except queue.Empty:
            return None

    def latest(self, key: str) -> Optional[Event]:
        return self._latest.get(key)

    def close(self) -> None:
        self._closed = True

    @property
    def sent(self) -> list[Action]:
        return list(self._sent)

    @property
    def sent_wire(self) -> list[bytes]:
        return list(self._sent_wire)

    @property
    def closed(self) -> bool:
        return self._closed
