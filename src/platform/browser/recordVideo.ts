import type { ImageMotionSettings, MotionItem } from '../../engine/evaluateImageMotion'
import { renderMotionFrame } from './canvasMotionRenderer'
import { WORKSPACE_SCALE } from '../../engine/workspaceLayout'

export interface VideoOptions {
  durationMs: number
  fps: number
  maxSide: number
  format: 'mp4' | 'webm'
}

export function isVideoFormatSupported(format: 'mp4' | 'webm'): boolean {
  if (typeof MediaRecorder === 'undefined') return false
  const candidates = format === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.some(type => MediaRecorder.isTypeSupported(type))
}

export async function recordVideo(
  sourceUrl: string,
  settings: ImageMotionSettings,
  options: VideoOptions,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('이 환경에서는 영상 녹화를 지원하지 않습니다.')
  }

  const image = new Image()
  image.src = sourceUrl
  await image.decode()

  const scale = Math.min(1, options.maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale * WORKSPACE_SCALE))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale * WORKSPACE_SCALE))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const stream = canvas.captureStream(options.fps)
  const candidates = options.format === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type))
  if (!mimeType) {
    stream.getTracks().forEach(track => track.stop())
    throw new Error(options.format === 'mp4'
      ? '이 환경은 MP4 인코딩을 지원하지 않습니다. 영상 형식을 WebM으로 바꿔 저장해 주세요.'
      : '이 환경은 WebM 인코딩을 지원하지 않습니다.')
  }
  const videoBitsPerSecond = Math.max(8_000_000, Math.min(24_000_000, Math.round(canvas.width * canvas.height * options.fps * 0.18)))
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
  if (!recorder.mimeType.toLowerCase().startsWith(`video/${options.format}`)) {
    stream.getTracks().forEach(track => track.stop())
    throw new Error(`요청한 ${options.format.toUpperCase()} 형식으로 녹화할 수 없습니다.`)
  }
  const chunks: BlobPart[] = []

  return new Promise((resolve, reject) => {
    let renderFailure: MotionItem | undefined
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) chunks.push(event.data)
    })
    recorder.addEventListener('error', () => {
      stream.getTracks().forEach(track => track.stop())
      reject(new Error('영상 녹화 중 문제가 생겼습니다.'))
    }, { once: true })
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach(track => track.stop())
      image.src = ''
      if (renderFailure) {
        reject(new Error(`'${renderFailure.name}' 아이템을 영상에 그리지 못했습니다. 해당 아이템의 영역과 효과 설정을 확인해 주세요.`))
        return
      }
      // Keep the requested container explicit. Some Chromium builds report an
      // empty recorder.mimeType after recording even though they accepted the
      // requested type at construction time.
      resolve(new Blob(chunks, { type: mimeType }))
    }, { once: true })

    recorder.start(100)
    const startedAt = performance.now()
    let animationFrame = 0
    const draw = (now: number) => {
      const elapsed = Math.min(options.durationMs, now - startedAt)
      // Keep one continuous timeline. Wrapping at the nominal 2.4s base period
      // reset each effect at an unrelated phase when its speed was fractional,
      // causing an export-only jump that never occurs in the live preview.
      renderMotionFrame(context, image, elapsed, settings, item => {
        renderFailure ??= item
      })
      if (renderFailure) {
        cancelAnimationFrame(animationFrame)
        recorder.stop()
        return
      }
      onProgress(Math.round((elapsed / options.durationMs) * 100))
      if (elapsed >= options.durationMs) {
        cancelAnimationFrame(animationFrame)
        recorder.stop()
        return
      }
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
  })
}
