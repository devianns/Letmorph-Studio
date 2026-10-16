import type { ImageMotionSettings } from '../engine/evaluateImageMotion'
import type { VideoOptions } from '../platform/browser/recordVideo'

export interface ClipExportDependencies {
  record: (
    sourceUrl: string,
    settings: ImageMotionSettings,
    options: VideoOptions,
    onProgress: (percent: number) => void,
  ) => Promise<Blob>
}

/** Application use case for rendering the same deterministic motion shown in preview. */
export function exportCharacterClip(
  sourceUrl: string,
  settings: ImageMotionSettings,
  options: VideoOptions,
  dependencies: ClipExportDependencies,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  return dependencies.record(sourceUrl, settings, options, onProgress)
}
