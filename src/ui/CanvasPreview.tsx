import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type WheelEvent } from 'react'
import type { ImageMotionSettings, MotionItem } from '../engine/evaluateImageMotion'
import { normalizedPolygonPath, smoothClosedPolygon } from '../engine/smoothPolygon'
import { startMotionPreview } from '../platform/browser/canvasMotionRenderer'
import { getWorkspaceDimensions, WORKSPACE_MARGIN_RATIO } from '../engine/workspaceLayout'

type EditorTool = 'select' | 'pen'
interface CanvasPreviewProps {
  sourceUrl: string
  imageWidth: number
  imageHeight: number
  settings: ImageMotionSettings
  playing: boolean
  onError: (message: string) => void
  items: MotionItem[]
  selectedItemId?: string
  tool: EditorTool
  showGuides: boolean
  boundaryEdit: boolean
  onClosePath: (points: Array<{ x: number; y: number }>) => void
  onUpdatePoints: (itemId: string, points: Point[]) => void
  onBeginBoundaryEdit: () => void
}
interface ViewSize { width: number; height: number }
interface Point { x: number; y: number }

export function CanvasPreview({ sourceUrl, imageWidth, imageHeight, settings, playing, onError, items, selectedItemId, tool, showGuides, boundaryEdit, onClosePath, onUpdatePoints, onBeginBoundaryEdit }: CanvasPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draft = useRef<Point[]>([])
  const panPointer = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | undefined>(undefined)
  const vertexPointer = useRef<{ id: number; itemId: string; index: number } | undefined>(undefined)
  const previewState = useRef({ settings, playing })
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point>()
  const [viewportSize, setViewportSize] = useState<ViewSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  previewState.current = { settings, playing }
  const workspaceSize = getWorkspaceDimensions(imageWidth, imageHeight)
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
    void startMotionPreview(canvas, sourceUrl, () => previewState.current.settings, () => previewState.current.playing)
      .then(stopPreview => { if (cancelled) stopPreview(); else stop = stopPreview })
      .catch(() => onError('미리보기를 시작하지 못했어요. 다른 이미지로 다시 시도해 주세요.'))
    return () => { cancelled = true; stop?.() }
  }, [fitScale, onError, sourceUrl])

  useEffect(() => {
    draft.current = []
    setDraftPoints([])
    setCursor(undefined)
  }, [tool])
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    draft.current = []
    setDraftPoints([])
  }, [sourceUrl])

  const pointFromEvent = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }
  const closePath = () => {
    if (draft.current.length < 3) return
    onClosePath(draft.current)
    draft.current = []
    setDraftPoints([])
    setCursor(undefined)
  }
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (tool !== 'pen') return
    if (event.key === 'Enter') { event.preventDefault(); closePath() }
    if (event.key === 'Escape') { draft.current = []; setDraftPoints([]); setCursor(undefined) }
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
    if (event.button !== 1) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const vertexDrag = vertexPointer.current
    if (vertexDrag?.id === event.pointerId) {
      const svg = event.currentTarget.querySelector('svg.selection-overlay')
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const nextPoint = { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
      const item = items.find(value => value.id === vertexDrag.itemId)
      if (!item?.points) return
      const points = item.points.map((point, index) => index === vertexDrag.index ? nextPoint : point)
      onUpdatePoints(item.id, points)
      return
    }
    const start = panPointer.current
    if (start?.id === event.pointerId) {
      setPan({ x: start.panX + event.clientX - start.x, y: start.panY + event.clientY - start.y })
    }
  }
  const finishPan = (event: PointerEvent<HTMLDivElement>) => {
    if (vertexPointer.current?.id === event.pointerId) vertexPointer.current = undefined
    if (panPointer.current?.id === event.pointerId) panPointer.current = undefined
  }
  const draftPath = draftPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 100} ${point.y * 100}`).join(' ')
  const fullImagePath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z'

  return <div ref={viewportRef} className={`preview-viewport ${tool === 'pen' ? 'pen-active' : ''}`} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPan} onPointerCancel={finishPan}>
    {fitScale > 0 && <div className="preview-board" style={{ width: boardWidth, height: boardHeight, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}>
      <canvas ref={canvasRef} className="animated-preview" aria-label="움직이는 캐릭터 미리보기" />
      {showGuides && <svg className={`selection-overlay tool-${tool} ${boundaryEdit ? 'boundary-edit' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" tabIndex={tool === 'pen' ? 0 : -1}
        onPointerDown={event => {
          if (tool !== 'pen' || event.button !== 0) return
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
        {items.map(item => <path key={item.id} d={item.points?.length ? normalizedPolygonPath(smoothClosedPolygon(item.points, item.edgeSmoothing ?? 0)) : fullImagePath} className={`item-outline ${selectedItemId === item.id ? 'active' : ''} ${item.visible ? '' : 'hidden'}`} />)}
        {boundaryEdit && selectedItemId && items.find(item => item.id === selectedItemId)?.points?.map((point, index) => <circle key={`${selectedItemId}-vertex-${index}`} cx={point.x * 100} cy={point.y * 100} r="1.4" className="boundary-vertex" onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          onBeginBoundaryEdit()
          vertexPointer.current = { id: event.pointerId, itemId: selectedItemId, index }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} />)}
        {draftPath && <>
          <path d={`${draftPath}${cursor ? ` L ${cursor.x * 100} ${cursor.y * 100}` : ''}`} className="pen-draft" />
          {draftPoints.map((point, index) => <ellipse key={index} cx={point.x * 100} cy={point.y * 100} rx={1.2 * 100 / imageWidth} ry={1.2 * 100 / imageHeight} className="pen-point" />)}
          {draftPoints.length >= 3 && <ellipse cx={draftPoints[0].x * 100} cy={draftPoints[0].y * 100} rx={2.5 * 100 / imageWidth} ry={2.5 * 100 / imageHeight} className="close-point" />}
        </>}
      </svg>}
    </div>}
    {showGuides && <div className="zoom-controls" onPointerDown={event => event.stopPropagation()}>
      <button title="축소" aria-label="축소" onClick={() => setZoom(value => Math.max(0.2, value / 1.2))}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button title="확대" aria-label="확대" onClick={() => setZoom(value => Math.min(16, value * 1.2))}>+</button>
      <button title="화면에 맞추기" aria-label="화면에 맞추기" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>맞춤</button>
    </div>}
    {showGuides && <span className="pan-hint">작업 여유 각 {WORKSPACE_MARGIN_RATIO * 100}% · 휠: 확대/축소 · 가운데 버튼 드래그: 이동</span>}
  </div>
}
