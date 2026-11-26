# Donna — observed Blender worker acceptance

This evidence records a real run of Daftar's `CreativeToolsService`, process guard, fixed Blender worker and device-selection helper on **2026-11-26**, using installed **Blender 4.3.2** and the existing Donna scene. It is separate from the original asset-generation render.

| Check | Observed result |
| --- | --- |
| Source | `desktop-shell/src/renderer/assets/donna-studio/donna-studio.blend`, SHA-256 `eef523386640e8ee4b390517973841cacef44146de3a98da4792f5dfa4a64aae` |
| Inspection | 26 objects, 21 meshes, 7 materials, 1 camera, 4 lights; 1.607481 s job wall time |
| CPU render | Cycles, 128 × 128, frame 1, 4 samples, two threads |
| Render timing | 0.432828 s inside Blender; 2.074271 s job wall time |
| PNG | 38,435 bytes; SHA-256 `0cadace924369292686efd4d5ac2fc83e1a07777d18447a3c3c47c169387df37` |
| Requested OPTIX | Rejected before Blender with `GPU_MEMORY_PREREQUISITE`; this host had no readable finite cgroup-v2 memory limit |
| Scope | Disposable synthetic company, employee, assignment and authority snapshot; 20 callbacks, zero provider calls |
| Cleanup | Disposable state removed; worker/backend source hashes unchanged during the run |

The small, noisy [CPU PNG](cpu-render.png) proves this bounded execution completed; it is not the finished visual asset. [Inspection data](cpu-inspection.json) and the [sanitized receipt](receipt-2026-11-26.json) retain actual outputs, hashes, limits, process arguments and durations. Temporary fixture paths are represented by `<disposable-fixture>` and the checkout root by `<repository>`. No credentials or owner state are included.

## Reproduce on an installed Blender

From the repository root, use an explicit local executable and a **new** output directory whose parent already exists:

```sh
node projects/donna-creative-studio/acceptance/run-acceptance.mjs \
  --blender /usr/bin/blender \
  --output /tmp/donna-worker-acceptance-new
```

The runner copies the reviewed scene into disposable state, probes the actual executable version, inspects the scene and renders the same 128 × 128 CPU frame. It checks artifact hashes, PNG dimensions and the reported Cycles backend, retains sanitized logs/receipts, closes the service and removes its temporary state. It never opens a production workspace, makes a provider request or installs software. The service's process, memory, time, artifact and authority guards remain active.

To reproduce the **expected failure** of a requested OPTIX render on a host known not to satisfy the GPU prerequisites, add `--expect-optix-unavailable`. That option accepts only `GPU_MEMORY_PREREQUISITE` or `GPU_DEVICE_UNAVAILABLE`. Do not use it as a successful GPU acceptance test.

The recorded failure here reached the memory prerequisite guard, not Cycles' GPU enumeration. `gpuTested: false` therefore remains accurate. A real CUDA/OptiX benchmark, production native authority integration, Unreal execution, gameplay/collision validation and large-scene performance are outside this evidence. Image bytes and timings may vary across Blender builds and machines; require valid output and truthful metadata rather than the historical PNG hash on reruns.
