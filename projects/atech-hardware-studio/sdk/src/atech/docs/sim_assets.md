# Simulation assets for Atech modules and boards

`atech sim-assets` writes a 3-D asset for every Atech module and board, so it can be
dropped into **Isaac Sim / Omniverse** (USD, following NVIDIA SimReady), **MuJoCo**
(MJCF) and **ROS / Gazebo** (URDF).

```bash
pip install "atech[sim]"                       # usd-core (--format usd) and trimesh (real CAD)
atech sim-assets distance_sensor icm40608 --out sim_assets
atech sim-assets --all --board 14port --format mjcf,urdf --out sim_assets
atech sim-assets my_sensor --modules-path ./my_modules --out sim_assets
atech sim-assets --all --board 14port --out sim_assets --meshes ~/atech_glb/glb_plain   # real CAD
atech sim-assets --all --board 14port --out sim_assets --fetch                          # same, via gh
```

`atech guide sim` prints this page.

Output layout (one folder per USD asset, as SimReady asks):

```
sim_assets/
├── usd/atech_distance_sensor/atech_distance_sensor.usda
│   └── .thumbs/256x256/atech_distance_sensor.usda.png
├── mjcf/atech_distance_sensor.xml
└── urdf/atech_distance_sensor.urdf
```

With real CAD (`--meshes` / `--fetch`, below) the USD file is a binary
`<asset>.usdc` instead of `.usda` (the meshes are large arrays, which belong in a
crate file), and the STL meshes go to `mjcf/meshes/<asset>/` and `urdf/meshes/<asset>/`.
Exporting an asset again into the same `--out` removes what the last export of
that asset left behind: the other root USD (`.usda` or `.usdc`) and its
thumbnail, and its STL folders, so a folder never holds two versions of one asset.

Asset names: `atech_<module id>` for modules, `atech_board_<board id>` for boards
(a USD prim name cannot start with a digit, and `14port` does).

> **Sizes come from Atech's CAD; masses are placeholders.** Where Atech's production
> CAD has a model (the table under *Real CAD*), the `sim.yaml` boxes are the bounds
> of that CAD and say so (`# CAD: ...`). Atech has not published masses, connector
> positions, or the remaining dimensions (the 8-port board, the CO₂, robot-arm
> and stepper modules). Every such value in a `sim.yaml` is a
> plausible guess, commented `# PLACEHOLDER: replace with Atech module datasheet`
> and listed under `placeholders:`; each exported asset carries that list
> (`atech:placeholders` in USD, a comment in URDF, a `<custom><text>` in MJCF). Values a chip datasheet should confirm say `verify against <doc>`.
> Sensor parameters marked `catalog` come from the module's `module.yaml` or driver.

## Real CAD (`--meshes`, `--fetch`)

The visual geometry can be Atech's production CAD instead of boxes. The meshes are
**not** in the SDK package: they live in the private release
`atechdotdev/atech-module-renders` (asset `atech_module_glb.zip`, folder
`glb_plain/`, one `<slug>.glb` per model).

- `--meshes DIR`: an unzipped `glb_plain/` folder.
- `--fetch [TAG]`: downloads the release (default `v1.7`) with the GitHub CLI.
  `gh` must be logged in with access to `atechdotdev`. The GLBs are cached in
  `~/.cache/atech/module-renders/<TAG>/glb_plain` (`$ATECH_CACHE_DIR` or
  `$XDG_CACHE_HOME` move it). Write `--fetch` after the module names, or give a tag.

Reading a GLB needs `trimesh` (in `atech[sim]`). The GLB frame (+y up, origin at
the footprint centre, shell bottom on y = 0, outer face toward -z) is converted to
the asset frame: glTF `(x, y, z)` → `(x, -z, y)`, so the outer (board-edge) face
points toward **+y**. Each glTF material becomes one mesh, coloured with its base
colour (linear in USD, sRGB in MJCF and URDF).

