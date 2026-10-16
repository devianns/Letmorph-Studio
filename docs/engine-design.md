# 2D character motion engine: implementation proposal

Status: Proposed; dependencies and quality assumptions need validation in small prototypes.

This document describes how to turn an ordinary flat image into an editable character that can move and be rendered as a short animated clip, without AI models or network services. The UI remains a React workflow. The character model, selection/mask tools, pose evaluation, mesh deformation, and export are TypeScript modules outside React components.

## Short answer

Treat a character as a stack of transparent image parts. Give each part a center of movement and optional deformable mesh. Store which parts follow which other parts, and store reusable movement as data. For every preview/export time, the engine evaluates one pose, deforms the parts, and draws them from back to front.

The hard part is preparing a single flat image: it has no separate eyes/arms/hair layers and contains no pixels behind occluding parts. Deterministic image algorithms can select by transparency, color, connected edges, and user-drawn boundaries. They cannot infer that a region is semantically hair or an arm; users identify those parts through simple visual tools. Hidden-art repair is needed for convincing motion.

## Rendering and dependency direction

### Recommended first renderer: PixiJS mesh renderer behind our own interface

Use PixiJS as a drawing backend, not as the character engine. Its MIT-licensed v8 renderer exposes mesh geometry (vertices, UV texture coordinates, triangle indices), shader controls, and deformable mesh types. Our TypeScript engine still owns the project format, part graph, animation rules, constraints, and frame evaluation. Keep Pixi-specific objects in `src/platform/rendering/pixi/` behind a small `CharacterRenderer` interface so another backend can replace it later.

For the smallest proof of concept, direct WebGL2 is also viable and gives more control, but it means we must write texture upload, mesh buffers, batching, masks, context loss, and GPU cleanup ourselves. That is a lot of infrastructure before a user can make a character. Start with PixiJS mesh APIs; revisit a custom WebGL2 renderer only if the prototype identifies a concrete limitation.

PixiJS package metadata and mesh docs currently list MIT and describe direct geometry/UV/index access. MIT is a permissive license that allows commercial use with its notice requirements; it does not remove the need to inventory transitive dependencies and include third-party notices in a distributed app.

### Proposed stack boundary

```text
React workflow UI
  └─ calls application use cases, displays progress and preview
       ├─ TypeScript character/project domain
       ├─ TypeScript segmentation + mask editing
       ├─ TypeScript motion evaluator and deformation engine
       ├─ renderer port
       │    └─ PixiJS adapter (mesh drawing, texture upload, offscreen frame)
       └─ export port
            └─ GIF encoder adapter (candidate: gifenc, MIT)
Electron main/preload: dialogs, safe project I/O, output path selection
```

Do not put transforms, animation timing, mask rules, or export frame generation inside React components. UI actions create commands (e.g. `MovePivot`, `PaintMask`, `SetClipSpeed`) which update typed project state; the engine consumes that state.

## How one flat image becomes movable

### 1. Keep the source and make a working canvas

Keep the original image unchanged. Create project-owned working pixels and masks. Show a transparent checkerboard or solid background so the user can see what is selected.

### 2. Find the character silhouette with image rules, not AI

Use deterministic selection tools that run on the pixels the user supplied and do not download or call a model:

- If the source has transparency, use its alpha channel as the initial silhouette.
- For a flat/solid background, let the user click the background. Starting from that border pixel, flood-fill neighboring pixels whose color is within a tolerance; use perceptual Lab distance rather than raw RGB when practical. Invert the connected result to select the foreground and show a tolerance slider with a live preview.
- For busy backgrounds, use a polygon lasso or add/remove brush. A future edge-follow tool can run a shortest-path search between user clicks, preferring strong image edges.
- Always provide add/remove brush, undo, and reset. The user confirms the selection before it becomes the character mask.

These rules can find boundaries, but they cannot tell a face from a sleeve.

### 3. Make meaningful part masks

The user paints or lasso-selects useful regions and gives them simple names such as back hair, head, front hair, body, arms, eyes, or accessories. Provide a visible color overlay for the selected part and a layer list for order. Each part is a mask over the source image, not a separate authored drawing.

