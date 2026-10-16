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
- [x] Move persisted `MotionItem` and motion setting types into `domain`; engine evaluators consume domain types rather than owning the data schema.
- [x] Replace runtime `source`/`empty` booleans with a discriminated layer kind and a domain `set-region` transition; preserve the old booleans only in the `.letmorph` v1 adapter.
- [x] Preserve old v1 `parts`/`parameters`/`clips` fields as opaque archive data and remove the unused parallel skeletal clip evaluator.
- [x] Image-layer validation and layer construction live in an application workflow; browser decoding and data-URL reading live behind the browser adapter.
- [x] Portable-project JSON serialization, schema validation, and import-size policy live in the application boundary.
- [x] Active project, layer state/history, and video export preferences are one `EditorDocument` aggregate with pure domain transitions.
- [x] `.letmorph` v1 reads into and writes from the runtime editor document through an adapter; the persisted format was not silently changed.
- [x] Browser image APIs and project/video file transfer are isolated in platform adapters; React code no longer calls Electron IPC or browser file APIs directly.
- [x] Project save composition reads the `EditorDocument` in an application workflow; App no longer manually assembles or encodes the project payload.
- [x] Pen coordinate conversion and polygon clipping are in the engine geometry module, outside React.
- [x] Extract the canvas preview/toolbar and item inspector into typed presentation components; editor state transitions remain in `App` and the domain reducer.
- [x] Extract the project/layer rail and top bar into typed presentation components; file inputs are owned by the rail component and state transitions remain at the composition root/domain.
- [x] Group slider keyboard edits into one undo checkpoint per focused control, while preserving separate checkpoints for later pointer interactions.
- [x] Architecture and user-flow documents distinguish current behavior from future direction.

## Compatibility rule

The structural refactor for the current feature set is complete. If a future change alters the persisted `.letmorph` shape, add a multi-version migration registry at that point. The current archive already has `formatVersion: 1`, and runtime-only model changes are translated by its adapter; a second runtime document version would duplicate the existing compatibility boundary today.

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