| asset | release model | | asset | release model |
|---|---|---|---|---|
| `distance_sensor` | `distance-sensor` | | `rotary_encoder` | `knob` |
| `icm40608` | `orientation-sensor` | | `speaker` | `speaker` |
| `aht20` | `temp-sensor` | | `microphone` | `microphone` |
| `neopixel` | `led-grid` | | `st7735_tft` | `screen` |
| `button` | `button` | | `dc_motor` | `dc-motor` |
| board `14port` | `frame-2` | | board `10port` | `motherboard-10port` |

Only the visuals change: collisions, mass and inertia stay the `sim.yaml` boxes. A
model whose bounds differ from the boxes by more than 1 mm is not used, and the
command says so on stderr. The 10-port board's `sim.yaml` (size, port positions) is
measured from its model; which socket is which port number is not in the CAD and
stays a placeholder (its header says how it was chosen).

**Derived models** (`atech/sim/derived.py`). The CO₂, robot-arm and stepper
modules and the 8-port board have no model in the release. With a mesh folder they
get one built from the CAD that exists, so every asset has a full visual:

- a module: the shell, PCB, pins and glass lid of a release module with the same
  number of ports (`temp-sensor` without its chip, `screen` without its display),
  plus its own `sim.yaml` parts as meshes in their `shape:`: the
  SCD40, the robot arm's capacitor and servo connector, the TMC2209 and the motor
  terminal. The CO₂ module takes the `button`'s shell instead, whose lid has
  an 11 mm opening for the sensor to stand up through. The robot-arm module plugs into
  one port but its housing is two cells long, as in Atech's render: the `screen`'s
  shell, with the pins under the -x cell only and an opening in the lid over the
  servo connector; its `connector` frame is the centre of that cell;
- a board: its `sim.yaml` plate in `frame-2`'s PCB material and one `frame-2` socket
  housing on every module port.

They are **not Atech CAD**: `atech:visual:source` (USD), the MJCF text and the URDF
comment start with `derived:` and name the donor, and the parts' sizes are the
`sim.yaml` placeholders. A release model replaces a derived one as soon as the
release has it.

| format | with CAD |
|---|---|
| USD | `geometry/<material>_cad_mesh` (purpose `render`, no collider) + `looks/<material>_cad_material`: a UsdPreviewSurface with the GLB material's own PBR (`diffuseColor` = baseColorFactor, linear; `metallic`; `roughness`; `emissiveColor` = emissiveFactor × KHR_materials_emissive_strength; alphaMode BLEND → `opacity` = alpha × (1 − KHR_materials_transmission) with `opacityThreshold` 0, so the glass lids are clear; `ior`). UsdPreviewSurface has no transmission or unlit: the alpha, KHR_materials_transmission and _unlit are kept as `atech:gltf:alpha` / `atech:gltf:transmission` / `atech:gltf:unlit` on the Material, and `atech:gltf:material` names the glTF material. Textured materials (the screen art) get `UsdUVTexture`s on the GLB's own images, written to `textures/<asset>_<material>_{base_color,emissive}.png` next to the USD, sampled through `primvars:st`. The boxes keep their colliders and get purpose `guide`; root attributes `atech:visual:source`, `atech:visual:sha256` |
| MJCF | `<mesh>` assets from `mjcf/meshes/<asset>/<material>.stl`; geoms `<name>_<material>_cad` (group 2, `contype`/`conaffinity` 0, mass 0); the boxes move to group 3 (hidden in the viewer by default) |
| URDF | `<visual>` meshes from `urdf/meshes/<asset>/<material>.stl`; the box `<collision>`s stay, the box `<visual>`s go |

```python
from atech import sim

meshes = sim.mesh_library(meshes="~/atech_glb/glb_plain")   # or fetch="v1.7"
sim.export(["button"], ["usd", "mjcf"], "out", meshes=meshes,
           on_note=lambda asset, note: print(asset, note))
```

## Python API

