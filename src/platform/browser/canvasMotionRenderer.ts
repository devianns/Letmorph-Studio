import { evaluateImageMotion, type MotionItem, type ImageMotionSettings } from '../../engine/evaluateImageMotion'
import { smoothClosedPolygon } from '../../engine/smoothPolygon'

const selectionPatchCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>()

function getItemPatch(image: HTMLImageElement, item: MotionItem): HTMLCanvasElement | undefined {
  const key = `${item.points?.map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join(';') ?? 'whole-image'}|${item.edgeSmoothing ?? 0}|${item.edgeFeather ?? 0}`
  let imageCache = selectionPatchCache.get(image)
  if (!imageCache) {
    imageCache = new Map()
    selectionPatchCache.set(image, imageCache)
  }
  const cached = imageCache.get(key)
  if (cached) return cached

  const patch = document.createElement('canvas')
  patch.width = image.naturalWidth
  patch.height = image.naturalHeight
  const patchContext = patch.getContext('2d')
  if (!patchContext) return undefined
  patchContext.drawImage(image, 0, 0)
  if (item.points?.length) {
    const mask = document.createElement('canvas')
    mask.width = patch.width
    mask.height = patch.height
    const maskContext = mask.getContext('2d')
    if (maskContext) {
      const polygon = smoothClosedPolygon(item.points, item.edgeSmoothing ?? 0)
      const blur = Math.min(mask.width, mask.height) * Math.min(3, item.edgeFeather ?? 0) / 100
      maskContext.filter = `blur(${blur}px)`
      maskContext.fillStyle = '#fff'
      maskContext.beginPath()
      polygon.forEach((point, index) => {
        const x = point.x * mask.width
        const y = point.y * mask.height
        if (index === 0) maskContext.moveTo(x, y)
        else maskContext.lineTo(x, y)
      })
      maskContext.closePath()
      maskContext.fill()
      if (blur > 0) {
        // Feather the smoothed edge, then hard-clip it to the user's original
        // selection so no softened pixels appear outside the drawn boundary.
        maskContext.filter = 'none'
        maskContext.globalCompositeOperation = 'destination-in'
        maskContext.beginPath()
        item.points.forEach((point, index) => {
          const x = point.x * mask.width
          const y = point.y * mask.height
          if (index === 0) maskContext.moveTo(x, y)
          else maskContext.lineTo(x, y)
        })
        maskContext.closePath()
        maskContext.fill()
      }
      patchContext.globalCompositeOperation = 'destination-in'
      patchContext.drawImage(mask, 0, 0)
      patchContext.globalCompositeOperation = 'source-over'
    }
  }
  imageCache.set(key, patch)
  return patch
}

function drawItemAt(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  item: MotionItem,
  timeMs: number,
  alpha = 1,
): void {
  const { canvas } = context
  const width = canvas.width
  const height = canvas.height
  const patch = item.source ? image : getItemPatch(image, item)
  if (!patch || alpha <= 0) return
  const pose = evaluateImageMotion(timeMs, width, height, item)
  let pivotX = 0.5
  let pivotY = 0.5
  if (!item.source && item.points?.length) {
    const polygon = smoothClosedPolygon(item.points, item.edgeSmoothing ?? 0)
    const bounds = polygon.reduce((value, point) => ({
      left: Math.min(value.left, point.x), right: Math.max(value.right, point.x),
      top: Math.min(value.top, point.y), bottom: Math.max(value.bottom, point.y),
    }), { left: 1, right: 0, top: 1, bottom: 0 })
    pivotX = (bounds.left + bounds.right) / 2
    pivotY = (bounds.top + bounds.bottom) / 2
  }
  context.save()
  context.globalAlpha *= alpha
  context.translate(pivotX * width + pose.x, pivotY * height + pose.y)
  context.rotate(pose.rotation)
  context.scale(pose.scale, pose.scale)
  context.drawImage(patch, -pivotX * width, -pivotY * height, width, height)
  context.restore()
}

function drawItemWithTrail(context: CanvasRenderingContext2D, image: HTMLImageElement, item: MotionItem, timeMs: number): void {
  const count = Math.max(0, Math.min(32, Math.round(item.trailCount ?? 0)))
  const intervalMs = Math.max(1, Math.min(300, item.trailIntervalMs ?? 40))
  const opacity = Math.max(0, Math.min(1, (item.trailOpacity ?? 35) / 100))
  const fade = Math.max(0, Math.min(1, (item.trailFade ?? 75) / 100))
  for (let index = count; index >= 1; index -= 1) {
    const alpha = opacity * (1 - fade * (index / count))
    drawItemAt(context, image, item, timeMs - intervalMs * index, alpha)
  }
  drawItemAt(context, image, item, timeMs)
}

export function renderMotionFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  timeMs: number,
  settings: ImageMotionSettings,
): void {
  const { canvas } = context
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = settings.background
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (const item of settings.items ?? []) {
    if (!item.visible || (!item.source && item.points && item.points.length < 3)) continue
    drawItemWithTrail(context, image, item, timeMs)
  }
}

export async function startMotionPreview(
  canvas: HTMLCanvasElement,
  sourceUrl: string,
  getSettings: () => ImageMotionSettings,
  getPlaying: () => boolean,
): Promise<() => void> {
  const image = new Image()
  image.src = sourceUrl
  await image.decode()

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')

  const maxSide = 900
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  let frameId = 0
  let active = true
  let segmentStartedAt = performance.now()
  let elapsedBeforePause = 0
  let wasPlaying = getPlaying()
  const draw = (now: number) => {
    if (!active) return
    const playing = getPlaying()
    if (wasPlaying && !playing) elapsedBeforePause += now - segmentStartedAt
    if (!wasPlaying && playing) segmentStartedAt = now
    wasPlaying = playing
    const elapsed = elapsedBeforePause + (playing ? now - segmentStartedAt : 0)
    renderMotionFrame(context, image, elapsed, getSettings())
    frameId = requestAnimationFrame(draw)
  }
  frameId = requestAnimationFrame(draw)

  return () => {
    active = false
    cancelAnimationFrame(frameId)
    image.src = ''
  }
}
