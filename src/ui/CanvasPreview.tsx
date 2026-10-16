import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type WheelEvent } from 'react'
import type { ImageMotionSettings } from '../engine/evaluateImageMotion'
import type { MotionItem } from '../domain/motionItem'
import { normalizedPolygonPath, smoothClosedPolygon } from '../engine/smoothPolygon'
import { startMotionPreview } from '../platform/browser/canvasMotionRenderer'
import { getWorkspaceDimensions, WORKSPACE_CONTENT_RATIO, WORKSPACE_MARGIN_RATIO } from '../engine/workspaceLayout'

type EditorTool = 'select' | 'pen'
interface CanvasPreviewProps {
  sourceUrl: string
  imageWidth: number
  imageHeight: number
  canvasWidth: number
  canvasHeight: number
  settings: ImageMotionSettings
  playing: boolean
  onError: (message: string) => void
  items: MotionItem[]
  selectedItemId?: string
  tool: EditorTool
  showGuides: boolean
  boundaryEdit: boolean
  onClosePath: (itemId: string, points: Array<{ x: number; y: number }>) => void
  onUpdatePoints: (itemId: string, points: Point[]) => void
  onBeginBoundaryEdit: () => void
  onBeginItemMove: () => void
  onUpdateItemPosition: (itemId: string, positionX: number, positionY: number) => void
}
interface ViewSize { width: number; height: number }
interface Point { x: number; y: number }