```python
from atech import sim

sim.export(["distance_sensor"], ["usd", "mjcf", "urdf"], "out", board_ids=["14port"])  # -> list[Path]

# MJCF <body> to paste into a scene (no joint: welded to its parent)
xml = sim.module_mjcf_body("distance_sensor", "tof", pos=(0, 0, 0.1), quat=(1, 0, 0, 0), rgba=None)
sensors = sim.module_mjcf_sensors("distance_sensor", "tof")       # <sensor> children
board_xml = sim.board_mjcf_body("14port", "hub")                  # + a site per port

# URDF links + fixed joints to paste inside <robot>
urdf = sim.module_urdf_link("icm40608", "imu", parent="wrist_link", pos=(0.01, 0, 0))

# Where a module sits on a board port (board asset frame)
board, tof = sim.load_board_sim("14port"), sim.load_module_sim("distance_sensor")
pos, quat = sim.module_pose_on_board(board, [1], tof)              # quat is (w, x, y, z)
```

`module_mjcf_body` emits, for `name="tof"`:

| element | name | what |
|---|---|---|
| `<body>` | `tof` | at `pos` / `quat` in the parent |
| `<geom type="box">` | `tof_body`, `tof_<part>` | one per part, with `mass` (MuJoCo derives inertia) |
| `<site>` | `tof_connector` | connector frame |
| `<site>` | `tof_sensor` / `tof_actuator` | device frame, when the module has one |
| `<site>` | `<name>_port_<n>` | boards only: one per port frame |

`rgba` overrides the colour of the main body geom only. `module_mjcf_sensors`
returns MuJoCo sensors that approximate the module: `imu` → `accelerometer` +
`gyro` on the sensor site; `tof_multizone` → one `rangefinder` along the boresight
(the centre ray only: the 8×8 zones need your own ray casts, e.g. `mj_ray`);
other types → none. The standalone `.xml` puts the asset on a free joint above a
floor and includes those sensors.

## Frames

All lengths are metres, all angles in `sim.yaml` are degrees, quaternions are
`(w, x, y, z)`.

- **Asset frame.** Origin at the centre of the bottom (mounting) face, +z out of the
  top face, +x along the long side. USD stage: `upAxis = Z`, `metersPerUnit = 1`,
  `kilogramsPerUnit = 1`.
- **Connector frame** (`connector:`). Where the module plugs in. A module is placed
  on a board by making its connector frame coincide with the board's **port frame**.
  For every module today it is the asset origin.
