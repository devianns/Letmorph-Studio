import type { ImageMotionSettings } from '../../engine/evaluateImageMotion'
import type { MotionItem } from '../../domain/motionItem'
import { preloadMotionImages, renderMotionFrame } from './canvasMotionRenderer'
import { WORKSPACE_SCALE } from '../../engine/workspaceLayout'
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeVideo } from 'mediabunny'

export interface VideoOptions {
  durationMs: number
  fps: number
  maxSide: number
  format: 'mp4' | 'webm'
}

export const MAX_VIDEO_EXPORT_BYTES = 512 * 1024 * 1024

export function estimateVideoBytes(settings: ImageMotionSettings, durationMs: number, fps = 60, maxSide = 1920): number {
  const canvasWidth = settings.canvasWidth ?? 1920
  const canvasHeight = settings.canvasHeight ?? 1080
  const scale = Math.min(1, maxSide / Math.max(canvasWidth, canvasHeight))
  const width = Math.max(1, Math.round(canvasWidth * scale * WORKSPACE_SCALE))
  const height = Math.max(1, Math.round(canvasHeight * scale * WORKSPACE_SCALE))
  const bitRate = Math.max(8_000_000, Math.min(24_000_000, Math.round(width * height * fps * 0.18)))
  return Math.ceil(bitRate * durationMs / 8_000)
}

export function isVideoFormatSupported(format: 'mp4' | 'webm'): boolean {
  if (format === 'mp4') return typeof VideoEncoder !== 'undefined'
  if (typeof MediaRecorder === 'undefined') return false
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.some(type => MediaRecorder.isTypeSupported(type))
}

export async function recordVideo(
  sourceUrl: string,
  settings: ImageMotionSettings,
  options: VideoOptions,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  if (options.format === 'mp4') {
    return recordMp4(sourceUrl, settings, options, onProgress)
  }
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('이 환경에서는 영상 녹화를 지원하지 않습니다.')
  }

  if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) throw new Error('Export duration must be a positive finite number.')
  if (estimateVideoBytes(settings, options.durationMs, options.fps, options.maxSide) > MAX_VIDEO_EXPORT_BYTES) {
    throw new Error('Estimated video size exceeds the 512 MB limit. Reduce the repeat count or export at a smaller canvas size.')
  }

  const image = new Image()
  image.src = sourceUrl
  await image.decode()
  await preloadMotionImages(settings)

  const canvasWidth = settings.canvasWidth ?? image.naturalWidth
  const canvasHeight = settings.canvasHeight ?? image.naturalHeight
  const scale = Math.min(1, options.maxSide / Math.max(canvasWidth, canvasHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(canvasWidth * scale * WORKSPACE_SCALE))
  canvas.height = Math.max(1, Math.round(canvasHeight * scale * WORKSPACE_SCALE))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const stream = canvas.captureStream(options.fps)
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type))
  if (!mimeType) {
    stream.getTracks().forEach(track => track.stop())
    throw new Error('This environment cannot encode WebM video.')
  }
  const videoBitsPerSecond = Math.max(8_000_000, Math.min(24_000_000, Math.round(canvas.width * canvas.height * options.fps * 0.18)))
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
  if (!recorder.mimeType.toLowerCase().startsWith('video/webm')) {
    stream.getTracks().forEach(track => track.stop())
    throw new Error(`요청한 ${options.format.toUpperCase()} 형식으로 녹화할 수 없습니다.`)
  }
  const chunks: BlobPart[] = []
  let recordedBytes = 0
  let exceededSizeLimit = false

  return new Promise((resolve, reject) => {
    let renderFailure: MotionItem | undefined
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
        if (recordedBytes + event.data.size > MAX_VIDEO_EXPORT_BYTES) {
          exceededSizeLimit = true
          if (recorder.state !== 'inactive') recorder.stop()
          return
        }
        recordedBytes += event.data.size
        chunks.push(event.data)
      }
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
      if (exceededSizeLimit) {
        reject(new Error('Video export stopped because the file exceeded the 512 MB limit. Reduce the repeat count or export at a smaller canvas size.'))
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

/** Encodes H.264 frames with WebCodecs and muxes a regular, fast-start MP4 file. */
async function recordMp4(
  sourceUrl: string,
  settings: ImageMotionSettings,
  options: VideoOptions,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('이 환경은 H.264 동영상 인코딩을 지원하지 않습니다. WebM을 선택해 주세요.')
  }
  if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) throw new Error('Export duration must be a positive finite number.')
  if (estimateVideoBytes(settings, options.durationMs, options.fps, options.maxSide) > MAX_VIDEO_EXPORT_BYTES) {
    throw new Error('예상 영상 용량이 512MB를 넘습니다. 반복 횟수나 캔버스 크기를 줄여 주세요.')
  }

  const image = new Image()
  image.src = sourceUrl
  await image.decode()
  await preloadMotionImages(settings)

  const canvasWidth = settings.canvasWidth ?? image.naturalWidth
  const canvasHeight = settings.canvasHeight ?? image.naturalHeight
  const scale = Math.min(1, options.maxSide / Math.max(canvasWidth, canvasHeight))
  const canvas = document.createElement('canvas')
  // H.264's widely compatible 4:2:0 profile requires even frame dimensions.
  canvas.width = Math.max(2, Math.round(canvasWidth * scale * WORKSPACE_SCALE / 2) * 2)
  canvas.height = Math.max(2, Math.round(canvasHeight * scale * WORKSPACE_SCALE / 2) * 2)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const bitrate = Math.max(8_000_000, Math.min(24_000_000, Math.round(canvas.width * canvas.height * options.fps * 0.18)))
  const encoderOptions = { width: canvas.width, height: canvas.height, bitrate, frameRate: options.fps }
  if (!await canEncodeVideo('avc', encoderOptions)) {
    image.src = ''
    throw new Error('이 PC에서 H.264 인코딩을 사용할 수 없습니다. WebM으로 내보내 주세요.')
  }

  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target })
  const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate, bitrateMode: 'variable' }) })
  output.addVideoTrack(source, { frameRate: options.fps })
  const frameCount = Math.max(1, Math.ceil(options.durationMs * options.fps / 1000))
  let renderFailure: MotionItem | undefined

  try {
    await output.start()
    for (let frame = 0; frame < frameCount; frame += 1) {
      const timestampMs = frame * 1000 / options.fps
      renderMotionFrame(context, image, timestampMs, settings, item => { renderFailure ??= item })
      if (renderFailure) throw new Error(`'${renderFailure.name}' 아이템을 그리지 못했습니다. 해당 아이템의 영역과 효과 설정을 확인해 주세요.`)
      await source.add(frame / options.fps, 1 / options.fps)
      onProgress(Math.round(((frame + 1) / frameCount) * 99))
    }
    await output.finalize()
    const buffer = target.buffer
    if (!buffer || buffer.byteLength < 16) throw new Error('MP4 파일이 비어 있거나 완성되지 않았습니다.')
    if (buffer.byteLength > MAX_VIDEO_EXPORT_BYTES) throw new Error('완성된 영상이 512MB를 넘습니다. 반복 횟수나 캔버스 크기를 줄여 주세요.')
    const bytes = new Uint8Array(buffer)
    const hasFtyp = String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp'
    if (!hasFtyp) throw new Error('완성된 파일의 MP4 컨테이너 서명이 올바르지 않습니다.')
    onProgress(100)
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    if (output.state === 'pending' || output.state === 'started') await output.cancel().catch(() => undefined)
    throw error
  } finally {
    source.close()
    image.src = ''
  }
}
