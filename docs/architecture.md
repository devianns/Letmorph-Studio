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
  ├─ validate and prepare an image motion layer
  └─ serialize, validate, and parse a portable project file

Domain (`src/domain`)
  ├─ EditorDocument: active project, layers, history, export preferences
  ├─ MotionItem: persisted layer and motion data
  └─ pure editor and layer commands

Motion and rendering (`src/engine`, `src/platform/browser`)
  ├─ deterministic image motion and spatial deformation
  ├─ canvas renderer shared by preview and recording
  └─ browser image, project/video transfer, and download adapters

Electron (`electron`)
  └─ narrow preload IPC for native dialogs and completed-file writes
```

React is allowed to compose screens and hold presentation-only state (tool, playback, guides, theme, form drafts, progress). Layer edits are domain transitions in `src/domain/layerDocument.ts`; the reducer is UI-framework independent. The renderer sends commands and displays the resulting document. Motion evaluation, geometry, masking, frame rendering, and project validation stay outside React components.

`src/ui/App.tsx` is the editor composition root: it coordinates workflows, dispatches domain commands, and owns presentation-only state. The top bar, project/layer control rail, canvas preview, and per-item inspector are separate components in `src/ui/components/` with typed props. They present values and emit callbacks; they do not own layer state or mutate the editor document.

### Layer document

`EditorDocument` is the current runtime aggregate for the editor:

- `project` contains source metadata and canvas dimensions.
- `layers` contains the ordered layer document, selected layer, and session undo history.
- `exportSettings` contains the selected video format and repeat count.

The reducer in `src/domain/editorDocument.ts` handles new project creation, project restore, canvas resizing, export preferences, layer commands, and reset. The `.letmorph` v1 adapter serializes this runtime aggregate into its existing file shape. The file format remains v1; the adapter translates legacy layer booleans to the current kind and preserves legacy archive arrays opaquely.

`LayerDocument` is the nested editable layer state:

- `items` is the ordered list of equally editable `MotionItem` layers. Its discriminated `kind` is `source`, `empty`, `cutout`, or `image`; commands cannot change a kind through a generic property update.
- `selectedItemId` identifies the active target for property changes and pen drawing.
- `history` stores bounded snapshots for Ctrl+Z. Transient slider/drag updates are grouped by UI checkpoints; layer add/remove/reorder and completed region edits create checkpoints in the domain reducer.
- `empty` describes a manually added layer with no content yet. A domain `set-region` command turns it into a source-backed `cutout`; pen paths modify the selected item and drawing never creates an item implicitly.
- Imported image layers embed their image data URL and dimensions on the item.

`reduceLayerDocument` is pure and owns load, clear, select, add, update, set-region, remove, reorder, source restoration, checkpoint, and undo transitions. Generic property updates cannot change layer identity or kind. `createMotionItem` owns consistent defaults and `nextLayerName` owns layer naming. `mapSelectionToLayer.ts` owns pen coordinate conversion and clipping. No canvas or React state is captured by these functions.

### Project and persistence boundaries

There are two current data structures with different jobs:

- `CharacterProject` in `src/domain/project.ts` contains the original image metadata and editable canvas dimensions. `ImageDimensions` in `src/domain/image.ts` is shared data. The old v1 `parts`, `parameters`, and `clips` archive fields are held as opaque legacy data for lossless round trips; they are not the runtime motion model.
- `MotionItem` in `src/domain/motionItem.ts` is the actual current layer and motion model used by preview and export. `src/engine/evaluateImageMotion.ts` only evaluates that data into a pose.

`PortableProjectFile` in `src/application/portableProjectFile.ts` is a v1 persistence adapter over `EditorDocument`. Saving reads the aggregate, includes the source image through an injected reader, and produces a complete project payload; loading validates the legacy archive, converts it to `EditorDocument`, and returns the embedded source data URL. `platform/browser/inspectImage.ts` reads browser files, materializes the source `File`, and manages image URLs. The React hook coordinates that workflow and replaces the runtime document after the source preview loads. Application parsing/serialization has no DOM or Electron dependencies. `projectFileTransfer.ts` and `videoFileTransfer.ts` encode/transfer the completed payload and choose browser downloads or narrow Electron bridge calls. The project file is the editable source of truth once saved. Video is a derived artifact.

The unused `evaluate.ts` skeletal clip evaluator and its competing runtime types were removed. Future rig or timeline work must start from the current `MotionItem` model and a deliberate persistence design rather than reviving the abandoned parallel model.

### Preview and video output

`evaluateImageMotion.ts` and `evaluateSpatialMorph.ts` are deterministic TypeScript evaluators over domain data. `canvasMotionRenderer.ts` draws the source underlay, image-backed layers, masks, trails, and spatial deformation. `CanvasPreview` and `recordVideo.ts` call the same frame renderer. The renderer owns image/mask caches and rendering failures; UI owns only presentation errors.

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

1. Add a multi-version `.letmorph` migration registry when a persisted file shape actually changes. The current archive already carries `formatVersion: 1`; the new runtime layer kind is translated at the v1 adapter, so a second runtime version would currently duplicate that boundary.
2. Add reducer and archive round-trip tests when the user requests verification work; no test suite is currently part of the requested change.

## Security and licensing

Renderer code has no direct Node access. Keep context isolation and the narrow preload API. The app currently depends on React and Mediabunny at runtime; review their licenses and all transitive production dependencies before distributing a release. No network service or AI inference is required by the implemented path.
