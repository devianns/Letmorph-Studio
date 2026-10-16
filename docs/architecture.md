# Product and engine architecture

Updated: 2026-10-16

## Product goal

Build a Windows desktop editor and motion engine that turns a static character illustration into a controllable, animated 2D character. The application is the structured middle layer between the image and rendered media. It stores editable parts, masks, spatial relationships, motion controls, and clips, then evaluates and renders them consistently.

The user-facing promise is deliberately simple: “Bring a picture, make a character move, and save your own animated character.” Keep implementation concepts such as meshes, pivots, tracks, and constraints inside the engine unless a user opens an advanced editing tool. The main path should use sensible defaults and guided, reversible steps; users should not need prior animation experience.

### User journey

1. Add an image and see it safely preserved in the project.
2. Let the app prepare a movable character and suggest useful parts.
3. Review/fix the result with direct visual tools and plain-language guidance.
4. Choose a starter movement or adjust the character with approachable controls.
5. Preview, optionally refine, then save the project or export a GIF/video.

Measure success by how quickly a first-time user can produce a character clip they like, not by how many engine controls are exposed.

This is an independent technology. It does not use Live2D/Cubism and does not need to interoperate with Cubism. Use “2D character motion engine” or “animated 2D puppet” to describe the product and its output.

## What the engine needs to do

### 1. Import and preparation

- Accept common raster formats first (PNG, JPEG, WebP); preserve the source image and record its dimensions/color profile.
- Make a working copy and show image bounds, zoom, and background controls.
- Future PSD import should preserve groups, visibility, ordering, and layer pixels where feasible. Official Cubism guidance expects PSD layers organized by parts and flattened per-part artwork; masks and blend-mode handling have constraints.
- Report import limitations and never silently flatten the user's only copy.

### 2. Part separation

- Use deterministic image selection: existing alpha, click-to-select color-connected background, polygon lasso, and add/remove brush. These select pixels by explicit rules and do not infer semantic parts.
- Let the user identify and name movable areas such as hair, head, body, and arms. Keep part masks editable with brush/erase, polygon selection, edge cleanup, feathering, and undo/redo.
- Consider optional edge-follow or superpixel selection helpers later; they must remain explainable pixel/edge rules, not a required AI model.
- Let users paint hidden pixels behind foreground parts (“overdraw”) to avoid holes when parts move. This repair work is necessary when starting from a flattened illustration.
- Represent each part with an RGBA image/mask, z-order, visibility, opacity, pivot, semantic label, and provenance.

### 3. Character graph and deformation

- Convert each part to a mesh with user-adjustable vertices and triangulation. Keep mesh topology separate from source pixels.
- Model the character as a graph: each part has a stable ID, image/mask, z-order, pivot, parent, transform, and optional mesh/deformer.
- Provide parent/child transforms, pivots, warp/deform handles, clipping masks, and parameter-driven key poses.
- Start with practical controls: head angle X/Y/Z, body angle, eye open, mouth open, brow, and hair/accessory sway.
- Interpolate parameter snapshots to produce motion. Physics can be a later, bounded spring/pendulum simulation with stable deterministic preview/export settings.
- The runtime engine evaluates the graph and motion clips on a timeline, applies constraints/deformers, and composites parts into each frame. Keep this evaluator independent of the UI so preview and export use the same behavior.

### 4. Motion engine, preview, and export

- Support a timeline with keyframes, clips, loop settings, and preview playback. A motion clip should be a reusable sequence of parameter and transform tracks, not a hard-coded UI animation.
- Use one deterministic frame-evaluation interface for interactive playback and offline export. Given project state, clip, and timestamp, it returns the pose to render.
- Export the editable native project plus raster animation outputs such as PNG sequence, GIF, and video. Provide transparent-background controls where the target format supports them.
- Add still PNG and sprite sheet exports as useful adjacent outputs.
- Keep export options explicit: dimensions, frame rate, duration, loop, background, and quality.
- Animation media (including GIF) is a first-class product result. The native project remains the editable source and media files are rendered output.

## Proposed application structure

```text
React renderer
  ├─ workflow UI (Import, Parts, Rig, Animate, Export)
  ├─ editor state and command/undo stack
  ├─ 2D canvas renderer (WebGL/canvas abstraction)
  └─ typed preload API
       └─ Electron main process
            ├─ native file dialogs and safe project I/O
            ├─ project I/O and validation
            ├─ export job orchestration
            └─ future local segmentation/render worker
```

Keep browser-facing modules independent of Electron. The preload bridge exposes narrow operations (open image, open/save project, choose export location) and validates IPC payloads. Renderer code must not access Node APIs directly.

### Code ownership in the current implementation

