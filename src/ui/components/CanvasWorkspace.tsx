import { CanvasPreview } from '../CanvasPreview'
import type { ImageMotionSettings } from '../../engine/evaluateImageMotion'
import type { MotionItem } from '../../domain/motionItem'

interface CanvasWorkspaceProps {
  imageUrl?: string
  imageWidth?: number
  imageHeight?: number
  canvasWidth?: number
  canvasHeight?: number
  projectName?: string
  settings: ImageMotionSettings
  items: MotionItem[]
  selectedItem?: MotionItem
  selectedMotionName?: string
  selectedItemId?: string
  tool: 'select' | 'pen'
  playing: boolean
  showGuides: boolean
  boundaryEdit: boolean
  onTogglePlaying(): void
  onToggleGuides(): void
  onToggleBoundaryEdit(): void
  onPreviewError(message: string): void
  onBeginBoundaryEdit(): void
  onBeginItemMove(): void
  onUpdateItemPosition(id: string, positionX: number, positionY: number): void
  onUpdatePoints(id: string, points: Array<{ x: number; y: number }>): void
  onClosePath(targetId: string, points: Array<{ x: number; y: number }>): void
  onRequestImageImport(): void
}

export function CanvasWorkspace({
  imageUrl, imageWidth, imageHeight, canvasWidth, canvasHeight, projectName, settings, items,
  selectedItem, selectedMotionName, selectedItemId, tool, playing, showGuides, boundaryEdit,
  onTogglePlaying, onToggleGuides, onToggleBoundaryEdit, onPreviewError,
  onBeginBoundaryEdit, onBeginItemMove, onUpdateItemPosition, onUpdatePoints, onClosePath, onRequestImageImport,
}: CanvasWorkspaceProps) {
  return <section className="canvas-area" aria-label="움직임 미리보기">
    <div className="canvas-toolbar"><div className="canvas-label"><span className="live-indicator" /> 미리보기 <span className="canvas-divider">/</span> {projectName ?? '새 캐릭터'}</div><div className="canvas-tools"><button className={`play-toggle ${playing ? 'active' : ''}`} aria-pressed={playing} onClick={onTogglePlaying} title="재생/멈춤 토글 (숫자키 1)"><span className="play-toggle-icon">{playing ? 'Ⅱ' : '▶'}</span>{playing ? '멈춤' : '재생'} <kbd>1</kbd></button><button className={`guide-toggle ${showGuides ? 'active' : ''}`} aria-pressed={showGuides} onClick={onToggleGuides} title="가이드 토글 (숫자키 2)">{showGuides ? '가이드 숨기기' : '가이드 보기'} <kbd>2</kbd></button><button className={`boundary-toggle ${boundaryEdit ? 'active' : ''}`} disabled={!selectedItem?.points?.length} aria-pressed={boundaryEdit} onClick={onToggleBoundaryEdit} title={selectedItem?.points?.length ? '선택 영역 경계 조절 (숫자키 3)' : '경계점이 있는 아이템을 선택하면 사용할 수 있어요'}>{boundaryEdit ? '경계 조절 완료' : '경계 조절'} <kbd>3</kbd></button><span className="toolbar-divider" /><span>{playing ? '재생 중' : '멈춤'} · {tool === 'pen' ? `그리기 중: ${selectedItem?.name ?? '레이어 없음'}` : items.length ? `${items.length}개 레이어` : '정적 원본'}</span></div></div>
    <div className={`canvas-stage ${imageUrl ? 'has-image' : ''}`}>
      {imageUrl && imageWidth && imageHeight && canvasWidth && canvasHeight ? <CanvasPreview sourceUrl={imageUrl} imageWidth={imageWidth} imageHeight={imageHeight} canvasWidth={canvasWidth} canvasHeight={canvasHeight} settings={settings} playing={playing} onError={onPreviewError} items={items} selectedItemId={selectedItemId} tool={tool} showGuides={showGuides} boundaryEdit={boundaryEdit && tool === 'select'} onBeginBoundaryEdit={onBeginBoundaryEdit} onBeginItemMove={onBeginItemMove} onUpdateItemPosition={onUpdateItemPosition} onUpdatePoints={onUpdatePoints} onClosePath={onClosePath} /> : <div className="empty-state"><div className="empty-illustration"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="empty-spark">✦</div><div className="empty-frame"><span>✧</span></div><div className="float-dot dot-one"/><div className="float-dot dot-two"/></div><h2>캐릭터에 첫 움직임을 넣어보세요</h2><p>그림을 추가하면 바로 미리 볼 수 있어요.</p><button className="outline-button" onClick={onRequestImageImport}>그림 가져오기 <span>↗</span></button></div>}
      {showGuides && <div className="canvas-coordinate">CANVAS <span>{canvasWidth && canvasHeight ? `${canvasWidth} × ${canvasHeight}` : '— × —'}</span></div>}
    </div>
    <div className="canvas-footer"><span>{selectedItem ? `${selectedItem.name} · ${selectedMotionName ?? selectedItem.preset}` : '움직임 아이템 없음'}</span><span>선택한 레이어를 독립적으로 편집합니다</span></div>
  </section>
}
