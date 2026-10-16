# Letmorph Studio

Windows-first desktop app that helps people turn a still character picture into their own moving character and save it as a video.

The repository is at the early prototype stage. The first complete path imports one image, creates full-image or pen-drawn motion items, previews them over the untouched source, and exports both a video and a portable `.letmorph` project file containing the original image and editable settings. The user can select MP4 or WebM; unsupported formats are disabled instead of silently substituted. AVI is not currently supported. Image validation, motion evaluation, canvas drawing, and recording live in TypeScript modules outside the React UI. The [user journey and implementation sequence](docs/user-flow.md) describes how the app takes a user from input to output. Read it alongside [the architecture](docs/architecture.md), [engine design](docs/engine-design.md), and [the roadmap](docs/roadmap.md) before extending the implementation.

## Current status

The initial end-to-end prototype is implemented: import PNG/JPEG/WebP and get an active `기본 이미지` item immediately, then add whole-image copies or pen-drawn regions as additional motion items. The work area adds 25% movement margin around every side of the source art. Manage items in a list, select from nine motion presets, tune horizontal/vertical movement, rotation, scale, amount, and speed, add up to 32 per-item motion trails, and smooth polygon corners and mask edges. Edge feathering stays inside the original pen boundary. Preview and save a user-selected MP4 or WebM cycle when supported by Chromium, at up to 1920px and 60fps with a high recording bitrate. Choose 1–25 repetitions of the 2.4-second cycle (up to 60 seconds). Export and reopen a `.letmorph` project file containing the source image, items, and export preferences. A guide toggle hides selection outlines and editor overlays while previewing. GIF export, polygon point editing, and Windows packaging remain future work.

## Planned workflow

1. Add a picture and keep the original safe.
2. Let the app prepare a movable character, with simple ways to fix its suggestions.
3. Choose a movement or make a few easy adjustments.
4. Preview the character and make it feel right.
5. Save the project or export a moving image such as a GIF or video.

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
