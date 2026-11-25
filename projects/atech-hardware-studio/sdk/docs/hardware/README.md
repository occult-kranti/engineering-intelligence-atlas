# Hardware reference

Board-level documentation extracted from the EasyEDA schematic exports that
live in [`schematics/`](schematics/). These describe **real hardware**; the
board specs the SDK builds against live in
`src/atech/catalog/data/boards/` and are a separate, editable representation.

| Doc | Board | Source export |
|---|---|---|
| [SMALL_MOTHERBOARD_V1.md](SMALL_MOTHERBOARD_V1.md) | Node Small Motherboard V1.0 — 10-port ESP32-S3 | `SCH_Node_Small_Motherboard_V1_0.json` (2026-08-27) |
| [INTEGRATOR_V3.md](INTEGRATOR_V3.md) | Node Integrator V3.0 — 6-channel universal I/O expander | `SCH_Node_Integrator_V3_0.json` (2026-08-27) |

The matching PCB exports were not copied in (2.5 MB and 1.4 MB); the placement
figures in the small-board doc were read out of
`PCB_PCB_Node_Small_Motherboard_V1_0_2026-08-27.json`.

## Regenerating

[`easyeda_netlist.py`](easyeda_netlist.py) parses an EasyEDA v6 schematic JSON
into components + a connectivity-derived netlist:

```bash
python docs/hardware/easyeda_netlist.py docs/hardware/schematics/SCH_Node_Small_Motherboard_V1_0.json
```

It unions wire segments, honours junction dots, and attaches pins and net
flags by coordinate, then names each net from its flag labels (unnamed nets
come out as `N$nnn`). Run it after any schematic revision and diff the output
against the tables in the docs.
