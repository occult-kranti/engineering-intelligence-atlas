"""Import the pinned Donna GLB scene into this handoff project, then add a studio.

Run explicitly inside Unreal Editor; never registered as an automatic startup script.
`python setup_donna_studio.py --check-source` only checks the local input.
Epic API references and engine/render acceptance instructions are in ../README.md.
"""

import argparse
import hashlib
import json
from pathlib import Path
import struct


PROJECT_DIR = Path(__file__).resolve().parents[1]
SOURCE_RELATIVE = "../../../desktop-shell/src/renderer/assets/donna-studio/donna-studio.glb"
CONTENT_ROOT = "/Game/DonnaStudio"
IMPORT_ROOT = CONTENT_ROOT + "/Imported"
MAP_PATH = CONTENT_ROOT + "/Maps/DonnaStudio"


def check_source():
    """Validate one approved, embedded GLB without loading Unreal or writing files."""
    manifest = json.loads((PROJECT_DIR / "handoff.json").read_text(encoding="utf-8"))
    source = (PROJECT_DIR / SOURCE_RELATIVE).resolve(strict=True)
    expected = manifest["source_glb"]
    if expected["path"] != SOURCE_RELATIVE:
        raise RuntimeError("The manifest source path differs from the approved asset.")
    if not source.is_file() or source.suffix.lower() != ".glb":
        raise RuntimeError("The approved source must be a local .glb file.")
    size = source.stat().st_size
    if size != expected["bytes"] or not 20 <= size <= 50 * 1024 * 1024:
        raise RuntimeError("Source size changed or exceeds the 50 MiB handoff limit.")
    data = source.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected["sha256"]:
        raise RuntimeError("GLB checksum changed. Review the asset before updating handoff.json.")
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    json_size, chunk_type = struct.unpack_from("<II", data, 12)
    if (magic, version, declared_size) != (b"glTF", 2, len(data)):
        raise RuntimeError("Expected a complete glTF 2.0 binary.")
    if chunk_type != 0x4E4F534A or not 0 < json_size <= len(data) - 20:
        raise RuntimeError("Missing or invalid GLB JSON chunk.")
    document = json.loads(data[20:20 + json_size])
    for collection in ("buffers", "images"):
        if any(item.get("uri") for item in document.get(collection, [])):
            raise RuntimeError("External or URI resources are not allowed in this handoff.")
    if not document.get("meshes") or not document.get("scenes"):
        raise RuntimeError("The GLB must contain meshes and a scene.")
    return source, {"sha256": digest, "bytes": size,
                    "source_scene_nodes": len(document.get("nodes", []))}