For a later selection helper, divide the image into small color/position regions (SLIC-style superpixels) and let users click adjacent regions to add/remove them. Merge only neighbors that meet explicit color/edge thresholds. This can reduce brush work but still does not infer anatomy. It is optional; polygon and brush tools are the reliable baseline.

Store a part as a mask plus source-image reference initially. Generate an RGBA cutout texture for rendering or cache it as a derived asset. Keep mask edits non-destructive so the user can revise them.

### 4. Repair hidden areas

When a foreground piece moves, pixels hidden beneath it become visible. The original flat picture contains no true hidden art to reveal. Provide a simple repair brush that paints/clones from nearby image pixels onto a hidden-area layer behind the foreground part. A clone brush copies pixels from another point in the original image; a paint brush fills a small hidden patch. Neither can reliably invent unseen details, so show the repaired region and let the user undo it.

### 5. Set front-to-back order and movement centers

Give each part an order and pivot marker. A part can inherit a parent transform. Example: torso → neck/head → hair accessories. Keep front hair and back hair separate so the head can sway without the whole image rotating. Let the user drag the pivot visually; hide parent IDs and coordinate values in normal UI.

### 6. Add a mesh only where needed

Use rigid image pieces first for head/body/arms. Add a coarse subdivided triangle mesh to flexible pieces such as long hair, ribbon, sleeves, or a bent torso. Each mesh vertex maps back to a texture UV. Moving mesh vertices creates bend/sway without redrawing the image.

Suggested levels:

- Whole-image quick mode: one coarse mesh and a few movement presets. Fastest path, but it bends the entire image and cannot animate eyes/arms independently.
- Layered character mode: 5–12 user-correctable parts, rigid pivots, then optional coarse meshes on flexible parts. Better character-like movement and recommended product path.
- Detailed mode: more parts, denser mesh, multiple deformers, and manual rig controls. Add only after the simple result is easy to make.

## Runtime engine structure

### Project model

The editable project should hold:

- Original image reference/asset and canvas size.
- Parts: stable ID, display name, mask or cutout asset, order, optional parent, pivot, rest transform, opacity.
- Optional repair/overdraw assets for pixels that need to appear under moved parts.
- Optional mesh: rest vertices, UVs, triangles, and deformation handles.
- Motion clips: duration, loop, named tracks, keyframes, and beginner-friendly labels.
- Export preferences and schema version.

Keep asset references relative inside a portable project archive. Derived images are reproducible/cacheable; the original and hand-painted repair layers are not disposable.

### Per-frame evaluation

Expose one framework-independent function, conceptually `evaluatePose(project, clip, timeMs)`. It should:

1. Resolve clip time and loop/clamp behavior.
2. Sample motion tracks at that time.
3. Apply each part's local transform, then parent transforms from root to leaf.
4. Apply mesh deformers/constraints in a fixed order.
5. Return ordered draw data with world transforms and deformed vertices.

Both preview playback and offline GIF frame generation call the same evaluator and renderer. That prevents the saved animation from moving differently than the preview.

### Beginner-friendly starter movements

Start with deterministic motion curves so every timestamp can be rendered directly and repeatably:

- Gentle idle: small vertical bob + subtle whole-character scale/breathing.
- Head sway: slow left/right rotation around the head pivot.
- Hair/accessory sway: delayed sinusoidal motion on flexible parts.
- Wave/bounce: a short looping body/head/arm pose sequence with easing.
- Blink: only when eyes are separate parts/masks; otherwise do not synthesize eye closure from the whole flat image.

Use a small set of familiar controls: movement style, amount, speed, and loop. The engine can store keyframes/curves while the user sees presets and sliders. Add spring physics only after deterministic playback/export is solid; fixed-step simulation is possible but more complex to seek to arbitrary times reproducibly.

## Export path

For GIF, render the same scene into an offscreen canvas at fixed timestamps (for example, a short 2–4 second loop at 10–12 fps), read pixel data, and pass frames to a GIF encoder. GIF is a convenient “moving sticker” format but has a limited palette and transparency behavior; also offer PNG sequence/sprite sheet when useful. The current end-to-end prototype instead records a short WebM through Chromium `MediaRecorder`, which avoids a native codec package and is supported by the target Electron runtime. GIF can be added as a separate encoder adapter later.

