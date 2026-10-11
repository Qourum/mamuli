# Mobile GLB geometry

Run `node tools/mobile-lod.mjs` from the repository root to regenerate all 19
`art/mobile/*_animated.glb` assets and `art/mobile/manifest.json` from their
`art/*_animated.glb` originals. The build tool uses the vendored MIT-licensed
meshoptimizer 1.1 WebAssembly simplifier; it needs no npm installation or Blender.
The vendored file was copied from Three's distributed
`examples/jsm/libs/meshopt_simplifier.module.js`. Its upstream API is documented at
<https://github.com/zeux/meshoptimizer/blob/v1.1/js/README.md>.

The desktop originals are untouched. Every scene node, material, image, clip,
keyframe, UV coordinate and surviving vertex deformation is retained. The
simplifier only selects existing vertices and changes triangle connectivity;
all vertex streams (including sparse and quantized morph targets) are remapped
together. Base and morph streams keep their source component types and
normalization. Image bytes are copied without resizing or recompression.

The geometry target is 55,000 triangles for the center, 20,000 for Oak Island
and 6,000 for each peripheral model. A 2.5% combined geometric/attribute error
ceiling and seam preservation take precedence over those targets. Small
independent meshes keep their complete geometry, including the center's ship,
birds, sails and particles. Six bounding extrema are locked. Exact duplicate
vertices are welded only when every base and morph attribute is identical.
There is no sloppy decimation, component pruning or permissive seam crossing.

The checked-in output has 214,467 triangles versus 902,474 in its 19 originals
(76.2% reduction); 254,849 versus 682,092 vertices (62.6% reduction). Center:
54,962 triangles. Oak: 19,109. Cheung Chau deliberately remains at 28,705 to
retain its many texture seams. The game currently uses 18 of these native
scenes and its own procedural whirlpool; the report also includes the unused
animated whirlpool so the asset family has a complete mobile counterpart.

Verification:

```
node tests/mobile-lod.mjs
node tests/mobile-lod-playback.js
```

The first test compares every mobile vertex's combined base/morph signature
against its source, checks byte-exact images/keyframes and retained scene
metadata, bounds, index validity and glTF vertex alignment. The second uses
the game's shipped Three/glTF loader to play every real animation clip.
Visual comparison at the intended camera and device size is also necessary:
these structural tests do not assert pixel-identical output or phone FPS.
