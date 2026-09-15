# UV Lab loader additions

Three.js stays at r160. FBXLoader and fflate/NURBS dependencies originate from the official r160 examples. Existing Three.js and fflate MIT notices are retained.

FBXLoader has opt-in UV inspection patches: original control-point IDs, reflected geometric transform metadata, texture/blob suppression, bounded decoded arrays and triangulation, strict UV index validation, AllSame indexing, and release of temporary source trees. `uv-import.mjs` enables them only for browser-local inspection. No original material or texture files are requested.

The UV import and analysis run in a module worker. First UV set, static undeformed geometry only. Inputs are capped at 20 MiB and 60,000 triangles; FBX decoded arrays at 80 MiB. Missing UVs remain explicitly invalid. OBJ indices are preserved before projected polygon triangulation.

Point-sampled coverage is measured on a 512 × 512 grid; tiny overlaps may be missed. Texel density uses surface UV area including stacked faces; occupancy uses union coverage. Shape distortion is a scale-invariant singular-value ratio, aggregated per island by world-area-weighted geometric mean. Gap distance is bounded by boundary complexity and is not a mip-safe packing guarantee.

Upstream: https://github.com/mrdoob/three.js/tree/r160/examples/jsm