export function CanvasPreview({ sourceUrl, imageWidth, imageHeight, canvasWidth, canvasHeight, settings, playing, onError, items, selectedItemId, tool, showGuides, boundaryEdit, onClosePath, onUpdatePoints, onBeginBoundaryEdit, onBeginItemMove, onUpdateItemPosition }: CanvasPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draft = useRef<Point[]>([])
  const draftTargetId = useRef<string | undefined>(undefined)
  const panPointer = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | undefined>(undefined)
  const itemMovePointer = useRef<{ id: number; itemId: string; x: number; y: number; positionX: number; positionY: number; contentWidth: number; contentHeight: number } | undefined>(undefined)
  const vertexPointer = useRef<{ id: number; itemId: string; index: number } | undefined>(undefined)
  const previewState = useRef({ settings, playing })
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point>()
  const [viewportSize, setViewportSize] = useState<ViewSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  previewState.current = { settings, playing }
  const workspaceSize = getWorkspaceDimensions(canvasWidth, canvasHeight)
  const fitScale = viewportSize.width && viewportSize.height
    ? Math.min(viewportSize.width * 0.92 / workspaceSize.width, viewportSize.height * 0.92 / workspaceSize.height)
    : 0
  const boardWidth = workspaceSize.width * fitScale
  const boardHeight = workspaceSize.height * fitScale

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect
      if (box) setViewportSize({ width: box.width, height: box.height })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let stop: (() => void) | undefined
    const canvas = canvasRef.current
    if (!canvas) return
    void startMotionPreview(canvas, sourceUrl, () => previewState.current.settings, () => previewState.current.playing, item => {
      onError(`'${item.name}' 아이템을 그리는 중 문제가 발생했어요. 해당 아이템의 영역과 효과 설정을 확인해 주세요.`)
    })
      .then(stopPreview => { if (cancelled) stopPreview(); else stop = stopPreview })
      .catch(() => onError('미리보기를 시작하지 못했어요. 다른 이미지로 다시 시도해 주세요.'))
    return () => { cancelled = true; stop?.() }
  }, [canvasHeight, canvasWidth, fitScale, onError, sourceUrl])

  useEffect(() => {
    draft.current = []
    draftTargetId.current = undefined
    setDraftPoints([])
    setCursor(undefined)
  }, [tool])
  useLayoutEffect(() => {
    draft.current = []
    draftTargetId.current = undefined
    setDraftPoints([])
    setCursor(undefined)
  }, [selectedItemId])
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    draft.current = []
    draftTargetId.current = undefined
    setDraftPoints([])
  }, [sourceUrl])

  const pointFromEvent = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }
  const closePath = () => {
    if (draft.current.length < 3) return
    const targetId = draftTargetId.current ?? selectedItemId
    if (!targetId) return
    onClosePath(targetId, draft.current)
    draft.current = []
    draftTargetId.current = undefined
    setDraftPoints([])
    setCursor(undefined)
  }
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (tool !== 'pen') return
    if (event.key === 'Enter') { event.preventDefault(); closePath() }
    if (event.key === 'Escape') { draft.current = []; draftTargetId.current = undefined; setDraftPoints([]); setCursor(undefined) }
    if (event.key === 'Backspace') { event.preventDefault(); draft.current = draft.current.slice(0, -1); setDraftPoints([...draft.current]) }
  }
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const cursorX = event.clientX - rect.left - rect.width / 2
    const cursorY = event.clientY - rect.top - rect.height / 2
    const nextZoom = Math.max(0.2, Math.min(16, zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)))
    const ratio = nextZoom / zoom
    setPan({ x: cursorX - (cursorX - pan.x) * ratio, y: cursorY - (cursorY - pan.y) * ratio })
    setZoom(nextZoom)
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      panPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
      return
    }
    if (event.button !== 2) return
    event.preventDefault()
    const canvas = canvasRef.current
    const item = items.find(value => value.id === selectedItemId)
    if (!canvas || !item || item.kind === 'empty') return
    const rect = canvas.getBoundingClientRect()
    onBeginItemMove()
    event.currentTarget.setPointerCapture(event.pointerId)
    itemMovePointer.current = {
      id: event.pointerId, itemId: item.id, x: event.clientX, y: event.clientY,
      positionX: item.positionX ?? 0, positionY: item.positionY ?? 0,
      contentWidth: rect.width * WORKSPACE_CONTENT_RATIO, contentHeight: rect.height * WORKSPACE_CONTENT_RATIO,
    }
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const vertexDrag = vertexPointer.current
    if (vertexDrag?.id === event.pointerId) {
      const svg = event.currentTarget.querySelector('svg.selection-overlay')
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const canvasPoint = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
      const item = items.find(value => value.id === vertexDrag.itemId)
      if (!item?.points) return
      const assetWidth = item.imageWidth ?? imageWidth
      const assetHeight = item.imageHeight ?? imageHeight
      const nextPoint = {
        x: 0.5 + (canvasPoint.x - 0.5 - (item.positionX ?? 0) / 100) * canvasWidth / (assetWidth * (item.sizeMultiplier ?? 1)),
        y: 0.5 + (canvasPoint.y - 0.5 - (item.positionY ?? 0) / 100) * canvasHeight / (assetHeight * (item.sizeMultiplier ?? 1)),
      }
      const points = item.points.map((point, index) => index === vertexDrag.index ? nextPoint : point)
      onUpdatePoints(item.id, points)
      return
    }
    const start = panPointer.current
    if (start?.id === event.pointerId) {
      setPan({ x: start.panX + event.clientX - start.x, y: start.panY + event.clientY - start.y })
      return
    }
    const move = itemMovePointer.current
    if (move?.id === event.pointerId) onUpdateItemPosition(move.itemId,
      Math.max(-300, Math.min(300, move.positionX + (event.clientX - move.x) / move.contentWidth * 100)),
      Math.max(-300, Math.min(300, move.positionY + (event.clientY - move.y) / move.contentHeight * 100)))
  }
  const finishPan = (event: PointerEvent<HTMLDivElement>) => {
    if (vertexPointer.current?.id === event.pointerId) vertexPointer.current = undefined
    if (panPointer.current?.id === event.pointerId) panPointer.current = undefined
    if (itemMovePointer.current?.id === event.pointerId) itemMovePointer.current = undefined
  }
  const draftPath = draftPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 100} ${point.y * 100}`).join(' ')
  const getItemOutline = (item: MotionItem) => {
    const assetWidth = item.imageWidth ?? imageWidth
    const assetHeight = item.imageHeight ?? imageHeight
    const centerX = 0.5 + (item.positionX ?? 0) / 100
    const centerY = 0.5 + (item.positionY ?? 0) / 100
    const mapPoint = (point: Point) => ({
      x: centerX + (point.x - 0.5) * assetWidth * (item.sizeMultiplier ?? 1) / canvasWidth,
      y: centerY + (point.y - 0.5) * assetHeight * (item.sizeMultiplier ?? 1) / canvasHeight,
    })
    const points = item.points?.length
      ? smoothClosedPolygon(item.points, item.edgeSmoothing ?? 0).map(mapPoint)
      : [mapPoint({ x: 0, y: 0 }), mapPoint({ x: 1, y: 0 }), mapPoint({ x: 1, y: 1 }), mapPoint({ x: 0, y: 1 })]
    return normalizedPolygonPath(points)
  }

  return <div ref={viewportRef} className={`preview-viewport ${tool === 'pen' ? 'pen-active' : ''}`} onWheel={handleWheel} onContextMenu={event => event.preventDefault()} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPan} onPointerCancel={finishPan}>
    {fitScale > 0 && <div className="preview-board" style={{ width: boardWidth, height: boardHeight, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}>
      <canvas ref={canvasRef} className="animated-preview" aria-label="움직이는 캐릭터 미리보기" />
      {(showGuides || tool === 'pen') && <svg className={`selection-overlay tool-${tool} ${boundaryEdit ? 'boundary-edit' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" tabIndex={tool === 'pen' ? 0 : -1}
        onPointerDown={event => {
          if (tool !== 'pen' || event.button !== 0) return
          if (!selectedItemId) return
          if (!draft.current.length) draftTargetId.current = selectedItemId
          const point = pointFromEvent(event)
          const first = draft.current[0]
          if (first && draft.current.length >= 3 && Math.hypot(point.x - first.x, point.y - first.y) < 0.035) { closePath(); return }
          draft.current = [...draft.current, point]
          setDraftPoints(draft.current)
          setCursor(point)
          event.currentTarget.focus()
        }}
        onPointerMove={event => { if (tool === 'pen' && draft.current.length) setCursor(pointFromEvent(event)) }}
        onKeyDown={handleKeyDown}>
        {showGuides && items.filter(item => item.kind !== 'empty').map(item => <path key={item.id} d={getItemOutline(item)} className={`item-outline ${selectedItemId === item.id ? 'active' : ''} ${item.visible ? '' : 'hidden'}`} />)}
        {showGuides && boundaryEdit && selectedItemId && items.find(item => item.id === selectedItemId)?.points?.map((point, index) => {
          const item = items.find(value => value.id === selectedItemId)!
          const assetWidth = item.imageWidth ?? imageWidth, assetHeight = item.imageHeight ?? imageHeight
          const viewPoint = {
            x: 0.5 + (item.positionX ?? 0) / 100 + (point.x - 0.5) * assetWidth * (item.sizeMultiplier ?? 1) / canvasWidth,
            y: 0.5 + (item.positionY ?? 0) / 100 + (point.y - 0.5) * assetHeight * (item.sizeMultiplier ?? 1) / canvasHeight,
          }
          const x = viewPoint.x * 100, y = viewPoint.y * 100
          return <ellipse key={`${selectedItemId}-vertex-${index}`} cx={x} cy={y} rx={2.2 * 100 / Math.max(1, boardWidth)} ry={2.2 * 100 / Math.max(1, boardHeight)} className="boundary-vertex" onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          onBeginBoundaryEdit()
          vertexPointer.current = { id: event.pointerId, itemId: selectedItemId, index }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} />
        })}
        {draftPath && <>
          <path d={`${draftPath}${cursor ? ` L ${cursor.x * 100} ${cursor.y * 100}` : ''}`} className="pen-draft" />
          {draftPoints.map((point, index) => <ellipse key={index} cx={point.x * 100} cy={point.y * 100} rx={1.8 * 100 / Math.max(1, boardWidth)} ry={1.8 * 100 / Math.max(1, boardHeight)} className="pen-point" />)}
          {draftPoints.length >= 3 && <ellipse cx={draftPoints[0].x * 100} cy={draftPoints[0].y * 100} rx={2.4 * 100 / Math.max(1, boardWidth)} ry={2.4 * 100 / Math.max(1, boardHeight)} className="close-point" />}
        </>}
      </svg>}
    </div>}
    {showGuides && <div className="zoom-controls" onPointerDown={event => event.stopPropagation()}>
      <button title="축소" aria-label="축소" onClick={() => setZoom(value => Math.max(0.2, value / 1.2))}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button title="확대" aria-label="확대" onClick={() => setZoom(value => Math.min(16, value * 1.2))}>+</button>
      <button title="화면에 맞추기" aria-label="화면에 맞추기" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>맞춤</button>
    </div>}
    {showGuides && <span className="pan-hint">작업 여유 각 {WORKSPACE_MARGIN_RATIO * 100}% · 휠: 확대/축소 · 가운데 드래그: 화면 이동 · 오른쪽 드래그: 선택 레이어 이동</span>}
  </div>
}
