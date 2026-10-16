# Project working agreement

This repository is the starting point for a Windows desktop 2D character motion engine and editor built with Vite, TypeScript, React, and Electron.

## Product direction

- Help users turn a static illustration into structured character parts, relationships, and motion data, then render and export the result as animated media.
- The user experience should feel simple and outcome-focused: add a picture, get guided help, choose or adjust movement, preview, and save a personal animated character. Users should not need to understand rigging or animation-engine terminology.
- Prefer helpful defaults, plain language, undoable edits, and progressive disclosure over exposing technical controls up front.
- Treat source art as user-owned input. Keep original files intact and make generated edits reversible.
- This product does not use Live2D/Cubism technology and does not target interoperability with it. Do not describe native projects or exports as Live2D/Cubism models.
- The engine is the structured middle layer between source images and rendered animation: parts, masks, hierarchy, pivots, constraints, parameters, motion clips, playback, and rendering must be explicit and editable.
- Prioritize local processing. Any future cloud/AI feature needs explicit user choice and a clear data flow.

## Technical boundaries

- `src/` contains the React renderer and renderer-safe application logic.
- `electron/` contains the Electron main process and preload bridge. Use context isolation, sandboxing, and a narrow typed IPC API; never expose raw Node access to the renderer.
- `docs/` contains architecture decisions, implementation status, and workflow notes. Update relevant docs in the same change as behavior or architecture changes.
- `docs/user-flow.md` is the product UX source of truth. Tie user-facing features to a step in its Input → Program → Output journey and update the document when that journey changes.
- Keep image segmentation, layer editing, puppet graph, motion, playback, rendering, and export as separate modules with typed project data between them.
- The project file is the editable source of truth. Exports are derived artifacts.
- Treat `docs/architecture.md` as the current module ownership map and `docs/user-flow.md` as the current user-facing behavior source. Mark future proposals as planned; do not describe unused schema types as implemented runtime features.
- Keep layer identity, ordering, selection, and undo transitions in the pure TypeScript domain model (`src/domain/layerDocument.ts`). React dispatches commands and renders state.
- Do not add pass-through wrappers. Move ownership and rules to the correct layer; an application module must coordinate a meaningful workflow or enforce a boundary.
- When replacing an architecture, update consumers and persisted-project migration together. Do not leave two competing runtime models.

## Working on the project

- Before implementing a feature, read `docs/architecture.md` and `docs/roadmap.md`.
- After implementation, update the roadmap and relevant documentation with what works, what is limited, and what remains.
- Avoid claiming a feature works when it is only a placeholder. Label prototype UI and unsupported export formats clearly.
- Do not add or run tests unless the user asks to test or verify implementation.
- Do not introduce network services or telemetry without an explicit product decision.

