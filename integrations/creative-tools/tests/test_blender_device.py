"""Device-selection fixtures only; no Blender, driver, render, or GPU required."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location("blender_device", Path(__file__).resolve().parents[1] / "blender_device.py")
device_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(device_module)


def fixture(devices):
    preferences = SimpleNamespace(devices=devices, compute_device_type="NONE", refresh_devices=lambda: None)
    bpy = SimpleNamespace(context=SimpleNamespace(preferences=SimpleNamespace(addons={"cycles": SimpleNamespace(preferences=preferences)})))
    return bpy, SimpleNamespace(cycles=SimpleNamespace(device="CPU")), preferences


def device(identifier, kind):
    return SimpleNamespace(id=identifier, name=f"Fixture {identifier}", type=kind, use=True)


class BlenderDeviceTests(unittest.TestCase):
    def test_cpu_default_requires_no_gpu_discovery(self):
        scene = SimpleNamespace(cycles=SimpleNamespace(device="GPU"))
        result = device_module.select_cycles_device(SimpleNamespace(), scene)
        self.assertEqual(result, {"device": "CPU", "backend": "CPU", "deviceCount": 0})
        self.assertEqual(scene.cycles.device, "CPU")

    def test_selects_one_sorted_gpu_and_disables_cpu_and_other_backends(self):
        devices = [device("cpu", "CPU"), device("gpu-b", "OPTIX"), device("gpu-a", "OPTIX"), device("gpu-a-cuda", "CUDA")]
        bpy, scene, preferences = fixture(devices)
        result = device_module.select_cycles_device(bpy, scene, "OPTIX", 1)
        self.assertEqual(result["device"], "GPU")
        self.assertEqual(result["backend"], "OPTIX")
        self.assertEqual(result["deviceCount"], 1)
        self.assertEqual(result["deviceIndex"], 1)
        self.assertEqual(result["deviceName"], "Fixture gpu-b")
        self.assertEqual([row.id for row in devices if row.use], ["gpu-b"])
        self.assertEqual(scene.cycles.device, "GPU")
        self.assertEqual(preferences.compute_device_type, "OPTIX")

    def test_cuda_selection_does_not_select_an_optix_device(self):
        devices = [device("a", "OPTIX"), device("b", "CUDA")]
        bpy, scene, _ = fixture(devices)
        self.assertEqual(device_module.select_cycles_device(bpy, scene, "CUDA")["backend"], "CUDA")
        self.assertEqual([row.id for row in devices if row.use], ["b"])

    def test_absent_gpu_fails_without_cpu_fallback(self):
        devices = [device("cpu", "CPU")]
        bpy, scene, _ = fixture(devices)
        with self.assertRaises(device_module.DeviceSelectionError):
            device_module.select_cycles_device(bpy, scene, "OPTIX")
        self.assertFalse(any(row.use for row in devices))

    def test_out_of_range_device_and_unsupported_backend_fail(self):
        bpy, scene, _ = fixture([device("a", "CUDA")])
        for backend, index in [("CUDA", 1), ("AUTO", 0), ("CPU", 1), ("OPTIX", True), ("CUDA", 16)]:
            with self.subTest(backend=backend, index=index), self.assertRaises(device_module.DeviceSelectionError):
                device_module.select_cycles_device(bpy, scene, backend, index)

    def test_backend_initialization_error_is_not_a_cpu_success(self):
        bpy, scene, preferences = fixture([device("a", "OPTIX")])
        def unavailable():
            raise RuntimeError("synthetic unavailable driver")
        preferences.refresh_devices = unavailable
        with self.assertRaises(device_module.DeviceSelectionError):
            device_module.select_cycles_device(bpy, scene, "OPTIX")


if __name__ == "__main__":
    unittest.main()
