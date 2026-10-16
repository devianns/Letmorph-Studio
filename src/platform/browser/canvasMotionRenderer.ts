import { evaluateImageMotion, type MotionItem, type ImageMotionSettings } from '../../engine/evaluateImageMotion'
import { smoothClosedPolygon } from '../../engine/smoothPolygon'
import { evaluateSpatialMorph } from '../../engine/evaluateSpatialMorph'
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

function drawSpatialMesh(context: CanvasRenderingContext2D, patch: CanvasImageSource, width: number, height: number, item: MotionItem, timeMs: number): void {
  // Fixed low-cost tessellation bounds per-frame work (128 triangles per item).
  const divisions = 8
  const point = (column: number, row: number) => {
    const u = column / divisions, v = row / divisions
    const offset = evaluateSpatialMorph(u, v, timeMs, width, height, item)
    return { x: u * width, y: v * height, dx: u * width + offset.x, dy: v * height + offset.y }
  }
  const triangle = (a: ReturnType<typeof point>, b: ReturnType<typeof point>, c: ReturnType<typeof point>) => {
    const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
    if (Math.abs(det) < 1e-5) return
    const ax = ((b.dx - a.dx) * (c.y - a.y) - (c.dx - a.dx) * (b.y - a.y)) / det
    const cx = ((b.x - a.x) * (c.dx - a.dx) - (c.x - a.x) * (b.dx - a.dx)) / det
    const ex = a.dx - ax * a.x - cx * a.y
    const by = ((b.dy - a.dy) * (c.y - a.y) - (c.dy - a.dy) * (b.y - a.y)) / det
    const dy = ((b.x - a.x) * (c.dy - a.dy) - (c.x - a.x) * (b.dy - a.dy)) / det
    const fy = a.dy - by * a.x - dy * a.y
    const sourceLeft = Math.min(a.x, b.x, c.x)
    const sourceTop = Math.min(a.y, b.y, c.y)
    const sourceRight = Math.max(a.x, b.x, c.x)
    const sourceBottom = Math.max(a.y, b.y, c.y)
    const patchWidth = patch instanceof HTMLImageElement ? patch.naturalWidth : (patch as HTMLCanvasElement).width
    const patchHeight = patch instanceof HTMLImageElement ? patch.naturalHeight : (patch as HTMLCanvasElement).height
    const sourceScaleX = patchWidth / width
    const sourceScaleY = patchHeight / height
    const sourceWidth = (sourceRight - sourceLeft) * sourceScaleX
    const sourceHeight = (sourceBottom - sourceTop) * sourceScaleY
    context.save()
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.closePath(); context.clip()
    context.transform(ax, by, cx, dy, ex, fy)
    // Rasterize only this triangle's source bounds; drawing the full high-res
    // image for every triangle made spatial morph disproportionately costly in export.
    context.drawImage(patch, sourceLeft * sourceScaleX, sourceTop * sourceScaleY, sourceWidth, sourceHeight,
      sourceLeft, sourceTop, sourceRight - sourceLeft, sourceBottom - sourceTop)
    context.restore()
  }
  for (let row = 0; row < divisions; row++) for (let column = 0; column < divisions; column++) {
    const a = point(column, row), b = point(column + 1, row), c = point(column, row + 1), d = point(column + 1, row + 1)
    triangle(a, b, d); triangle(a, d, c)
  }
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
    const sizeMultiplier = Math.max(0.5, Math.min(2, item.sizeMultiplier ?? 1))
    context.scale(pose.scale * sizeMultiplier, pose.scale * sizeMultiplier)
    if (item.morphMode && (item.morphAmount ?? 0) > 0) {
      context.translate(-pivotX * width, -pivotY * height)
      drawSpatialMesh(context, patch, width, height, item, timeMs)
    } else context.drawImage(patch, -pivotX * width, -pivotY * height, width, height)
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