- `src/ui/`: React components render state and forward user actions. They must not contain image decoding, image validation rules, project construction, motion interpolation, or export algorithms.
- `src/ui/hooks/`: React lifecycle and screen state only; call application use cases and manage temporary UI resources such as preview URLs.
- `src/application/`: TypeScript use cases that coordinate domain operations through injected dependencies.
- `src/core/` and `src/domain/`: framework-independent validation rules and project/motion data structures.
- `src/platform/`: browser or Electron adapters for APIs such as image decoding, temporary URLs, file access, and export encoders.
- `src/engine/`: deterministic pose evaluation and later character/motion runtime. Keep it independent of React so preview and file export can share it.

Current first slice: `application/createCharacterProject.ts` validates an image through `core/image/validateImage.ts`, gets dimensions from `platform/browser/inspectImage.ts`, and produces typed project state. React calls it through `ui/hooks/useCharacterProject.ts`. Import creates a selected `MotionItem` for the source image. Further whole-image copies and normalized polygon masks are additional items, each with independent visibility and motion controls. The preview board fits the available viewport; zoom and pan transform the board while pen points stay normalized to the source image bounds. `platform/browser/canvasMotionRenderer.ts` renders the source item with its own pose, then composites cached masked copies above it using the shared deterministic pose evaluator. Preview and WebM recording call the same renderer. Native project persistence, per-vertex mask editing, and image repair are not implemented.

### Suggested domain modules

- `domain/project`: versioned document schema, migrations, validation.
- `import`: image decode, format checks, optional PSD adapter.
- `segmentation`: provider interface and manual mask tools.
- `character`: parts, mesh, transform hierarchy, constraints, parameters.
- `motion`: timeline, tracks, interpolation, clips, deterministic evaluation.
- `engine`: connects project state, character graph, motion evaluation, constraints, and renderer through a stable API.
- `render`: preview and offscreen frame rendering using the same pose evaluator.
- `export`: project archive, PNG/GIF/WebM/sprite sheet adapters.
- `electron`: filesystem and OS integration only.

## Native project data model (initial proposal)

Use a versioned JSON manifest plus referenced image assets in a portable project archive. The manifest should store stable IDs, canvas dimensions, part asset/mask references, z-order, parent-child relationships, pivots, rest transforms, mesh vertices/indices, constraints, parameter definitions and ranges, motion tracks/keyframes, clips, and export metadata. Store original source separately from derived/painted assets. Include schema version and migration path from the first persisted version.

Do not bake volatile absolute machine paths into project references. Use relative asset paths and validate all archive paths when reading projects.

The first TypeScript schema is in `src/domain/project.ts`. `src/engine/evaluate.ts` provides the initial pure pose-evaluation API for part transform/opacity tracks and bounded parameters. It is an engine foundation, not yet a complete renderer: mesh deformation, hierarchy composition, constraints, project validation, and UI/export integration remain future work. See [engine design](engine-design.md) for the proposed image-to-character process, low-level rendering boundary, license review approach, and implementation order.

The first end-to-end animation slice uses `src/engine/evaluateImageMotion.ts` to evaluate per-item procedural movement and `src/platform/browser/canvasMotionRenderer.ts` to render the source image as the default base item, followed by whole-image or polygon-masked copies above it. `src/platform/browser/recordVideo.ts` records repeated 2.4-second cycles from the same frame renderer with Chromium `MediaRecorder`; the user selects 1–25 repetitions (up to 60 seconds) and MP4 or WebM from formats reported as supported. The recorder rejects an unavailable requested format rather than silently changing containers. AVI is not implemented. The Electron main process writes the chosen file after a save dialog. Polygon feathering is clipped to the raw user-drawn mask so the effect remains inside the selected boundary. The first editor supports multiple session-level items, tool selection, closed pen masks, and item-level controls. PixiJS mesh rendering remains a later option when independently moving parts and mesh deformation are implemented.

## Important constraints and risks

- A single flattened raster has no recoverable hidden artwork. Automated segmentation can propose masks but cannot reliably reconstruct occluded regions; user cleanup is part of the workflow.
- Plausible movement needs adequate part separation, mesh topology, overlap repair, deformation, and tuning. An image split alone will look like paper cutouts.
- Motion must be represented as data and evaluated by the engine, rather than being implemented as one-off effects in screen components. This is what makes characters editable and motions reusable.
- User images can be sensitive. Default to local storage/processing and avoid telemetry or uploads without informed opt-in.

## References

- [Cubism PSD import](https://docs.live2d.com/en/cubism-editor-manual/psd-import/) and [illustration preparation tutorial](https://docs.live2d.com/4.2/en/cubism-editor-tutorials/psd/): reference examples for how character artwork can be separated into movable parts. The app does not import/export Cubism model files.

