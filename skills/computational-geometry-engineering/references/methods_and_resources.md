# Methods and resources

## Contents

- Representation choices
- Correctness and numerical robustness
- Tool routing
- Curriculum

## Representation choices

| Representation | Appropriate questions | Critical limitations |
|---|---|---|
| B-rep/NURBS | Exact CAD surfaces, features, trimming, engineering exchange | Kernel complexity, topology/tolerance interactions, conversion cost |
| CSG | Parametric solids and boolean construction | Evaluation/export tessellation and boolean robustness |
| Triangle/polygon mesh | Graphics, printing, inspection, geometry processing | Approximation, topology defects, units not inherent, self-intersection |
| Point cloud | Scanned/reconstructed geometry | No implicit topology or manufacturing surface |
| Implicit/SDF | Smooth fields, procedural shapes, robust blending | Isosurface extraction, resolution, and sign/normal conventions |
| Voxel/sparse volume | Volumetric data, simulation, medical/scientific fields | Resolution/memory, grid units, boundary accuracy |
| Parametric/feature model | Editable design intent and constraints | Solver stability, feature failure, proprietary semantics |
| Graph/half-edge | Topology, connectivity, adjacency, traversal | Does not alone establish geometric validity |

## Correctness and numerical robustness

Document algorithm assumptions, time/space complexity, degeneracies, approximation error, convergence criteria, and failure modes. Separate topological decisions from measured tolerances. Use robust orientation/incircle predicates or exact kernels for topology-critical operations. Shewchuk’s paper and code: https://www.cs.cmu.edu/~quake/robust.html. CGAL kernel/package documentation: https://www.cgal.org/.

Do not choose an epsilon by copying a previous project. Derive it from units, input precision, operation, and acceptable error; test scaled and translated inputs. Check convergence failure as a first-class outcome. When using optimization, distinguish feasible, locally optimal, globally optimal, bounded, and unproven results.

## Tool routing

- CGAL: exact/computational geometry and mesh algorithms; package-specific GPL/LGPL/commercial licensing.
- libigl: geometry-processing research and tutorials; dependency obligations vary — https://libigl.github.io/.
- geometry-central: modern surface-mesh geometry — https://github.com/nmwsharp/geometry-central.
- OpenMesh: mesh data structures — https://www.graphics.rwth-aachen.de/software/openmesh/.
- Open CASCADE: B-rep/CAD kernel — https://dev.opencascade.org/.
- trimesh: Python mesh inspection/analysis — https://trimesh.org/.
- PyVista: visualization/VTK workflows — https://docs.pyvista.org/.
- Open3D: point clouds/reconstruction — https://www.open3d.org/.
- Gmsh: finite-element mesh generation — https://gmsh.info/.
- Manifold: manifold construction/booleans — https://github.com/elalish/manifold.
- MeshLab: interactive inspection/repair — https://www.meshlab.net/.
- IfcOpenShell: IFC/openBIM processing — https://github.com/IfcOpenShell/IfcOpenShell.

Review current package licenses, supported representations, and validation limits before adoption.

## Curriculum

1. Linear algebra, calculus, probability, numerical conditioning, and SI units. BIPM SI reference: https://www.bipm.org/en/measurement-units.
2. Algorithms, data structures, topology, graphs, and discrete/computational geometry. de Berg et al.: https://www.springer.com/gp/book/9783540779735.
3. Differential/discrete geometry and geometry processing. CMU DDG: https://www.cs.cmu.edu/~kmcrane/Projects/DDG/; Polygon Mesh Processing: https://www.pmp-book.org/.
4. Numerical algorithms and robust predicates. Solomon, Numerical Algorithms; Shewchuk link above.
5. Domain layer: CAD kernels, graphics, architecture/fabrication, AM, robotics, or simulation. Use domain-specific standards and independent validation rather than treating geometry as sufficient.
