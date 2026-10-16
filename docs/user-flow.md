# User flow and implementation status

Updated: 2026-10-16

This document separates the working flow from the longer product direction. The app currently produces animated image layers and video; it does not split a flattened image into semantic body parts.

## Current Input → Program → Output flow

```text
PNG / JPG / WebP
  → project and source-image layer
  → add/select an empty or image layer
  → draw a closed region on that selected layer (or use its full image)
  → tune motion, position, size, mask edge and trails
  → preview the composed canvas
  → export MP4 / WebM, or save/reopen the editable .letmorph project
```

1. **Import:** Load a PNG, JPEG, or WebP image. The source stays intact and becomes the bottom image layer with a default motion preset.
2. **Build layers:** Add an empty layer manually, or import another raster image. Selecting a layer sets the target for all layer operations. Drawing never creates a layer by itself.
3. **Define a region:** Choose pen mode and draw a closed polygon on the selected layer, or apply motion to the whole layer. Region points are stored in normalized layer-image coordinates. The renderer copies selected pixels above the unchanged source image; this avoids destructive source editing but can show seams where the copied area moves.
4. **Tune and arrange:** Rename, show/hide, reorder, delete, position, resize, set a motion preset and axis strengths, spatial morph, trail and mask-edge controls. Ctrl+Z restores the previous layer snapshot. Layer selection is preserved independently from the active drawing tool.
5. **Preview:** Playback, guide visibility, zoom, pan and boundary editing affect the editor view. Preview and video export use the same canvas frame renderer.
6. **Save output:** Export MP4 (H.264 via Mediabunny/WebCodecs) or WebM (Chromium MediaRecorder), with repeat count and 512 MB estimated/actual size protection. Save the editable project separately as `.letmorph`, including source image, layer definitions, selected layer and video preferences.

### Important behavior and limits

- Layers share the same edit controls. The source layer has a compositor role as the unchanged bottom artwork, but it is not locked from selection, drawing, motion, sizing, or deletion.
- A polygon selects pixels from the selected item's own image. A missing or empty image layer cannot produce a visible cutout until it has image content.
- Region pixels are duplicated over the original. This does not reconstruct hidden pixels or erase the original region, so large displacements can reveal overlap/double-image artifacts.
- `CharacterProject.parts`, `parameters`, and `clips` are not used by the current screen, renderer, or project-file behavior.
- GIF, AVI, transparent export, semantic part separation, hidden-pixel repair, mesh deformation, and Live2D/Cubism interchange are not current outputs.

## Intended user experience

The long-term user goal remains simple: import a picture, mark what should move, choose a motion, preview it, and save both a reusable editable project and a shareable animation. Controls should use plain language, sensible defaults, visible drawing-target feedback, and undoable changes. Avoid making users learn rigging terminology.

The product should state clearly when a flattened image lacks pixels behind a moving part. Selection is deterministic and user-directed; no AI inference is required or implied.

## Implementation sequence

1. Stabilize the current editor document and layer commands as the canonical editable model.
2. Define a versioned project-document schema that directly represents the runtime layers. Add a migration from current `.letmorph` v1 before changing persistence.
3. Move image-layer decoding and validation out of `App.tsx` into an application workflow and browser adapter.
4. Separate project archive serialization/validation from platform file dialogs and byte writes.
5. Add non-destructive mask editing and undo semantics, then image repair only as an explicit user tool.
6. Add advanced rigging/timeline concepts only when they map to a reachable workflow and the renderer can evaluate them consistently in preview and export.

Each implementation change updates this document, [architecture.md](architecture.md), and [roadmap.md](roadmap.md) when their claims change.
