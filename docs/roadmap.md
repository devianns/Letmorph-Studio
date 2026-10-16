# Roadmap

Updated: 2026-10-16

Status reflects behavior reachable in the current app, not the presence of an unused type or proposal. The [user flow](user-flow.md) is the product sequence; [architecture](architecture.md) is the module ownership source of truth.

## Current foundation — implemented

- [x] Vite + TypeScript + React + Electron desktop scaffold with a narrow preload boundary.
- [x] Import PNG/JPEG/WebP, inspect image metadata, preserve source and create a project.
- [x] Layer list with source, empty, and imported-image items; select, add, rename, visibility, order, delete, and restore.
- [x] Pen polygon selection on the active item, whole-item motion, boundary editing, zoom/pan, and undo snapshots.
- [x] Per-item motion presets, axis tuning, spatial morph, position/size, mask-edge adjustments, and trails.
- [x] Shared canvas frame rendering for preview and video encoding.
- [x] MP4 H.264 via Mediabunny/WebCodecs and WebM via MediaRecorder; file-size protection and repeat count.
- [x] Portable `.letmorph` v1 import/export with embedded source/additional images, layer state, selected layer, and video preferences.
- [x] Pure TypeScript `LayerDocument` command reducer owns layer collection, selection, order, and bounded undo history.
- [x] Architecture and user-flow documents distinguish current behavior from future direction.

## Next — stabilize the project model

- [ ] Add explicit tests when requested for layer reducer transitions, undo grouping, and project round trips.
- [ ] Introduce one versioned persisted editor document and migrate `.letmorph` v1; keep runtime and persistence layer identity aligned.
- [ ] Replace optional `source`/`empty` booleans with an explicit layer-kind model as part of that migration.
- [ ] Move additional image-layer decode/validation and project save/load coordination out of `App.tsx` into meaningful workflows and adapters.
- [ ] Make property-editor edits group reliably into one undo checkpoint, including text input and keyboard interaction.
- [ ] Split `App.tsx` into presentation panels after state ownership and workflows are stable.

## Later — improve image editing and motion

- [ ] Add reversible mask brush/erase and better edge editing.
- [ ] Add explicit overdraw/hidden-pixel repair for moving cutouts.
- [ ] Add separate per-layer pivots and parent/child transforms if the project model supports them.
- [ ] Add mesh deformation, key poses, reusable timeline clips, and constraints as a coherent persisted model.
- [ ] Add GIF, transparent PNG sequence, still image, and sprite-sheet exporters with documented target limits.

## Not implemented

- Semantic part segmentation or AI image generation.
- Hidden-pixel reconstruction from a flattened image.
- Live2D/Cubism import/export or compatibility.
- GIF/AVI output, audio, skeletal rig editor, and keyframe timeline.
