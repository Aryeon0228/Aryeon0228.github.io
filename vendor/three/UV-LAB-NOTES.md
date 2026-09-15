# UV Lab loader additions

Three.js stays at r160. FBXLoader and fflate/NURBS dependencies originate from the official r160 examples. Existing Three.js and fflate MIT notices are retained.

FBXLoader has opt-in UV inspection patches: original control-point IDs, reflected geometric transform metadata, texture/blob suppression, bounded decoded arrays and triangulation, strict UV index validation, AllSame indexing, and release of temporary source trees. `uv-import.mjs` enables them only for browser-local inspection. No original material or texture files are requested.

The UV import and analysis run in a module worker. First UV set, static undeformed geometry only. Inputs are capped at 20 MiB and 60,000 triangles; FBX decoded arrays at 80 MiB. Missing UVs remain explicitly invalid. OBJ indices are preserved before projected polygon triangulation.

Point-sampled coverage is measured on a 512 × 512 grid; tiny overlaps may be missed. Texel density uses surface UV area including stacked faces; occupancy uses union coverage. Shape distortion is a scale-invariant singular-value ratio, aggregated per island by world-area-weighted geometric mean. Gap distance is bounded by boundary complexity and is not a mip-safe packing guarantee.

Upstream: https://github.com/mrdoob/three.js/tree/r160/examples/jsm

## Pixel inspection

`uv-grid.mjs` reports UV boundary axis alignment separately from the angle between physical U/V texel axes on each triangle. Axis tolerance is 2 degrees; orientation is not a texel-boundary snap test. Orthogonal anisotropic UVs can have zero shear while changing aspect ratio.

`uv-color-atlas.mjs` rasterizes real-resolution opaque island colours at texel centres in a disposable worker. It preserves first-face ownership and a stable seeded palette, tracks original and padded texels separately, and uses nearest-original-source Euclidean padding. A work budget rejects excessive scanline work instead of silently lowering resolution. A direct picker follows the same ownership and padding rule without retaining another atlas-sized ID buffer.

Colour inspection uses an unlit material, nearest or bilinear sampling, and clamped atlas edges. Missing UVs and out-of-tile fragments bypass the texture. Selection is an outline so it does not tint sampled colours. Mipmaps and compression are outside this experiment. Typed RGBA buffers transfer from the worker; the worker terminates after each completed/replaced request.
