"""High-level Board API for a flashed Atech motherboard."""

from __future__ import annotations

from typing import Iterator, Optional, Sequence, Union

from atech.runtime.models import Action, Event
from atech.runtime.transport import (
    PortUnavailableError,
    SerialTransport,
    Transport,
    discover_ports,
)

ActionValue = Union[str, int, float, bool, dict, list]


class NoBoardFoundError(RuntimeError):
    """Raised when :meth:`Board.connect` is called with no port and discovery finds nothing."""


class ActionError(RuntimeError):
    """An action sent with :meth:`Board.call` was not carried out."""


class ActionRejected(ActionError):
    """The firmware answered ``ok:false`` (usually: it has no action with that key)."""


class NoAcknowledgement(ActionError):
    """The board did not answer in time: nothing confirms the action was carried out."""


class Board:
    """A connected Atech board.

    Construct via :meth:`connect` for real hardware, or by passing any
    :class:`Transport` directly (e.g. ``MockTransport`` for tests).
    """

    def __init__(self, transport: Transport) -> None:
        self._transport = transport

    @classmethod
    def connect(cls, port: Optional[str] = None, baud: int = 115200) -> "Board":
        """Open a serial connection to a board.

        If ``port`` is None, picks the first port matching an Atech / ESP32 USB VID.
        Raises :class:`NoBoardFoundError` if auto-discovery finds nothing.
        """
        if port is None:
            candidates = discover_ports()
            if not candidates:
                raise NoBoardFoundError(
                    "No Atech board found on USB. Plug it in with a data cable (not charge-only), "
                    "or pass port=... explicitly; `atech ports` lists what is there."
                )
            port = candidates[0].device
        return cls(SerialTransport(port=port, baud=baud))

    def send(self, key: str, value: ActionValue, *, module_type: Optional[str] = None) -> None:
        """Send an action to the board.

        Examples:
            board.send("set_led_color", {"r": 255, "g": 0, "b": 0})
            board.send("motor_speed", 200)
            board.send("mode", "auto")
        """
        action = Action(key=key, value=value, module_type=module_type)
        self._transport.send(action)

    def call(self, key: str, value: ActionValue = "", *, timeout: float = 2.0) -> None:
        """Send an action and wait until the board confirms it carried it out.

        Use this instead of :meth:`send` whenever you need to know it worked.
        Returns normally when the firmware acknowledged the action. Raises
        :class:`ActionRejected` when the firmware has no such action, and
        :class:`NoAcknowledgement` when nothing came back within ``timeout``
        seconds (firmware built before action support, the board is rebooting,
        or the wrong port).

            board.call("led_fill", {"r": 255, "g": 0, "b": 0})
        """
        self.send(key, value)
        ack = self._transport.wait_ack(key, timeout)
        if ack is None:
            raise NoAcknowledgement(
                f"no answer from the board for action {key!r} within {timeout:g} s. "
                "It was written to the port, but nothing confirms the firmware acted on it. "
                "Rebuild and upload with this SDK version, then check `atech describe` for "
                "the actions the project accepts."
            )
        if not ack.get("ok"):
            error = ack.get("error") or "not ok"
            hint = (
                " `atech describe` lists the actions this project accepts."
                if error == "unknown action" else ""
            )
            raise ActionRejected(f"the board could not carry out {key!r}: {error}.{hint}")

    def query(self, key: str, value: ActionValue = "", *, reply: str, timeout: float = 2.0):
        """Send an action and return the value of the event the board answers with.

        For read-backs: the action makes the firmware send an event, and you want
        that event's value.

            positions = board.query("arm_read", reply="arm_positions")

        ``reply`` is the event key (``atech describe`` names it). Raises like
        :meth:`call`, and :class:`NoAcknowledgement` if the action was confirmed
        but the event did not arrive within ``timeout`` seconds.
        """
        import time

        before = self._transport.latest(reply)
        self.call(key, value, timeout=timeout)
        deadline = time.monotonic() + timeout
        while True:
            event = self._transport.latest(reply)
            if event is not None and event is not before:
                return event.value
            if time.monotonic() >= deadline:
                raise NoAcknowledgement(
                    f"the board confirmed {key!r} but sent no {reply!r} event within {timeout:g} s"
                )
            time.sleep(0.01)

    def latest(self, key: str) -> Optional[Event]:
        """Latest event seen for ``key``, or None if no event has arrived yet."""
        return self._transport.latest(key)

    def diagnostics(self, *, reset: bool = True, timeout: float = 5.0) -> Optional[dict]:
        """Reboot the board and return its boot-diagnostics report.

        The report explains *why* firmware might not be behaving:

            {
              "reset_reason": "POWERON" | "BROWNOUT" | "PANIC" | "TASK_WDT" | ...,
              "free_heap": 245678,
              "modules": [
                {"instance": "th",  "module": "aht20",      "ok": true, "detectable": true},
                {"instance": "tft", "module": "st7735_tft", "ok": true, "detectable": false},
              ],
            }

        ``ok`` with ``detectable=true`` means the hardware actually responded (e.g. an
        I2C sensor ACKed). ``detectable=false`` means the module initialised but has no
        read-back, so presence can't be verified in software. Returns None if no report
        arrived within ``timeout`` seconds (firmware too old, or board silent).
        """
        return self._transport.boot_report(reset=reset, timeout=timeout)

    def events(
        self,
        *,
        types: Optional[Sequence[str]] = None,
        keys: Optional[Sequence[str]] = None,
        poll_interval: float = 0.5,
    ) -> Iterator[Event]:
        """Yield events from the board indefinitely.

        Filters by type and/or key if provided. Loops forever — break out, or
        wrap in :func:`itertools.islice`. Ctrl-C interrupts cleanly because the
        underlying queue uses a short timeout.
        """
        type_set = set(types) if types else None
        key_set = set(keys) if keys else None
        while True:
            event = self._transport.recv(timeout=poll_interval)
            if event is None:
                continue
            if type_set is not None and event.type not in type_set:
                continue
            if key_set is not None and event.key not in key_set:
                continue
            yield event

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> "Board":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    @property
    def transport(self) -> Transport:
        """Underlying transport. For advanced use only."""
        return self._transport
