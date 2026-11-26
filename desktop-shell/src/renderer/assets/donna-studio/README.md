# Donna studio sculpture

Original procedural artwork generated with Blender. No third-party models, textures, fonts or HDR environments are used. Visual assets are CC0-1.0; the reproducible Python source is MIT.

This is a decorative illustration, not a representation of live agent activity or measured neural expert routing. Use semantic HTML for headings, labels and real status alongside the image. The scene reserves the left portion for that content.

Recreate from the repository root:

```sh
blender --background --python tools/donna-studio-asset.py -- --samples 256
```

The script deliberately uses Cycles CPU with four threads and a bounded render time. Pillow, if installed for `python3`, creates the WebP from the PNG without changing the composition. The `.blend` contains the full editable scene; the `.glb` contains only the sculpture. See `provenance.json` for observed version and actual render settings.
