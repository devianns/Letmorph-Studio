# Roadmap

Updated: 2026-10-16

Status key: `Planned`, `In progress`, `Done`, `Blocked`. Keep this file aligned with shipped behavior.

The product journey and implementation gates are defined in [user-flow.md](user-flow.md). Build in that order: a feature is complete when a user can reach it in the app and finish the corresponding Input â†’ Program â†’ Output step, not when its internal module exists by itself.

## Foundation

- [x] Define product scope as a standalone structured 2D character motion engine.
- [x] Record architecture, risks, and official research references.
- [x] Establish Vite + React + TypeScript + Electron scaffold and secure preload boundary.
- [x] Add shell UI with Import, Parts, Rig, Animate, and Export workspace navigation.

## Milestone 1: Import and editable project

- [x] Import PNG/JPEG/WebP, validate/decode it in TypeScript modules, create in-memory project metadata, and preview it.
- [x] Define a versioned `.letmorph` project file with embedded source image and save/open support.
- [ ] Keep source image immutable and create derived assets separately.
- [ ] Write plain-language guided steps and first-run defaults for creating a first moving character.

## Milestone 2: Manual part creation

- [x] Add a click-to-close pen selection tool and separate whole-image item creation.
- [x] Create the source image as an active, editable base item on import; allow source-item removal and restoration.
- [x] Keep source artwork intact and composite selected masked copies as motion items above it.
- [x] Manage multiple session items in a list with selection, rename, visibility, delete, and region redraw.
- [x] Add basic item-operation undo (Ctrl+Z) and reset-to-import action.
- [ ] Add polygon point editing, mask brush/erase tools, and persistent undo/redo history.
- [ ] Add overdraw/hidden-pixel repair workflow.
- [ ] Persist masks and items in the project.

## Milestone 3: Puppet and motion

- [x] Add nine deterministic motion presets with per-item amount/speed and horizontal, vertical, rotation, and scale tuning.
- [x] Add a preview-only guide toggle to hide selection paths and editor overlays while viewing motion.
- [x] Add per-item time-offset motion trails with count, interval, opacity, and fade controls.
- [x] Add polygon corner smoothing and soft mask-edge controls for pen-selected items.
- [x] Use the same smoothed polygon for the item guide and rendered mask; cache masks by geometry and edge settings.
- [x] Record one 2.4-second MP4 or WebM cycle from the shared motion renderer, based on the user's supported format selection.
- [x] Keep feathered mask pixels inside the original user-drawn selection boundary.
- [x] Support up to 32 motion-trail frames per item.
- [x] Allow 16x canvas zoom and aspect-correct round pen markers.
- [x] Edit existing pen boundaries by dragging their vertices with undo support.
- [x] Improve video export resolution, frame rate, resampling, and recorder bitrate.
- [x] Keep derived item-mask caches at render resolution and discard cache entries unused by current items.
- [x] Isolate item rendering failures so one invalid item cannot stop the preview loop; fail video export with the affected item name.
- [x] Let users repeat the 2.4-second export cycle up to 25 times (60 seconds total).
- [x] Add 25% workspace margins around source art so movement has room before it reaches the canvas edge.
- [ ] Add per-part pivots and parent-child transforms.
- [ ] Add mesh editing and deformation controls.
- [ ] Add parameter controls and key pose capture.
- [ ] Add timeline, clips, interpolation, looped preview.
- [ ] Add basic physics after deterministic transform and animation foundations.
- [ ] Provide approachable starter movements and controls that do not require users to understand animation terminology.
- [ ] Implement one deterministic idle movement and preview it using the shared engine evaluator.

## Milestone 4: Export

- [ ] Export still PNG and transparent PNG sequence.
- [ ] Export GIF and configurable looped animation formats.
- [x] Export a short MP4/WebM video cycle at a fixed size/frame rate for the first end-to-end path (runtime codec support determines format).
- [ ] Export the first looping GIF from the same frame evaluator used by preview.
- [ ] Export sprite sheets and document target compatibility.
- [x] Define initial versioned character/motion graph schema (`src/domain/project.ts`).
- [x] Add pure pose evaluation API for clip timestamp (`src/engine/evaluate.ts`).
- [ ] Keep preview and offline export on the same frame-evaluation path.

## Future research

- Prototype deterministic click-to-select, lasso, brush, and superpixel helpers; no AI model dependency is planned. See [engine design](engine-design.md).
- Evaluate PSD import libraries and fidelity against grouped PSDs, masks, blend modes, and color profiles.



- [x] ¾ÆÀÌÅÛº° °ø°£ ¸ğÇÎ: ¹°°á¡¤±ÁÈû¡¤¹æ»çÇü ÆÄµ¿°ú ¹æÇâ, ¼¼±â, ºóµµ, ÁÂ¿ì ÆíÂ÷ Á¶Àı


- [x] ¼ıÀÚ¿­ 1 °¡ÀÌµå Åä±Û, ¾ÆÀÌÅÛ Å©±â ¹èÀ²(0.5¡¿~2¡¿), ¸ğÇÎ ÆŞ·°ÀÓ/¼öÃà È¿°ú¿Í ¿øÇü Ææ ¸¶Ä¿


- [x] ÀÍ½ºÆ÷Æ®¿¡¼­ ±âº» ¸ğ¼Ç°ú °ø°£ ¸ğÇÎÀÇ ½Ã°£ÃàÀ» ¿¬¼ÓÀ¸·Î À¯ÁöÇÏ°í, 2.4ÃÊ¸¶´Ù ¹ß»ıÇÏ´ø À§»ó ¸®¼Â Á¡ÇÁ ¼öÁ¤


- [x] ¼öµ¿ ·¹ÀÌ¾î »ı¼º°ú È°¼º ·¹ÀÌ¾î Ææ ÆíÁı: ºó ¾ÆÀÌÅÛ ÀúÀå/º¹¿ø, ±×¸®±â ½Ã ÀÚµ¿ ¾ÆÀÌÅÛ »ı¼º Á¦°Å


- [x] ´ÙÁß ÀÌ¹ÌÁö ·¹ÀÌ¾î °¡Á®¿À±â/Á¤·Ä, ·¹ÀÌ¾îº° Å©±â¡¤À§Ä¡ Á¶Àı, Äµ¹ö½º Å©±â ÆíÁı ¹× ÀÛ¾÷ ÆÄÀÏ ÀúÀå/º¹¿ø
