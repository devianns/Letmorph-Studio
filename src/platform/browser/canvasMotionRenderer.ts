import { evaluateImageMotion, type MotionItem, type ImageMotionSettings } from '../../engine/evaluateImageMotion'
import { smoothClosedPolygon } from '../../engine/smoothPolygon'
import { getWorkspaceContentRect, WORKSPACE_SCALE } from '../../engine/workspaceLayout'

const selectionPatchCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>()

function getItemPatchKey(item: MotionItem, width: number, height: number): string {
  return `${item.points?.map(point => `${point.x.toFixed(5)},${point.y.toFixed(5)}`).join(';') ?? 'whole-image'}|${item.edgeSmoothing ?? 0}|${item.edgeFeather ?? 0}|${width}x${height}`
}

function getItemPatch(image: HTMLImageElement, item: MotionItem, width: number, height: number): HTMLCanvasElement | undefined {
  const patchWidth = Math.max(1, Math.round(width))
  const patchHeight = Math.max(1, Math.round(height))
  const key = getItemPatchKey(item, patchWidth, patchHeight)
  let imageCache = selectionPatchCache.get(image)
  if (!imageCache) {
    imageCache = new Map()
    selectionPatchCache.set(image, imageCache)
  }
  const cached = imageCache.get(key)
  if (cached) return cached

  const patch = document.createElement('canvas')
  patch.width = patchWidth
  patch.height = patchHeight
  const patchContext = patch.getContext('2d')
  if (!patchContext) return undefined
  patchContext.imageSmoothingEnabled = true
  patchContext.imageSmoothingQuality = 'high'
  patchContext.drawImage(image, 0, 0, patch.width, patch.height)
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
  const imageRect = getWorkspaceContentRect(canvas.width, canvas.height)
  const width = imageRect.width
  const height = imageRect.height
  const patch = item.source ? image : getItemPatch(image, item, width, height)
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
  try {
    context.globalAlpha *= alpha
    context.translate(imageRect.x + pivotX * width + pose.x, imageRect.y + pivotY * height + pose.y)
    context.rotate(pose.rotation)
    context.scale(pose.scale, pose.scale)
    context.drawImage(patch, -pivotX * width, -pivotY * height, width, height)
  } finally {
    context.restore()
  }
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
  onItemRenderError?: (item: MotionItem, cause: unknown) => void,
): void {
  const { canvas } = context
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = settings.background
  context.fillRect(0, 0, canvas.width, canvas.height)

  const items = settings.items ?? []
  const imageRect = getWorkspaceContentRect(canvas.width, canvas.height)
  const activeMasks = new Set(items
    .filter(item => item.visible && !item.source && (!item.points || item.points.length >= 3))
    .map(item => getItemPatchKey(item, Math.max(1, Math.round(imageRect.width)), Math.max(1, Math.round(imageRect.height)))))
  const cache = selectionPatchCache.get(image)
  if (cache) {
    for (const key of cache.keys()) if (!activeMasks.has(key)) cache.delete(key)
  }

  for (const item of items) {
    if (!item.visible || (!item.source && item.points && item.points.length < 3)) continue
    try {
      drawItemWithTrail(context, image, item, timeMs)
    } catch (cause) {
      onItemRenderError?.(item, cause)
    }
  }
}

export async function startMotionPreview(
  canvas: HTMLCanvasElement,
  sourceUrl: string,
  getSettings: () => ImageMotionSettings,
  getPlaying: () => boolean,
  onItemRenderError?: (item: MotionItem, cause: unknown) => void,
): Promise<() => void> {
  const image = new Image()
  image.src = sourceUrl
  await image.decode()

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const maxSide = 900
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale * WORKSPACE_SCALE))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale * WORKSPACE_SCALE))

  let frameId = 0
  let active = true
  let segmentStartedAt = performance.now()
  let elapsedBeforePause = 0
  let wasPlaying = getPlaying()
  const failedItems = new Set<string>()
  const draw = (now: number) => {
    if (!active) return
    const playing = getPlaying()
    if (wasPlaying && !playing) elapsedBeforePause += now - segmentStartedAt
    if (!wasPlaying && playing) segmentStartedAt = now
    wasPlaying = playing
    const elapsed = elapsedBeforePause + (playing ? now - segmentStartedAt : 0)
    renderMotionFrame(context, image, elapsed, getSettings(), (item, cause) => {
      if (failedItems.has(item.id)) return
      failedItems.add(item.id)
      onItemRenderError?.(item, cause)
    })
    frameId = requestAnimationFrame(draw)
  }
  frameId = requestAnimationFrame(draw)

  return () => {
    active = false
    cancelAnimationFrame(frameId)
    image.src = ''
  }
}
