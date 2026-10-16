import { evaluateImageMotion, type MotionItem, type ImageMotionSettings } from '../../engine/evaluateImageMotion'
import { smoothClosedPolygon } from '../../engine/smoothPolygon'
import { evaluateSpatialMorph } from '../../engine/evaluateSpatialMorph'
import { getWorkspaceContentRect, WORKSPACE_SCALE } from '../../engine/workspaceLayout'

const selectionPatchCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>()
const itemImageCache = new Map<string, HTMLImageElement>()

function getItemImage(item: MotionItem, fallback: HTMLImageElement): HTMLImageElement | undefined {
  if (!item.imageDataUrl) return fallback
  let image = itemImageCache.get(item.imageDataUrl)
  if (!image) {
    image = new Image()
    image.src = item.imageDataUrl
    itemImageCache.set(item.imageDataUrl, image)
    if (itemImageCache.size > 64) {
      const oldestKey = itemImageCache.keys().next().value
      if (oldestKey) {
        const oldestImage = itemImageCache.get(oldestKey)
        if (oldestImage) oldestImage.src = ''
        itemImageCache.delete(oldestKey)
      }
    }
  }
  return image.complete && image.naturalWidth > 0 ? image : undefined
}

export async function preloadMotionImages(settings: ImageMotionSettings): Promise<void> {
  await Promise.all((settings.items ?? []).filter(item => item.imageDataUrl).map(item => {
    let image = itemImageCache.get(item.imageDataUrl!)
    if (!image) {
      image = new Image()
      image.src = item.imageDataUrl!
      itemImageCache.set(item.imageDataUrl!, image)
    }
    return image.decode()
  }))
}

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
        // Feather the final smoothed edge, then hard-clip to that same shape so
        // softened pixels stay inside the visible selection boundary.
        maskContext.filter = 'none'
        maskContext.globalCompositeOperation = 'destination-in'
        maskContext.beginPath()
        polygon.forEach((point, index) => {
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
    // Canvas antialiasing can leave transparent hairlines between adjacent
    // triangle clips. Expand only the clip by a tiny amount; the affine warp
    // still maps each triangle from the same shared grid vertices.
    const centerX = (a.dx + b.dx + c.dx) / 3
    const centerY = (a.dy + b.dy + c.dy) / 3
    const overlap = Math.max(0.5, Math.min(1.5, Math.max(width, height) / divisions * 0.012))
    const expand = (vertex: ReturnType<typeof point>) => {
      const x = vertex.dx - centerX, y = vertex.dy - centerY
      const length = Math.hypot(x, y) || 1
      return { x: vertex.dx + x / length * overlap, y: vertex.dy + y / length * overlap }
    }
    const clipA = expand(a), clipB = expand(b), clipC = expand(c)
    const ax = ((b.dx - a.dx) * (c.y - a.y) - (c.dx - a.dx) * (b.y - a.y)) / det
    const cx = ((b.x - a.x) * (c.dx - a.dx) - (c.x - a.x) * (b.dx - a.dx)) / det
    const ex = a.dx - ax * a.x - cx * a.y
    const by = ((b.dy - a.dy) * (c.y - a.y) - (c.dy - a.dy) * (b.y - a.y)) / det
    const dy = ((b.x - a.x) * (c.dy - a.dy) - (c.x - a.x) * (b.dy - a.dy)) / det
    const fy = a.dy - by * a.x - dy * a.y
    context.save()
    context.beginPath(); context.moveTo(clipA.x, clipA.y); context.lineTo(clipB.x, clipB.y); context.lineTo(clipC.x, clipC.y); context.closePath(); context.clip()
    context.transform(ax, by, cx, dy, ex, fy)
    // Draw the complete source through each triangle clip. Cropping the source
    // per triangle introduced interpolation gaps along mesh boundaries.
    context.drawImage(patch, 0, 0, width, height)
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
  canvasWidth: number,
  canvasHeight: number,
  alpha = 1,
): void {
  const { canvas } = context
  const imageRect = getWorkspaceContentRect(canvas.width, canvas.height)
  const layerImage = getItemImage(item, image)
  if (!layerImage) return
  const width = layerImage.naturalWidth * imageRect.width / canvasWidth
  const height = layerImage.naturalHeight * imageRect.height / canvasHeight
  const patch = (item.source && !item.points?.length) || (item.imageDataUrl && !item.points?.length)
    ? layerImage
    : getItemPatch(layerImage, item, width, height)
  if (!patch || alpha <= 0) return
  const pose = evaluateImageMotion(timeMs, imageRect.width, imageRect.height, item)
  let pivotX = 0.5
  let pivotY = 0.5
  if (item.points?.length) {
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
    const sizeMultiplier = Math.max(0.1, Math.min(5, item.sizeMultiplier ?? 1))
    context.globalAlpha *= alpha
    context.translate(imageRect.x + imageRect.width / 2 + (item.positionX ?? 0) / 100 * imageRect.width + (pivotX - 0.5) * width * sizeMultiplier + pose.x,
      imageRect.y + imageRect.height / 2 + (item.positionY ?? 0) / 100 * imageRect.height + (pivotY - 0.5) * height * sizeMultiplier + pose.y)
    context.rotate(pose.rotation)
    context.scale(pose.scale * sizeMultiplier, pose.scale * sizeMultiplier)
    if (item.morphMode && (item.morphAmount ?? 0) > 0) {
      context.translate(-pivotX * width, -pivotY * height)
      drawSpatialMesh(context, patch, width, height, item, timeMs)
    } else context.drawImage(patch, -pivotX * width, -pivotY * height, width, height)
  } finally {
    context.restore()
  }
}

function drawItemWithTrail(context: CanvasRenderingContext2D, image: HTMLImageElement, item: MotionItem, timeMs: number, canvasWidth: number, canvasHeight: number): void {
  const count = Math.max(0, Math.min(32, Math.round(item.trailCount ?? 0)))
  const intervalMs = Math.max(1, Math.min(300, item.trailIntervalMs ?? 40))
  const opacity = Math.max(0, Math.min(1, (item.trailOpacity ?? 35) / 100))
  const fade = Math.max(0, Math.min(1, (item.trailFade ?? 75) / 100))
  for (let index = count; index >= 1; index -= 1) {
    const alpha = opacity * (1 - fade * (index / count))
    drawItemAt(context, image, item, timeMs - intervalMs * index, canvasWidth, canvasHeight, alpha)
  }
  drawItemAt(context, image, item, timeMs, canvasWidth, canvasHeight)
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
  const activeAssetUrls = new Set(items.filter(item => item.imageDataUrl).map(item => item.imageDataUrl!))
  for (const [url, itemImage] of itemImageCache) {
    if (!activeAssetUrls.has(url)) {
      itemImage.src = ''
      itemImageCache.delete(url)
    }
  }
  const canvasWidth = settings.canvasWidth ?? image.naturalWidth
  const canvasHeight = settings.canvasHeight ?? image.naturalHeight
  const imageRect = getWorkspaceContentRect(canvas.width, canvas.height)
  const activeMasks = new Map<HTMLImageElement, Set<string>>()
  for (const item of items) {
    if (!item.visible || (item.source && (!item.points || item.points.length < 3)) || item.empty || (item.imageDataUrl && !item.points?.length)
      || (item.points && item.points.length < 3)) continue
    const layerImage = getItemImage(item, image)
    if (!layerImage) continue
    const keys = activeMasks.get(layerImage) ?? new Set<string>()
    keys.add(getItemPatchKey(item, Math.max(1, Math.round(layerImage.naturalWidth * imageRect.width / canvasWidth)),
      Math.max(1, Math.round(layerImage.naturalHeight * imageRect.height / canvasHeight))))
    activeMasks.set(layerImage, keys)
  }
  for (const cachedImage of [image, ...itemImageCache.values()]) {
    const cache = selectionPatchCache.get(cachedImage)
    const activeKeys = activeMasks.get(cachedImage) ?? new Set()
    if (cache) for (const key of cache.keys()) if (!activeKeys.has(key)) cache.delete(key)
  }

  for (const item of items) {
    if (!item.visible || item.empty || (!item.source && item.points && item.points.length < 3)) continue
    try {
      if (item.source && item.points && item.points.length >= 3) {
        // Keep the source artwork as an unchanged underlay. Animate only the
        // selected pixels as a masked copy so moving a base-image region never
        // exposes the project background.
        context.drawImage(image, imageRect.x, imageRect.y, imageRect.width, imageRect.height)
        drawItemWithTrail(context, image, { ...item, source: false }, timeMs, canvasWidth, canvasHeight)
      } else drawItemWithTrail(context, image, item, timeMs, canvasWidth, canvasHeight)
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

  const settings = getSettings()
  const canvasWidth = settings.canvasWidth ?? image.naturalWidth
  const canvasHeight = settings.canvasHeight ?? image.naturalHeight
  const maxSide = 900
  const scale = Math.min(1, maxSide / Math.max(canvasWidth, canvasHeight))
  canvas.width = Math.max(1, Math.round(canvasWidth * scale * WORKSPACE_SCALE))
  canvas.height = Math.max(1, Math.round(canvasHeight * scale * WORKSPACE_SCALE))

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
