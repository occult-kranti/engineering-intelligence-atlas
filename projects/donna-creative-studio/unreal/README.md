# Donna creative studio — Unreal handoff

**Status: not executed here; UnrealEditor absent.** This is a prepared content project and import script. No Unreal `.umap`, `.uasset`, engine validation log, GPU benchmark or Unreal render has been produced here. Checking the Python syntax and source asset does not establish engine compatibility.

The project descriptor intentionally has no `EngineAssociation`. Choose an installed UE5 editor explicitly and record its exact version before accepting the project. The script's scene import APIs were reviewed against Epic's UE 5.6 documentation; available APIs, import pipelines and material results still require validation in the chosen build. Older UE5 builds may need the manual workflow below.

## What is supplied

| File | Purpose |
| --- | --- |
| [DonnaCreativeStudio.uproject](DonnaCreativeStudio.uproject) | Content-only project; enables Python Editor Script and Editor Scripting Utilities. |
| [Scripts/setup_donna_studio.py](Scripts/setup_donna_studio.py) | Explicit, one-time scene import plus a simple camera, three movable rectangular lights and a floor. |
| [handoff.json](handoff.json) | Source paths, SHA-256 digests, intended outputs and honest unverified status. |
| [Original GLB](../../../desktop-shell/src/renderer/assets/donna-studio/donna-studio.glb) | Existing sculpture with 20 scene nodes and their transforms. No duplicate binary is included here. |
| [Editable Blender scene](../../../desktop-shell/src/renderer/assets/donna-studio/donna-studio.blend) | Original Blender source; see its [provenance](../../../desktop-shell/src/renderer/assets/donna-studio/provenance.json). |

The GLB contains the sculpture only. The Unreal script creates a separate studio setup; its lighting, glass and camera composition need visual adjustment. It does not promise a pixel-identical reproduction of the Blender image. This is decorative Donna artwork, not live model routing or agent telemetry.

## 1. Prepare the chosen workstation

Use an engine already obtained through the user's Epic entitlement and normal installation process. Nothing in this directory downloads an engine, accepts a license, rents a machine or connects to a remote host. Keep this directory in the repository so the relative asset links resolve.

Open `DonnaCreativeStudio.uproject` using the selected UE5 installation. For Linux, an explicit launch looks like this; replace `/absolute/path/to/UE` and `/absolute/path/to/daftar` with real local paths:

```sh
/absolute/path/to/UE/Engine/Binaries/Linux/UnrealEditor \
  /absolute/path/to/daftar/projects/donna-creative-studio/unreal/DonnaCreativeStudio.uproject
```

Confirm **Python Editor Script**, **Editor Scripting Utilities**, and the installed version's **Interchange/glTF scene import** support are enabled. Restart if the editor requests it. Keep the default Interchange scene pipeline for this first acceptance run. The descriptor avoids guessing version-specific Interchange plugin names.

