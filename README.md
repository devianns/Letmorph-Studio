# Letmorph Studio

Windows-first desktop app that helps people turn a still character picture into their own moving character and save it as a video.

The repository is at the early prototype stage. The first complete path imports one image, creates full-image or pen-drawn motion items, previews them over the untouched source, and exports both a video and a portable `.letmorph` project file containing the original image and editable settings. The user can select MP4 or WebM; unsupported formats are disabled instead of silently substituted. AVI is not currently supported. Image validation, motion evaluation, canvas drawing, and recording live in TypeScript modules outside the React UI. The [user journey and implementation sequence](docs/user-flow.md) describes how the app takes a user from input to output. Read it alongside [the architecture](docs/architecture.md), [engine design](docs/engine-design.md), and [the roadmap](docs/roadmap.md) before extending the implementation.

## Current status

The initial end-to-end prototype is implemented: import PNG/JPEG/WebP and get an active source-image layer, then manually add empty or imported-image layers. Pen drawing edits only the selected layer; drawing does not create layers automatically. The work area adds movement margin around the source art. Manage items in a list, choose from nine motion presets, tune movement and spatial morphing, add up to 32 per-item motion trails, and edit polygon boundaries and mask edges. Preview and save MP4 or WebM when supported, up to 1920px and 60fps. Repeat count has no fixed cycle-count cap; estimated and actual output size are limited to 512MB. Export and reopen a `.letmorph` project containing the source image, layers, and export preferences. See [the current user flow](docs/user-flow.md) for limitations and [the roadmap](docs/roadmap.md) for remaining work. Windows installer packaging is not configured.

## Planned workflow

1. Add a picture and preserve it as the source layer.
2. Add/select a layer, then apply motion to the full image or draw a closed region on that layer.
3. Adjust motion and layer properties, then review the composite in the preview.
4. Save the editable `.letmorph` project or export an MP4/WebM video.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Compile the Electron main process and production renderer, then launch the built app without Vite:

```sh
npm run build
npm run start:app
```

`npm run start:app` opens `dist/index.html` through Electron's production path. This is a local release-mode run, not a distributable installer. Windows `.exe`/installer packaging is not configured yet.

## Engine design

See [architecture and references](docs/architecture.md) for the project data model, runtime modules, and staged implementation plan.
