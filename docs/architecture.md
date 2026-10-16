# Product and code architecture

Updated: 2026-10-16

This file describes the architecture that exists in the repository. Desired work is labeled **Next**; it must not be read as implemented behavior.

## Product boundary

Letmorph Studio is an independent 2D image motion editor. It does not create or consume Live2D/Cubism models. It preserves a flattened source image, lets the user define image-backed motion layers, evaluates procedural motion, composites frames, and exports video or an editable `.letmorph` project.

## Runtime layers

```text
React UI (`src/ui`)
  ├─ presents editor state and captures user input
  ├─ hooks own React lifecycle and temporary browser resources
  └─ CanvasPreview forwards canvas gestures and draws UI guides

Application workflows (`src/application`)
  ├─ create/validate a project from an image
  └─ validate and parse a portable project file

Domain (`src/domain`)
  ├─ CharacterProject: source metadata and canvas size
  └─ LayerDocument: layer collection, active layer, history, pure commands

Motion and rendering (`src/engine`, `src/platform/browser`)
  ├─ deterministic image motion and spatial deformation
  ├─ canvas renderer shared by preview and recording
  └─ browser image, video, and download adapters

Electron (`electron`)
  └─ narrow preload IPC for native dialogs and completed-file writes
```

React is allowed to compose screens and hold presentation-only state (tool, playback, guides, theme, form drafts, progress). Layer edits are domain transitions in `src/domain/layerDocument.ts`; the reducer is UI-framework independent. The renderer sends commands and displays the resulting document. Motion evaluation, geometry, masking, frame rendering, and project validation stay outside React components.

### Layer document

`LayerDocument` is the editable layer state for the current editor session:

- `items` is the ordered list of equally editable `MotionItem` layers. The `source` flag currently identifies the bottom source-image layer for compositing; it is a rendering role, not a different editing permission.
- `selectedItemId` identifies the active target for property changes and pen drawing.
- `history` stores bounded snapshots for Ctrl+Z. Transient slider/drag updates are grouped by UI checkpoints; layer add/remove/reorder and completed region edits create checkpoints in the domain reducer.
- `empty` describes a manually added layer with no content yet. Pen paths modify the selected item; drawing never creates an item implicitly.
- Imported image layers embed their image data URL and dimensions on the item.

`reduceLayerDocument` is pure and owns load, clear, select, add, update, remove, reorder, source restoration, checkpoint, and undo transitions. `createMotionItem` owns consistent defaults and `nextLayerName` owns layer naming. No canvas or React state is captured by these functions.

### Project and persistence boundaries

There are two current data structures with different jobs:

- `CharacterProject` in `src/domain/project.ts` contains the original image metadata and editable canvas dimensions. Its `parts`, `parameters`, and `clips` fields are currently empty scaffolding and are **not** the runtime motion model.
- `MotionItem[]` in `src/engine/evaluateImageMotion.ts` is the actual current layer and motion model used by preview and export.

`PortableProjectFile` in `src/application/portableProjectFile.ts` persists both structures, the original image as a data URL, selected layer, and video export preferences. The application module serializes the document to bytes and enforces the file-size limit before parsing imported files; it validates the archive before creating a browser `File`. Electron only reads/writes bytes after native dialogs. The project file is the editable source of truth once saved. Video is a derived artifact.

**Known model debt:** `CharacterPart`, `MotionParameter`, and `MotionClip` anticipate a future rig/timeline but are not connected to `MotionItem`, the editor, or `.letmorph` behavior. Do not add features to those types while the current runtime still uses `MotionItem`. A later schema migration should either integrate the concepts into one versioned document or remove unused scaffolding; changing the existing format requires a migration and compatibility review.

### Preview and video output

`evaluateImageMotion.ts` and `evaluateSpatialMorph.ts` are deterministic TypeScript evaluators. `canvasMotionRenderer.ts` draws the source underlay, image-backed layers, masks, trails, and spatial deformation. `CanvasPreview` and `recordVideo.ts` call the same frame renderer. The renderer owns image/mask caches and rendering failures; UI owns only presentation errors.

MP4 uses Mediabunny and WebCodecs H.264 encoding/muxing. WebM uses Chromium `MediaRecorder`. `electron/main.ts` receives encoded bytes and writes them to a path chosen through the save dialog. No GIF, AVI, standalone PNG sequence, mesh rig, hidden-pixel repair, or Live2D model export is implemented.

## Module ownership rules

| Area | Owns | Must not own |
|---|---|---|
| `src/ui` | React composition, accessibility, UI-only toggles and drafts, dispatching domain commands | layer mutation rules, image validation, geometry math, motion math, file parsing, encoding |
| `src/ui/hooks` | React lifecycle, async UI status, temporary URLs, export progress | duplicated domain state transitions or rendering algorithms |
| `src/application` | meaningful user workflows, input validation/coordination, persistence schemas | pass-through wrappers that only rename a call |
| `src/domain` | portable editor data, pure state transitions, undo semantics | DOM, React, Canvas, Electron, file dialogs |
| `src/engine` | deterministic geometry, pose evaluation, rendering-independent motion rules | UI and browser globals |
| `src/platform` | browser APIs and rendering/encoding adapters | editor workflow state |
| `electron` | OS dialogs and safe file I/O through validated IPC | motion or project-domain decisions |

When moving behavior, move its state ownership and rules, not just the function body. Prefer one canonical model and explicit commands over helper layers that forward the same arguments.

## Next architecture work

1. Put image-layer decoding/size checks behind an application workflow and browser image adapter; keep the asynchronous import race guard at the UI lifecycle boundary.
2. Make a single versioned editor document the persistence boundary, with explicit layer kinds and validation. Migrate `.letmorph` v1 instead of silently changing its shape.
3. Move source-image blob collection and native/browser save orchestration out of `App.tsx`; keep Electron limited to bytes and dialogs.
4. Remove or integrate the unused part/parameter/clip scaffolding after a migration path is chosen.
5. Break `App.tsx` into presentational panels only after state ownership is stable; moving JSX alone does not fix architecture.

## Security and licensing

Renderer code has no direct Node access. Keep context isolation and the narrow preload API. The app currently depends on React and Mediabunny at runtime; review their licenses and all transitive production dependencies before distributing a release. No network service or AI inference is required by the implemented path.
