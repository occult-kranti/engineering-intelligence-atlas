# Finding and flashing the board (Linux, macOS, Windows)

`atech upload <dir>` regenerates the firmware from `project.yaml`, compiles it, and
flashes it with PlatformIO (esptool underneath). This page is for when it cannot
find the board or the flash fails. `atech guide` is the main guide.

## What the board looks like on USB

The board plugs in through the ESP32-S3's own USB (no USB-serial chip in between).
It shows up as a serial port, with no driver to install on Linux, macOS or
Windows 10/11:

| | |
|---|---|
| USB vendor:product | `303a:1001` (Espressif, the ESP32-S3's built-in USB serial/JTAG) |
| Linux | `/dev/ttyACM0` (`ttyACM1`, … with more boards) |
| macOS | `/dev/cu.usbmodem<digits>` |
| Windows | `COM<n>`, "USB Serial Device" in Device Manager |

`atech ports` lists what the SDK sees. It picks ports by USB vendor id: Espressif
(`303a`) first, then the USB-serial chips some ESP32 boards use (Silicon Labs
`10c4`, CH340 `1a86`, FTDI `0403`), then by name (`ttyACM`, `ttyUSB`, `usbmodem`,
`usbserial`). Built-in serial ports, Bluetooth ports and macOS's `debug-console`
are never picked. With several boards attached, pass `--port` to `atech upload`
and `port=` to `Board.connect()`.

## Is the board there at all?

Plug it in, then:

```bash
# Linux
lsusb | grep -i 303a                 # one line per board
ls -l /dev/ttyACM* /dev/serial/by-id/  # by-id names stay the same across replugs
sudo dmesg -w                        # watch it appear as you plug it in (Ctrl-C to stop)

# macOS (no lsusb unless you install one, e.g. `brew install lsusb`)
system_profiler SPUSBDataType | grep -i -A6 303a
ls /dev/cu.usbmodem*

# Windows (PowerShell)
Get-PnpDevice -PresentOnly | Where-Object InstanceId -match 'VID_303A'
```

Nothing there:

- **The cable.** Many USB cables carry power only: the board gets power and the
  computer sees nothing. Try a cable you have moved data over.
- **A hub or adapter.** Try a port on the computer itself.
- **The board is not powered or is in a reset loop.** Unplug every module, plug
  the board in alone, and look again.

## Linux

- **"Permission denied" on `/dev/ttyACM0`:** your user is not in the serial group.
  `sudo usermod -aG dialout $USER` (the group is `uucp` on Arch), then log out and
  in again. `groups` shows whether it took.
- **The port is busy right after plugging in:** ModemManager, on some distributions,
  opens new `ttyACM` devices to probe them for a modem. Wait a few seconds and try
  again, or stop it if you do not use a mobile modem:
  `sudo systemctl stop ModemManager`.
- `atech free-port` finds and stops whatever holds the port (`fuser`, `lsof`).

## macOS

- Use the `/dev/cu.*` name, not `/dev/tty.*`; the SDK does.
- A serial monitor in an editor (Arduino IDE, VS Code) holds the port. Close it,
  or run `atech free-port`.

## Windows

- The board is "USB Serial Device (COM<n>)" under *Ports (COM & LPT)* in Device
  Manager. No driver needed on Windows 10 and 11.
- `atech free-port` cannot stop another program on Windows; close it yourself.

## When flashing fails

`atech upload` resets the board into its bootloader over USB on its own and tries
three times, because the board's USB can drop for a moment (often while modules are
pushed in). A failure on all three:

- **Stuck at "Connecting…", or the port vanishes:** put the chip in its bootloader
  by hand. Hold **BOOT**, press and release **RESET**, then release **BOOT**. The
  port can come back under a new name; run `atech ports`, then
  `atech upload <dir> --port <that port>`. Press **RESET** after flashing if the
  new firmware does not start. Boards without a BOOT button cannot do this.
- **"Port in use" / "Resource busy":** another program holds it (`atech monitor`,
  a browser tab using Web Serial, an editor's serial monitor). Close it or run
  `atech free-port`.
- **It flashed, but nothing happens:** flashing worked; look at the firmware.
  `atech check` reboots the board and lists which modules answered, and
  `atech monitor` shows what it prints.

After a flash the board restarts and its port reappears within a couple of seconds.
A program that held the old port has to open it again (`Board.connect()` again).

## The files

`atech build <dir>` leaves the compiled firmware in
`<dir>/build/.pio/build/esp32-s3-devkitc-1/firmware.bin`, next to the bootloader
and partition table it needs. `atech upload` is the supported way to put them on a
board. Do not edit `build/`: every build regenerates it.
