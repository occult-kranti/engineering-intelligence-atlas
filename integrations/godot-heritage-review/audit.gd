extends SceneTree
## Runtime GLB import and PackedScene instantiation audit; never rewrites the input.
const SOURCE := "res://assets/source.glb"
const EXPECTED := "res://expected.json"
const RECEIPT := "res://engine-receipt.json"
var started_usec: int = 0

func _initialize() -> void:
	started_usec = Time.get_ticks_usec()
	call_deferred("_audit")

func vector_values(value: Vector3) -> Array:
	return [value.x, value.y, value.z]

func transform_values(value: Transform3D) -> Array:
	return [value.basis.x.x, value.basis.x.y, value.basis.x.z, 0.0, value.basis.y.x, value.basis.y.y, value.basis.y.z, 0.0, value.basis.z.x, value.basis.z.y, value.basis.z.z, 0.0, value.origin.x, value.origin.y, value.origin.z, 1.0]

func finish(report: Dictionary, code: int) -> void:
	report["elapsedMilliseconds"] = (Time.get_ticks_usec() - started_usec) / 1000.0
	report["trackedStaticMemoryBytes"] = OS.get_static_memory_usage()
	report["trackedStaticMemoryPeakBytes"] = OS.get_static_memory_peak_usage()
	report["memoryMeaning"] = "Godot tracked allocations; not OS RSS or GPU memory"
	var file: FileAccess = FileAccess.open(RECEIPT, FileAccess.WRITE)
	if file == null:
		push_error("Cannot write audit receipt")
		quit(2)
		return
	file.store_string(JSON.stringify(report, "\t") + "\n")
	file.close()
	print("HERITAGE_ENGINE_AUDIT " + JSON.stringify({"ok": code == 0, "receipt": RECEIPT}))
	quit(code)

func index_hash(indices: PackedInt32Array) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(indices.to_byte_array())
	return context.finish().hex_encode()

func _audit() -> void:
	var report: Dictionary = {"schemaVersion": 1, "engine": Engine.get_version_info(), "platform": OS.get_name(), "headless": true, "fpsMeasured": false, "importPath": "GLTFDocument runtime import, PackedScene.pack and instantiate; editor auto-LOD pipeline not invoked"}
	var expected: Variant = JSON.parse_string(FileAccess.get_file_as_string(EXPECTED))
	if not expected is Dictionary or FileAccess.get_sha256(SOURCE) != expected.get("inputSha256", ""):
		report["error"] = "Expected manifest or immutable source hash invalid"
		finish(report, 2)
		return
	report["inputSha256"] = expected["inputSha256"]
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var import_start: int = Time.get_ticks_usec()
	var error: Error = document.append_from_file(SOURCE, state)
	report["appendMilliseconds"] = (Time.get_ticks_usec() - import_start) / 1000.0
	if error != OK:
		report["error"] = "GLTFDocument append failed: " + str(error)
		finish(report, 2)
		return
	var generate_start: int = Time.get_ticks_usec()
	var imported: Node = document.generate_scene(state)
	if imported == null:
		report["error"] = "GLTFDocument generated no scene"
		finish(report, 2)
		return
	var packed := PackedScene.new()
	error = packed.pack(imported)
	if error != OK:
		imported.free()
		report["error"] = "PackedScene.pack failed"
		finish(report, 2)
		return
	var instance: Node = packed.instantiate()
	imported.free()
	root.add_child(instance)
	report["generatePackInstantiateMilliseconds"] = (Time.get_ticks_usec() - generate_start) / 1000.0
	var inspect_start: int = Time.get_ticks_usec()
	var stack: Array[Node] = [instance]
	var nodes: Array = []
	var surfaces: Array = []
	var vertices_total: int = 0
	var indices_total: int = 0
	var triangles_total: int = 0
	var colours_total: int = 0
	var mesh_instances: int = 0
	var finite: bool = true
	var indices_valid: bool = true
	var min_world := Vector3(INF, INF, INF)
	var max_world := Vector3(-INF, -INF, -INF)
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if node is Node3D:
			var node3d: Node3D = node
			var transform: Array = transform_values(node3d.global_transform)
			for component: float in transform:
				finite = finite and is_finite(component)
			nodes.append({"path": str(instance.get_path_to(node)), "localMatrixColumnMajor": transform_values(node3d.transform), "worldMatrixColumnMajor": transform})
		if not node is MeshInstance3D:
			continue
		var mesh_node: MeshInstance3D = node
		var mesh: Mesh = mesh_node.mesh
		if mesh == null:
			continue
		mesh_instances += 1
		for surface_index: int in range(mesh.get_surface_count()):
			var arrays: Array = mesh.surface_get_arrays(surface_index)
			var positions: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var indices := PackedInt32Array()
			if arrays[Mesh.ARRAY_INDEX] != null:
				indices = arrays[Mesh.ARRAY_INDEX]
			var colours := PackedColorArray()
			if arrays[Mesh.ARRAY_COLOR] != null:
				colours = arrays[Mesh.ARRAY_COLOR]
			var count: int = indices.size() if not indices.is_empty() else positions.size()
			var primitive_valid: bool = mesh.surface_get_primitive_type(surface_index) == Mesh.PRIMITIVE_TRIANGLES and count % 3 == 0
			indices_valid = indices_valid and primitive_valid
			var max_index: int = -1
			for index: int in indices:
				indices_valid = indices_valid and index >= 0 and index < positions.size()
				max_index = maxi(max_index, index)
			for position: Vector3 in positions:
				var world_position: Vector3 = mesh_node.global_transform * position
				finite = finite and position.is_finite() and world_position.is_finite()
				min_world = min_world.min(world_position)
				max_world = max_world.max(world_position)
			for colour: Color in colours:
				finite = finite and is_finite(colour.r) and is_finite(colour.g) and is_finite(colour.b) and is_finite(colour.a)
			vertices_total += positions.size()
			indices_total += indices.size()
			triangles_total += count / 3
			colours_total += colours.size()
			surfaces.append({"nodePath": str(instance.get_path_to(node)), "surface": surface_index, "vertices": positions.size(), "indexCount": indices.size(), "triangles": count / 3, "colourCount": colours.size(), "maximumIndex": max_index, "indicesSha256": index_hash(indices)})
	report["inspectionMilliseconds"] = (Time.get_ticks_usec() - inspect_start) / 1000.0
	report.merge({"vertices": vertices_total, "indexCount": indices_total, "triangles": triangles_total, "colourCount": colours_total, "surfaces": surfaces, "meshInstances": mesh_instances, "nodes": nodes, "allFinite": finite, "indicesValid": indices_valid, "worldBounds": {"minimum": vector_values(min_world), "maximum": vector_values(max_world)}})
	instance.free()
	report["sourceHashUnchanged"] = FileAccess.get_sha256(SOURCE) == expected["inputSha256"]
	finish(report, 0 if finite and indices_valid and surfaces.size() > 0 and report["sourceHashUnchanged"] else 1)
