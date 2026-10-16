import { useCallback, useState } from 'react'
import type { ImageMotionSettings } from '../../engine/evaluateImageMotion'
import { exportCharacterClip } from '../../application/exportCharacterClip'
import { downloadBlob } from '../../platform/browser/downloadFile'
import { recordVideo } from '../../platform/browser/recordVideo'

export function useAnimationExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  const exportAnimation = useCallback(async (sourceUrl: string, settings: ImageMotionSettings, format: 'mp4' | 'webm') => {
    setError(undefined)
    setSaved(false)
    setProgress(0)
    setIsExporting(true)
    try {
      const blob = await exportCharacterClip(sourceUrl, settings, {
        durationMs: 2400,
        fps: 60,
        maxSide: 1920,
        format,
      }, { record: recordVideo }, setProgress)

      const extension = blob.type.toLowerCase().startsWith(`video/${format}`) ? format : undefined
      if (!extension) throw new Error(`영상이 ${format.toUpperCase()} 형식으로 만들어지지 않았습니다. 다시 시도해 주세요.`)
      const fileName = `my-moving-character.${extension}`

      if (window.desktop) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const result = await window.desktop.saveAnimation(bytes, fileName, extension)
        if (result.cancelled) return
      } else {
        downloadBlob(blob, fileName)
      }
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { isExporting, progress, error, saved, exportAnimation }
}