Use a working graphics driver and RHI for visual acceptance. `-NullRHI` can support a separate non-rendering inspection; it cannot prove the scene renders. A GPU container also needs the engine's graphics/Vulkan libraries and access to the host driver, beyond CUDA availability. See Epic's [Linux requirements](https://dev.epicgames.com/documentation/en-us/unreal-engine/linux-development-requirements-for-unreal-engine).

## 2. Check the approved source and import

From the repository root, this read-only check works without Unreal:

```sh
python projects/donna-creative-studio/unreal/Scripts/setup_donna_studio.py --check-source
```

The input is fixed to the supplied GLB. The script verifies its checksum, file size, GLB header and embedded resources. An intentional new asset revision requires reviewing the changed asset and updating `handoff.json` before import.

Save or explicitly discard any existing editor changes. Setup refuses dirty packages because creating a new level closes the current level. In the editor's Output Log, use **Cmd** mode and run:

```text
py "/absolute/path/to/daftar/projects/donna-creative-studio/unreal/Scripts/setup_donna_studio.py"
```

Alternatively, use the editor's **Execute Python Script** menu entry to select that file. Run once in this project only. The script checks the active project directory and refuses existing `/Game/DonnaStudio` output. It imports the **scene**, preserving node transforms, instead of placing separate imported meshes at the origin.

An explicit full-editor command-line invocation is also available after the interactive prerequisites have been checked:

```sh
/absolute/path/to/UE/Engine/Binaries/Linux/UnrealEditor \
  /absolute/path/to/daftar/projects/donna-creative-studio/unreal/DonnaCreativeStudio.uproject \
  -ExecutePythonScript=/absolute/path/to/daftar/projects/donna-creative-studio/unreal/Scripts/setup_donna_studio.py \
  -Unattended -StdOut -FullStdOutLogOutput
```

Epic documents that this execution mode exits after the script; reopen the editor for visual checks. It is not a render command. Retain the process exit status and `Saved/Logs/` output. Do not treat a zero exit code alone as acceptance: require the saved content and receipt as well. [Epic Python execution reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python).

After a successful engine execution, expected results are:

- Map `/Game/DonnaStudio/Maps/DonnaStudio` and imported content under `/Game/DonnaStudio/Imported`.
- `Donna_StudioCamera`, three `Donna_*Light` actors and `Donna_StudioFloor`.
- `Saved/DonnaStudio/import-receipt.json`, recording the actual engine version and imported actor/component counts. Its render status remains false.

Failure may leave partial content. The script does not delete it, overwrite it or automatically retry. Inspect the Output Log, preserve any useful work, then remove only this handoff's generated content through the editor or use a fresh checkout before rerunning.

## 3. Validate inside Unreal

1. Open the saved DonnaStudio map, close and reopen the project, and confirm the map and materials still load without missing references.
2. Inspect the sculpture in Lit mode. Check distinct module positions, vertical orientation, scale, rails and brass details against the existing Blender preview. Twenty source nodes do not guarantee twenty actors: the import pipeline may organize them differently.
3. Pilot `Donna_StudioCamera` from the World Outliner. Confirm the full sculpture fits, the floor is under the plinth, shadows appear and the camera does not clip the geometry. Adjust framing and exposure deliberately, then save.
4. Inspect glass and metallic materials individually. glTF material translation is an import baseline; Blender shading equivalence is a separate review.
5. Preserve the receipt, editor log, actual engine/driver/GPU versions and one viewport screenshot. Mark import acceptance only after these checks pass.

## 4. Produce a real render acceptance artifact

Enable **Movie Render Queue**, restart if needed, then open the saved map. Create a Level Sequence named `DonnaStudio_Acceptance` in `/Game/DonnaStudio`. Add the existing `Donna_StudioCamera` to Sequencer, create a Camera Cuts track bound to it, and cover a short range such as frames 0–23 at 24 fps.

Open **Window → Cinematics → Movie Render Queue**, add that sequence, and set its map explicitly to DonnaStudio. Start with **Deferred Rendering**, **PNG**, **1920 × 1080** and output under `Saved/DonnaStudio/Renders`. Render a single frame using an explicit custom range, such as start 0/end 1, with motion blur disabled for the still. Keep quality modest until the first frame is correct. These are proposed acceptance settings, not measured settings from this environment.

Use **Render (Local)** on the workstation. Acceptance requires an actual readable PNG of the sculpture, correct camera/lighting/materials, a completed render log without fatal RHI errors, and the actual render duration plus GPU/VRAM observations. Save the sequence and preset alongside the map. A static source image, NullRHI success or an import receipt does not satisfy this render gate. [Epic Movie Render Pipeline](https://dev.epicgames.com/documentation/en-us/unreal-engine/movie-render-pipeline-in-unreal-engine).

Remote automation or Pixel Streaming should be added only after this artifact passes. This directory does not add arbitrary shell execution, register a remote tool, modify the fixed Daftar runtime operations or connect the desktop UI to an Unreal session.

## Manual fallback for an unsupported engine/importer

In this dedicated project, create and save an empty level as `/Game/DonnaStudio/Maps/DonnaStudio`. Use **File → Import Into Level**, choose the supplied `donna-studio.glb`, and import into `/Game/DonnaStudio/Imported` using the scene pipeline. Confirm scene hierarchy and transforms before adding a camera, lights and floor manually. Continue with the same visual/render acceptance gates. Do not run the one-time script afterward over the manually created content. Epic documents glTF support for [Import Into Level through Interchange](https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-assets-using-interchange-in-unreal-engine).

## API references used in the bounded script

- [InterchangeManager, UE 5.6](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/InterchangeManager?application_version=5.6): source translation and synchronous scene import.
- [ImportAssetParameters, UE 5.6](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/ImportAssetParameters?application_version=5.6): automation, target level and nonreplacement settings.
- [LevelEditorSubsystem](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/LevelEditorSubsystem): new/save level.
- [EditorActorSubsystem](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorActorSubsystem): actor enumeration and creation.
- [EditorLoadingAndSavingUtils](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorLoadingAndSavingUtils): dirty-package guard.
- [EditorAssetLibrary](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorAssetLibrary): scoped content save and existence checks.
- [CameraComponent](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/CameraComponent) and [RectLightComponent](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/RectLightComponent): basic studio properties.

The local handoff preparation verifies JSON, Python syntax and the pinned GLB input only. Engine execution and render acceptance remain pending until performed on a licensed, working Unreal workstation.