- **Port frame** (boards, `ports:`). On the board face, on top of the port plate,
  +z out of the face. Ports on the back face of the 10-port board have `face:
  bottom` and point −z (`rpy_deg: [180, 0, 0]`). A double-width module goes to the
  midpoint of its two ports with +x along the pair, pointing so that the module's
  +y (its outer face) agrees with the port frames' +y, or, when that +y runs across
  the pair, from the lower- to the higher-numbered port (`module_pose_on_board`, which raises `ValueError` for a reserved port or two
  ports that are not one of the board's `adjacent_port_pairs`). This is geometry
  only: which way a double-width module's pins are wired is the board YAML's
  `side:` field, and the asset does not model it.
- **Sensor / actuator frame** (`sensor.frame`, `actuator.frame`). For a ranging or
  looking sensor (ToF) +z is the boresight; for the IMU the axes are the
  measurement axes (placeholder: the module axes).
- `rpy_deg` is roll about x, then pitch about y, then yaw about z, about fixed axes
  (the URDF convention).

## `sim.yaml` (modules) and `boards/sim/<id>.sim.yaml` (boards)

A module's file sits next to its `module.yaml`. A board's lives in
`catalog/data/boards/sim/`, a sub-folder, because the board loader reads every
`boards/*.yaml` as a board. A custom module (`modules_path:`) can ship its own
`sim.yaml` next to its `module.yaml`. Catalog facts (name, interface, I²C address,
port count, port ids) are **not** repeated in `sim.yaml`; they come from
`module.yaml` / the board YAML.

| field | type / unit | meaning |
|---|---|---|
| `schema` | int | `1` |
| `size_m` | [x, y, z] m | the main body box, sitting on the asset origin |
| `mass_kg` | kg | total mass, spread over the parts by volume (uniform density) |
| `colors` | name: [r, g, b, a], 0..1 | `body` is required; parts refer to the others |
| `asset_name` | string, modules only (optional) | the exported name, `atech_` + snake_case, when the product is sold under another name than its catalog id: the `robot_arm` module is `atech_robot_arm_integrator`. Default `atech_<module id>` |
| `parts` | list of `{name, size_m, pos_m, color, shape}` | extra boxes; `pos_m` is the box centre. `shape` (optional) is how a derived visual draws the part inside its box: `box` (default; `dome` for a name containing `dome`), `rounded_box`, `cylinder`, `dome` (a faceted half-ellipsoid) or `chamfered_box`. The collider is always the box |
| `connector` | `{pos_m, rpy_deg}` | connector frame |
| `physics_material` | `static_friction`, `dynamic_friction`, `restitution` | collider material |
| `sensor` / `actuator` | `{type, chip?, frame, <params>}` | device block, see below |
| `ports` | boards: `port_<n>: {pos_m, rpy_deg, face?}` | port frames; reserved positions (USB-C, Reset) may be listed |
| `semantic.wikidata_qcode` | list of Q-codes | SimReady semantic labels (checked on wikidata.org) |
| `semantic.class` | list of words | plain class labels |
| `placeholders` | list of field paths | fields that are guesses (`sensor.frame` style paths) |

The loader rejects (as `SimSpecError`, before any file is written): non-finite
numbers; sizes or a mass that are not > 0; colour components outside 0..1;
friction < 0 or restitution outside 0..1; colour keys, device `type`s and parameter
names that are not identifiers (`[A-Za-z_][A-Za-z0-9_]*`, they become USD names);
part names that are not lowercase snake_case starting with a letter; and integer
parameters outside the 32-bit signed range (USD `int`).

## Device types and parameters

Parameter names carry their unit. Each is exported as `atech:sensor:<name>` or
`atech:actuator:<name>` on the USD `sensor` / `actuator` prim.

| type | module | parameters |
|---|---|---|
| `tof_multizone` | distance_sensor (VL53L5CX) | `zones` [cols, rows]; `max_range_m`; `min_range_m`; `fov_deg` [h, v]; `rate_hz`; `no_target_mm` (driver sentinel for "nothing in range") |
| `imu` | icm40608 (ICM-40608 / LSM6DSOX) | `accel_range_g` (±); `gyro_range_dps` (±); `rate_hz`; `shake_threshold_g` |
| `temperature_humidity` | aht20 | `temperature_range_c` [min, max]; `humidity_range_pct` [min, max]; `measurement_time_s`; `event_period_s` |
| `co2` | scd40_air_quality | `co2_range_ppm` [min, max]; `period_s`; `first_reading_s` |
| `button` | button | `active_low` (bool) |
| `rotary_encoder` | rotary_encoder | `steps_per_rev`; `has_push_switch` (bool) |
| `microphone` | microphone (ICS-43434) | `sample_rate_hz`; `bits_per_sample` |
| `servo_bus` | robot_arm (STS3215 bus) | `bus` (`uart_half_duplex`); `baud` (bit/s); `servo_ids`; `position_ticks` (per turn); `center_tick`; `tx_line` (`A` or `B`) |
| `led_grid` | neopixel | `rows`; `cols`; `led_count` |
| `led_ring` | rotary_encoder | `led_count` |
| `display` | st7735_tft | `width_px`; `height_px`; `color_format`; `full_redraw_s` |
| `speaker` | speaker (MAX98357A) | `amplifier_power_w` |
| `dc_motor_driver` | dc_motor | `command_range` [min, max]; `motor_modelled` (bool: false, no motor joint or torque model; the CAD housing is geometry only) |
| `stepper_driver` | stepper_motor (TMC2209) | `control` (`step_dir`); `motor_modelled` (bool) |

The robot arm module asset is the controller module only; the SO-101 arm itself is a
separate robot description.

## USD prims and `atech:*` attributes

```
/atech_<id>                     Xform, defaultPrim, kind=component
│                               RigidBodyAPI, MassAPI, SemanticsLabelsAPI:wikidata_qcode / :class
├── looks/                      Scope
│   ├── <color>_material        Material → UsdPreviewSurface "preview_surface"
│   └── physics_material        Material + PhysicsMaterialAPI
├── geometry/<material>_cad_mesh  with real CAD only: Mesh, purpose render, no collider
├── geometry/<part>_mesh        Mesh (box), CollisionAPI + MeshCollisionAPI (convexHull),
│                               displayColor/Opacity, visual + "physics" material bindings
├── connector                   Xform at the connector frame
├── sensor                      Xform at the sensor frame (when there is one)
│   └── imu_sensor              IsaacImuSensor (imu type only)
├── actuator                    Xform at the actuator frame (when there is one)
└── ports/port_<n>              boards only: Xform at each port frame
```

Every custom attribute is in the `atech:` namespace and carries a `doc` string.

| attribute | prim | USD type | unit / values |
|---|---|---|---|
| `atech:asset_type` | root | string | `module` \| `board` |
| `atech:id` | root | string | catalog id (`distance_sensor`, `14port`) |
| `atech:name` | root | string | catalog display name |
| `atech:category` | root | string | module.yaml category (`sensor`, `distance`, `robotics`, …) or `board` |
| `atech:interface` | root | string | modules: `i2c` \| `gpio` \| `analog` \| `uart` |
| `atech:i2c_address` | root | int | 7-bit address, decimal (0x29 → 41); only on I²C modules |
| `atech:size_ports` | root | int | modules: ports spanned (1 or 2); boards: module ports |
| `atech:catalog_version` | root | string | version of the `atech` package that wrote the file |
| `atech:placeholders` | root | string[] | `sim.yaml` field paths that are guesses |
| `atech:visual:source` | root | string | with real CAD: the release and `glb_plain/<slug>.glb` the visual meshes come from |
| `atech:visual:sha256` | root | string | with real CAD: sha256 of that `.glb` |
| `atech:connector:type` | connector | string | `atech_port` (module) \| `board_mount` (board) |
| `atech:connector:span_ports` | connector | int | ports the connector spans; 0 on a board |
| `atech:sensor:type` | sensor | string | a type from the table above |
| `atech:sensor:chip` | sensor | string | part number, when known |
| `atech:sensor:<param>` | sensor | int / double / bool / string / int[] / double[] / string[] | see the device table |
| `atech:actuator:type`, `:chip`, `:<param>` | actuator | as for sensor | |
| `atech:port:id` | ports/port_n | string | `port_<n>` |
| `atech:port:face` | ports/port_n | string | `top` \| `bottom` |
| `atech:port:reserved` | ports/port_n | bool | true for USB-C / Reset positions |
| `atech:port:interfaces` | ports/port_n | string[] | from the board YAML: `i2c`, `digital`, `gpio`, `analog`, `uart` |
| `atech:port:side` | ports/port_n | string | the board YAML's `side:` (orientation of double-width modules) |

Root-layer `customLayerData` (SimReady SR.001): `SimReady_Metadata` (empty
dictionary), `asset_name`, `asset_type` (`atech_module` / `atech_board`),
`source_file` (the `sim.yaml` it came from), `usd_date_generated` (ISO date). The
root prim's `assetInfo` holds `name` and `version`.

Physics: one rigid body per asset. `physics:mass` is `mass_kg`;
`physics:centerOfMass`, `physics:diagonalInertia` and `physics:principalAxes` are
computed from the parts at uniform density (the same numbers the URDF `<inertial>`
holds as a full tensor and MuJoCo derives from the geoms). To weld a module to a
robot link in Isaac Sim, either add a fixed joint between the two bodies or remove
the module's `RigidBodyAPI` so its colliders join the link's body.

## SimReady conformance

Checked against the SimReady Foundation docs (Robotics-Prop profile 4.0.0 and the
Sensor-IMU profile), by `atech.sim.validate.simready_problems` (pure `pxr`) and by
NVIDIA's `omniverse-asset-validator` 1.18 with every capability, feature and
requirement it ships enabled. `tests/test_sim_assets.py` runs both; both report
nothing for every module and board (box geometry). With real CAD,
`tests/test_sim_meshes.py` runs both on a synthetic model (nothing reported);
on Atech's own CAD the NVIDIA validator adds VG.007 warnings (see below).

Met:

- **Units / hierarchy**: UN.006 upAxis Z, UN.007 metersPerUnit 1, kilogramsPerUnit 1;
  HI.001 one root prim, HI.003 root is an Xform, HI.004 defaultPrim; `kind =
  component`; VG.025 asset at the origin with a neutral root transform.
- **Naming**: NP.001 snake_case prims with type suffixes (`_mesh`, `_material`);
  NP.002 lowercase file names; NP.005 one USD file per asset folder; no external
  references, so NP.007 / NP.008 / AA.001 / AA.002 hold trivially.
- **Geometry**: VG.MESH.001 meshes with `subdivisionScheme = none`; VG.002 extents;
  VG.014 valid topology; VG.029 counter-clockwise winding; VG.027 / VG.028 one
  normals attribute, unit length, outward.
- **Physics**: RB.001 RigidBodyAPI on the root Xform; RB.003; RB.COL.001–003
  CollisionAPI + MeshCollisionAPI on Mesh prims only; RB.007 `physics:mass`;
  RB.009 no skew; PMT.001 every collider bound to a physics material (`physics`
  purpose).
- **Materials**: VM.MAT.001 every Gprim bound to a material; VM.PS.001
  UsdPreviewSurface with spec inputs only; com.nvidia.usd.VM.BIND.001 materials
  inside the asset; DISP.001–003 displayColor / displayOpacity on every Gprim.
- **Semantics**: SL.003 `SemanticsLabelsAPI:wikidata_qcode` with
  `semantics:labels:wikidata_qcode` Q-codes (looked up on wikidata.org), plus a
  `class` instance with plain labels.
- **Metadata**: SR.001 required `customLayerData` keys; SR.002 a 256×256 PNG
  thumbnail in `.thumbs/256x256/<file>.png`.
- **Sensor-IMU**: PS.001 the `IsaacImuSensor` prim sits under the rigid body.

Not met, and why:

- **SR.003 / SR.004 provenance metadata**: the docs name the requirement but do not
  give its fields; nothing is invented.
- **SR.002 content**: the thumbnail is a flat top-down drawing of the boxes, not a
  rendered image (no renderer in a pure-Python export).
- **Geometry fidelity**: without `--meshes` / `--fetch` every part is a box. With
  them the visuals are Atech's CAD, but the colliders stay boxes (the CAD bounds).
- **VG.007 with real CAD**: Atech's CAD tessellation has non-manifold vertices and
  edges (the 14-port board also one mesh with inconsistent winding). The NVIDIA
  validator reports them as warnings on the `--meshes` / `--fetch` assets; the
  meshes are passed on as Atech exported them, only with co-located points merged
  (VG.016). Box-only assets report nothing.
- **Sensors other than the IMU**: Isaac Sim has no SimReady profile for a multizone
  ToF, temperature or CO₂ sensor; their parameters are carried as `atech:sensor:*`
  attributes for a simulator to read. The `IsaacImuSensor` prim is typed by name
  only: usd-core does not ship the Isaac schema, so no Isaac-specific attribute is
  authored.
- **Runtime variants** (RV.*, PhysX / Newton / MuJoCo variant sets), **non-visual
  materials** (NVM.*), **MDL / OpenPBR materials**: optional in Robotics-Prop and not
  authored.
- **GSP.001 grasp check**: visual review only, no validator; not done.
- **ISA.001 Isaac component layout** (`payloads/`): optional; the asset is one flat
  `.usda` (`.usdc` with real CAD).
