import { useCallback, useState } from 'react'
import type { ImageMotionSettings } from '../../engine/evaluateImageMotion'
import { recordVideo } from '../../platform/browser/recordVideo'
import { saveVideoFile } from '../../platform/browser/videoFileTransfer'

export function useAnimationExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  const exportAnimation = useCallback(async (sourceUrl: string, settings: ImageMotionSettings, format: 'mp4' | 'webm', repeatCount: number) => {
    setError(undefined)
    setSaved(false)
    setProgress(0)
    setIsExporting(true)
    try {
      const blob = await recordVideo(sourceUrl, settings, {
        durationMs: 2400 * Math.max(1, Math.floor(repeatCount)),
        fps: 60,
        maxSide: 1920,
        format,
      }, setProgress)

      const fileName = `my-moving-character.${format}`
      setSaved(await saveVideoFile(blob, fileName, format))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { isExporting, progress, error, saved, exportAnimation }
}
