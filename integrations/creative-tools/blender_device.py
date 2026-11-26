"""Select one actual Cycles device from trusted runtime configuration.

This module imports no Blender runtime so selection can be tested with fixtures.
It never treats a requested backend as evidence that a device exists.
"""


class DeviceSelectionError(RuntimeError):
    pass


def select_cycles_device(bpy, scene, backend="CPU", device_index=0):
    if backend not in {"CPU", "CUDA", "OPTIX"} or isinstance(device_index, bool) \
            or not isinstance(device_index, int) or not 0 <= device_index <= 15:
        raise DeviceSelectionError("Invalid reviewed render device")
    if backend == "CPU":
        if device_index != 0:
            raise DeviceSelectionError("CPU rendering has no GPU index")
        scene.cycles.device = "CPU"
        return {"device": "CPU", "backend": "CPU", "deviceCount": 0}
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.compute_device_type = backend
        preferences.refresh_devices()
        devices = list(preferences.devices)
        # A container should expose only approved hardware. Within that boundary,
        # sort stable Cycles IDs and select exactly one matching GPU, never CPU.
        candidates = sorted((device for device in devices if device.type == backend),
                            key=lambda device: str(device.id))
        for device in devices:
            device.use = False
        if device_index >= len(candidates):
            raise DeviceSelectionError("Requested Cycles GPU is unavailable")
        selected = candidates[device_index]
        selected.use = True
        scene.cycles.device = "GPU"
        if preferences.compute_device_type != backend or not selected.use \
                or sum(bool(device.use) for device in devices) != 1:
            raise DeviceSelectionError("Cycles GPU selection could not be confirmed")
        return {"device": "GPU", "backend": backend, "deviceCount": 1,
                "deviceIndex": device_index, "deviceName": str(selected.name)[:80]}
    except DeviceSelectionError:
        raise
    except Exception as error:
        raise DeviceSelectionError("Configured Cycles backend is unavailable") from error