def setup_studio():
    source, source_info = check_source()
    import unreal  # Provided by the chosen Unreal Editor, not by system Python.

    actual_project = Path(unreal.Paths.convert_relative_path_to_full(
        unreal.Paths.project_dir())).resolve()
    if actual_project != PROJECT_DIR:
        raise RuntimeError("Open DonnaCreativeStudio.uproject from this handoff directory first.")
    required = ("InterchangeManager", "ImportAssetParameters", "LevelEditorSubsystem",
                "EditorActorSubsystem", "EditorAssetLibrary", "EditorLoadingAndSavingUtils")
    missing = [name for name in required if not hasattr(unreal, name)]
    if missing:
        raise RuntimeError("Required editor APIs unavailable: " + ", ".join(missing)
                           + ". See README manual import instructions.")

    dirty = list(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages())
    dirty += list(unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages())
    if dirty:
        raise RuntimeError("Save or explicitly discard your editor changes before running setup.")
    receipt_path = PROJECT_DIR / "Saved/DonnaStudio/import-receipt.json"
    if ((PROJECT_DIR / "Content/DonnaStudio").exists()
            or unreal.EditorAssetLibrary.does_directory_exist(CONTENT_ROOT)
            or receipt_path.exists()):
        raise RuntimeError("DonnaStudio output already exists. Setup does not replace or delete it.")

    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    source_data = unreal.InterchangeManager.create_source_data(str(source))
    if not manager.can_translate_source_data(source_data, scene_import_only=True):
        raise RuntimeError("No enabled glTF scene translator. Check Interchange in this engine.")
    parameters = unreal.ImportAssetParameters()
    # Feature checks happen before creating a map. APIs were reviewed against Epic's 5.6 docs.
    parameters.set_editor_property("is_automated", True)
    parameters.set_editor_property("replace_existing", False)
    parameters.get_editor_property("import_level")
    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not level_editor.new_level(MAP_PATH):
        raise RuntimeError("Could not create the DonnaStudio map.")
    parameters.set_editor_property("import_level", level_editor.get_current_level())
    before = {actor.get_path_name() for actor in actors.get_all_level_actors()}

    # Scene import preserves node transforms; mesh-only import plus origin spawning does not.
    if not manager.import_scene(IMPORT_ROOT, source_data, parameters):
        raise RuntimeError("Interchange scene import failed. Inspect Output Log; no success receipt written.")
    imported_actors = [actor for actor in actors.get_all_level_actors()
                       if actor.get_path_name() not in before]
    mesh_count = sum(len(actor.get_components_by_class(unreal.StaticMeshComponent))
                     for actor in imported_actors)
    if not imported_actors or mesh_count == 0:
        raise RuntimeError("Import returned without visible static-mesh components; inspect the scene.")

    target = unreal.Vector(0.0, 0.0, 175.0)

    def spawn(actor_class, label, position):
        location = unreal.Vector(*position)
        rotation = unreal.MathLibrary.find_look_at_rotation(location, target)
        actor = actors.spawn_actor_from_class(actor_class, location, rotation)
        if actor is None:
            raise RuntimeError("Could not create " + label)
        actor.set_actor_label(label)
        return actor

    camera = spawn(unreal.CameraActor, "Donna_StudioCamera", (-730.0, -780.0, 450.0))
    camera.camera_component.set_editor_property("field_of_view", 40.0)
    camera.camera_component.set_editor_property("aspect_ratio", 16.0 / 9.0)
    light_specs = (
        ("Donna_KeyLight", (-450.0, -500.0, 650.0), 60000.0, 350.0),
        ("Donna_FillLight", (450.0, -150.0, 450.0), 25000.0, 400.0),
        ("Donna_RimLight", (150.0, 450.0, 550.0), 45000.0, 250.0),
    )
    for label, location, intensity, width in light_specs:
        light = spawn(unreal.RectLight, label, location)
        component = light.get_component_by_class(unreal.RectLightComponent)
        component.set_mobility(unreal.ComponentMobility.MOVABLE)
        component.set_editor_property("intensity", intensity)
        component.set_source_width(width)
        component.set_source_height(width)

    floor_mesh = unreal.load_asset("/Engine/BasicShapes/Plane.Plane")
    if floor_mesh is None:
        raise RuntimeError("The engine's basic plane asset is unavailable.")
    floor = actors.spawn_actor_from_class(unreal.StaticMeshActor,
                                         unreal.Vector(0.0, 0.0, -2.0), unreal.Rotator())
    if floor is None:
        raise RuntimeError("Could not create Donna_StudioFloor.")
    floor.set_actor_label("Donna_StudioFloor")
    floor.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(floor_mesh)
    floor.set_actor_scale3d(unreal.Vector(20.0, 20.0, 1.0))

    if not unreal.EditorAssetLibrary.save_directory(CONTENT_ROOT, recursive=True):
        raise RuntimeError("Could not save DonnaStudio content.")
    if not level_editor.save_current_level():
        raise RuntimeError("Could not save DonnaStudio map.")
    receipt = {
        "status": "import_and_map_saved; visual_and_render_acceptance_pending",
        "engine_version": unreal.SystemLibrary.get_engine_version(),
        "source": SOURCE_RELATIVE,
        **source_info,
        "map": MAP_PATH,
        "imported_actor_count": len(imported_actors),
        "imported_static_mesh_component_count": mesh_count,
        "camera": "Donna_StudioCamera",
        "render_verified": False,
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    with receipt_path.open("x", encoding="utf-8") as receipt_file:
        json.dump(receipt, receipt_file, indent=2)
        receipt_file.write("\n")
    unreal.log("Donna studio imported and saved. Visual/render acceptance is still required. "
               + str(receipt_path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-source", action="store_true",
                        help="Validate the pinned local GLB only; do not load Unreal or write files.")
    args = parser.parse_args()
    if args.check_source:
        checked_source, information = check_source()
        print(json.dumps({"status": "source_checked; engine_not_executed",
                          "source": str(checked_source), **information}, indent=2))
    else:
        setup_studio()
