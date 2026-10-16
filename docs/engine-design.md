# Motion engine design

Updated: 2026-10-16

This file records the implemented rendering path and a bounded future direction. The authoritative module map is [architecture.md](architecture.md); user steps and current limits are in [user-flow.md](user-flow.md).

## Implemented engine path

```text
LayerDocument + source image + canvas size + timestamp
  → evaluateImageMotion / evaluateSpatialMorph
  → canvasMotionRenderer
  → preview canvas or video encoder
```

- `src/engine/evaluateImageMotion.ts` evaluates deterministic whole-layer procedural motion from a time, preset, amount, speed, and axis tuning.
- `src/engine/evaluateSpatialMorph.ts` computes deterministic spatial deformation for supported polygon/image regions.
- `src/engine/smoothPolygon.ts` and `src/engine/clipPolygon.ts` hold geometry operations independent of React.
- `src/platform/browser/canvasMotionRenderer.ts` composites the source and editable image layers, applies masks, trails, and deformation, and owns render caches.
- `src/ui/CanvasPreview.tsx` handles canvas interaction and editor guides. `src/platform/browser/recordVideo.ts` samples the same frame renderer for output.
- MP4 encoding uses Mediabunny with WebCodecs H.264; WebM uses Chromium MediaRecorder. The Electron process only opens a save dialog and writes the already-encoded output bytes.

The evaluator is deterministic for the same inputs and timestamp. Preview is interactive and may drop display frames under load; export samples fixed timestamps at the selected FPS. Both paths use the same frame-rendering algorithm, but preview timing and encoder output are not identical execution environments.

## Current image and layer model

The source image is a full raster. A layer can reference the source image, contain an additional embedded image, or be an empty user-created target. A normalized closed polygon, when present, masks pixels from that layer's image. Selected pixels render as a moving copy above the unchanged source/composite.

This is a 2D cutout overlay technique, not skeletal rigging. It preserves the original and avoids making holes, but it cannot synthesize hidden artwork. At large offsets, duplicated edges or visible underlying artwork may look unnatural. The engine must not imply otherwise.

The editor's `LayerDocument` now owns ordered layers, selection and undo snapshots through pure TypeScript commands. `MotionItem` remains the renderer's motion-bearing layer data. The older `CharacterPart`/`MotionClip` types are not connected to this runtime and are only scaffolding.

## Extension rules

- Keep evaluators deterministic and independent of React, DOM, and Electron.
- Keep all geometry in documented coordinate spaces; convert pointer coordinates at the editor boundary and store normalized image coordinates.
- Keep layer identity stable across reorder and selection. Commands target IDs rather than array positions.
- Treat caches as derived data keyed by image identity and every geometry/render setting that affects pixels. Caches never become project source data.
- Keep preview/export on the same composition path. Add a separate path only with visual parity evidence and a clear reason.
- Validate imported project data at the persistence boundary. Persist user-editable values, not canvases, object URLs, or renderer caches.
- Avoid pass-through application wrappers. An application module should coordinate a user workflow or enforce a boundary; otherwise call the concrete domain or platform API directly.

## Planned evolution

1. Define a single versioned editor document that contains canvas/source metadata, stable layer records, layer assets/masks, and export preferences. Migrate `.letmorph` v1 explicitly.
2. Use a discriminated layer kind instead of optional `source`/`empty` booleans once migration and compositor roles are designed. Make every user-facing edit capability consistent across kinds.
3. Add brush/erase boundary editing and optional overdraw repair as explicit, reversible image operations.
4. Consider mesh deformation, parent-child transforms, and timeline tracks only after project persistence and runtime evaluation use one model.
5. Evaluate libraries and redistribution obligations before adopting a new renderer or encoder. Preserve a documented dependency inventory for commercial distribution.

## Explicitly out of scope for the current engine

The current runtime does not implement Live2D/Cubism formats, semantic part detection, hidden-pixel reconstruction, a skeleton/mesh rig editor, GIF/AVI output, or an audio track.
