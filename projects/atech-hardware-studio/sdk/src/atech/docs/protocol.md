# How an Atech board talks to your computer

The board is an ESP32-S3 on USB. Firmware built by this SDK speaks one small
protocol: one JSON object per line, UTF-8, `\n`-terminated, over the board's native
USB serial port.

| Direction | Name | What it is |
|---|---|---|
| board → computer | **event** | a reading, a button press, a state change |
| computer → board | **action** | a command |
| board → computer | **ack** | the board's answer to one action |
| board → computer | **boot** | one report after every reset, read by `atech check` |

`atech describe <project>` lists the exact event and action names of a project.

## Wire format

**Event**

```json
{"type":"event","payload":{"event_type":"sensor","key":"th_temperature","value":23.5,"source":"aht20"}}
```

- `event_type`: `sensor` | `button` | `state` | `log`
- `key`: built from the instance name, e.g. `btn`, `th_temperature`, `arm_positions`
- `value`: number, bool, string, list or object
- `source` (optional): the module id

**Action**

```json
{"action":"led_fill","value":"{\"r\":255,\"g\":0,\"b\":0}"}
```

`value` always travels as a string. The Python SDK turns numbers, bools, lists and
dicts into that string for you. Lines are capped at 4096 characters.

**Ack** — every action gets exactly one

```json
{"type":"ack","payload":{"action":"led_fill","ok":true}}
{"type":"ack","payload":{"action":"nope","ok":false,"error":"unknown action"}}
```

`ok:true` means a handler for that action ran and did not report a failure.
`ok:false` carries the reason: `unknown action`, or what the handler reported
(`positions must be 6 numbers`, `servo did not answer`). An acknowledgement is not
proof that hardware without read-back did anything: a light grid that is not plugged
in still acknowledges.

**Boot**

```json
{"type":"boot","payload":{"reset_reason":"POWERON","free_heap":245678,"modules":[{"instance":"th","module":"aht20","ok":true,"detectable":true}]}}
```

Any line that is not one of these JSON shapes (a driver's log line, for example) is
ignored by the host.

## From Python

```python
from atech import Board

with Board.connect() as board:            # NoBoardFoundError if no board is on USB
    board.call("led_fill", {"r": 255, "g": 0, "b": 0})   # waits for the ack
    for ev in board.events(keys=["btn"]):
        print(ev.type, ev.key, ev.value)
    print(board.diagnostics())            # reboots the board, returns the boot report
```

- `board.call(key, value="", *, timeout=2.0)` returns when the board acknowledged.
  It raises `ActionRejected` on `ok:false` and `NoAcknowledgement` when nothing
  came back in time.
- `board.query(key, value="", *, reply, timeout=2.0)` is `call`, then the value of
  the event with key `reply` that the action produced. The firmware prints that
  event before the acknowledgement.
- `board.send(key, value)` only writes the line. It never tells you whether
  anything happened.
- `board.events(types=..., keys=...)` blocks and yields events forever;
  `board.latest(key)` is the last event seen for a key, or `None`.
- `Board.connect(port=None)` takes the first board on USB. Only one program can
  hold a board's port; a second one gets `PortUnavailableError`.

## From the command line

```bash
atech monitor                 # events as they arrive
atech monitor --json          # one JSON object per line
atech monitor --key btn       # filter by key (or --type sensor)
atech send led_fill r=255 g=0 b=0   # exit 0 only if the board acknowledged; same as the JSON {"r":255,"g":0,"b":0}
atech check                   # boot report: reset reason and per-module health
atech ports                   # USB ports that look like a board
atech free-port               # release a port another process is holding
```

`atech send` exits 1 when the board could not carry out the action and 2 when it
did not answer. `atech monitor` holds the port: stop it before `atech send`.

## In firmware

Modules that produce readings print their events from the generated `loop`.
Modules that can be commanded declare actions with a `handler`; the generated
firmware reads the serial port, runs the handler and prints the ack.

Your own event, from `code.loop`:

```cpp
Serial.printf("{\"type\":\"event\",\"payload\":{\"event_type\":\"sensor\",\"key\":\"level\",\"value\":%d}}\n", level);
```

Your own action, from `code.loop`:

```cpp
if (atech_action == "buzz") {          // set for one pass of loop() when an
  spk.playTone(atech_value.toInt(), 100);   // unhandled action arrived
  atechDone();                         // sends the ack with ok:true
}
```

Do not read `Serial` in your own code: the generated firmware owns it. Helpers
available in handlers and in `code.loop`: `atechNum(json, "field", fallback)`,
`atechNums(json, "field", out, max)`, `atechTruthy(value)`, and `atechFail("why")`
to answer `ok:false` with a reason instead of a false success.

One action is handled per pass of `loop()`, so a `loop` that blocks delays actions.

A project that needs the raw USB serial stream for itself (a serial bridge, for
example) sets `host_actions: false` at the top of `project.yaml`. The firmware then
leaves `Serial` alone, and `atech send` gets no answer from that board.

## Not in the SDK

WiFi and Bluetooth transports. The board can do both (BLE only, no classic
Bluetooth), and the protocol does not depend on USB, but this package only
carries the USB serial transport. A web page using Web Serial (Chrome, Edge) can
speak this protocol over the same USB port; the SDK ships no JavaScript client.