`gifenc` is a candidate lightweight JavaScript MIT encoder. Confirm its current maintenance, API, dependency tree, and notices before locking it into the shipped build. The drawing engine and encoder should be separate adapters.

## No-AI and licensing decision

- Keep selection and movement deterministic: canvas pixel operations, connected components, flood fill, polygon geometry, brush masks, mesh math, and time-based curves.
- Do not bundle AI weights, invoke a remote model, or require Python for the character-creation path.
- PixiJS (MIT) is a candidate renderer adapter; `gifenc` (MIT) is a candidate GIF encoder. Their notices and all transitive dependencies still need to be included/reviewed for a commercial release.
- Browser Canvas/WebGL APIs are platform APIs rather than bundled rendering packages. A custom WebGL renderer reduces third-party code but adds substantial engineering and maintenance work; the engine stays ours either way.
- Maintain a dependency notice inventory and review every shipped component and asset before distribution. Permissive does not mean no conditions.

## Development sequence

1. Implement transparent-alpha selection, click-to-select flat backgrounds, polygon lasso, and mask brush on one static image.
2. Let users define named cutout parts; add erase/restore, layer order, undo, pivots, and render rigid pieces.
3. Add clone/paint repair behind moving parts.
4. Add one coarse mesh deformation control for hair/ribbon.
5. Add one deterministic idle preset and connect preview to `evaluatePose`.
6. Export that exact preview to a looping GIF.
7. Add edge-follow or superpixel helpers only if they measurably reduce manual work without hiding how selection works.

This sequence prioritizes a simple working result without AI segmentation or advanced deformation.

## References

- [PixiJS package metadata](https://github.com/pixijs/pixijs/blob/dev/package.json): current package declares MIT.
- [PixiJS Mesh guide](https://pixijs.com/8.x/guides/components/scene-objects/mesh): mesh geometry, UVs, indices, and dynamic vertex editing.
- [PixiJS MeshPlane guide](https://pixijs.com/8.x/guides/components/scene-objects/mesh): subdivided textured planes for distortion.
- [gifenc](https://github.com/mattdesl/gifenc): small JS GIF encoder; verify maintenance/dependency notices before adoption.
- [Canvas drawImage API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage): browser-native source image drawing/cropping used by simple mask/edit tools.



## Advanced spatial morphing

Each motion item can optionally enable a local mesh deformation independent of its whole-item pose. Wave, bend, radial, flutter, and pinch modes use deterministic time-based displacement on a fixed 8 by 8 mesh. Direction, strength, spatial frequency, and left-to-right strength bias are item settings and are included automatically in portable project files. The feature is disabled by default; ordinary item motion has no mesh-rendering cost.


Item sizing is a separate 0.5?2.0 multiplier applied after the motion pose, and does not alter movement strength. Spatial morph modes add fluttering edges and radial pinch/swell while keeping the fixed mesh size, so added morph options do not scale per-frame work. Guide visibility is a UI-only toggle bound to the top-row 1 key; it does not affect rendering or export.


Video export uses the same unwrapped elapsed-time timeline as live preview. It must not reset time at the nominal 2.4-second base interval: per-item speed and preset harmonics can have non-integer periods there, which creates an export-only discontinuity. Each triangle draws the complete source under its mesh clip; cropping to triangle bounds caused interpolation gaps along adjacent mesh edges.


Manually created motion items can have empty: true before any content region is assigned. Empty items remain in project data and portable archives but are skipped by the renderer and mask cache. Closing a pen selection assigns its normalized polygon to the active non-source item and clears the empty state; drawing never creates an item implicitly.


Projects may contain multiple embedded image layers. Each image layer stores a validated data URL and intrinsic dimensions on its MotionItem; the portable project JSON includes these fields, while the renderer decodes each asset once and caches it with a bounded cache. Layer order is item array order. Canvas dimensions are project state and determine preview/export render surfaces; layer images are drawn at intrinsic pixel size (scaled only for output resolution) around the canvas center plus per-item position offsets. Canvas resizing therefore reveals or crops content without destructively changing the source image.
