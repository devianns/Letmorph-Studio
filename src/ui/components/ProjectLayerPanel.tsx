import { useRef } from 'react'
import type { CharacterProject } from '../../domain/project'
import type { MotionItem } from '../../domain/motionItem'

interface ProjectLayerPanelProps {
  project?: CharacterProject
  imageUrl?: string
  isLoading: boolean
  tool: 'select' | 'pen'
  items: MotionItem[]
  history: MotionItem[][]
  selectedItemId?: string
  error?: string
  progress: number
  isExporting: boolean
  onImportCharacterImage(file?: File): void
  onAddImageLayer(file?: File): void
  onOpenProject(): Promise<boolean>
  onImportProjectFile(file?: File): void
  onSaveProject(): void
  onRequestSourceImage(): void
  onSelectTool(tool: 'select' | 'pen'): void
  onApplyWholeSelection(): void
  onAddEmptyItem(): void
  onRestoreBaseItem(): void
  onSelectItem(item: MotionItem): void
  onToggleVisibility(item: MotionItem): void
  onMoveItem(id: string, direction: -1 | 1): void
  onDeleteItem(id: string): void
  onUndo(): void
  onRemoveAll(): void
  onExport(): void
}

export function ProjectLayerPanel({
  project, imageUrl, isLoading, tool, items, history, selectedItemId, error, progress, isExporting,
  onImportCharacterImage, onAddImageLayer, onOpenProject, onImportProjectFile, onSaveProject, onRequestSourceImage,
  onSelectTool, onApplyWholeSelection, onAddEmptyItem, onRestoreBaseItem, onSelectItem,
  onToggleVisibility, onMoveItem, onDeleteItem, onUndo, onRemoveAll, onExport,
}: ProjectLayerPanelProps) {
  const imageLayerInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const openProject = async () => {
    if (!await onOpenProject()) projectInputRef.current?.click()
  }

  return <aside className="left-panel">
    <div className="panel-heading"><div><span className="eyebrow">나만의 움직이는 캐릭터</span><h1>{imageUrl ? '움직일 아이템을 만드세요' : '그림을 가져와 주세요'}</h1></div></div>
    <p className="panel-copy">{imageUrl ? '원본 그림 위에 움직일 아이템을 얹어요. 원본은 잘리거나 바뀌지 않습니다.' : '그림 한 장으로 나만의 움직이는 캐릭터를 만들어요.'}</p>
    <div className="section-label">캐릭터 그림</div>
    {project ? <div className="file-card"><div className="file-icon">▧</div><div className="file-meta"><strong>작업 이미지</strong><span>{project.sourceImage.width} × {project.sourceImage.height}</span></div><button className="more-button" onClick={onRequestSourceImage}>변경</button></div> : <button className="drop-card" onClick={onRequestSourceImage} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); onImportCharacterImage(event.dataTransfer.files[0]) }}><span className="upload-icon">{isLoading ? '…' : '↑'}</span><strong>{isLoading ? '그림을 확인하고 있어요' : '이미지를 여기에 놓으세요'}</strong><span>{isLoading ? '잠시만 기다려 주세요' : '또는 클릭하여 파일 선택'}</span><small>PNG · JPG · WEBP</small></button>}
    <input ref={imageLayerInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { onAddImageLayer(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <div className="project-file-actions"><button className="selection-button" onClick={() => void openProject()}>작업 가져오기</button><button className="selection-button" disabled={!project || !imageUrl} onClick={onSaveProject}>작업 내보내기</button></div>
    <input ref={projectInputRef} className="visually-hidden" type="file" accept=".letmorph,application/vnd.letmorph.project+json,application/json" onChange={event => { onImportProjectFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
    {error && <p className="input-error" role="alert">{error}</p>}
    {imageUrl && <>
      <div className="section-label motion-label">도구</div>
      <div className="tool-list" role="toolbar" aria-label="편집 도구">
        <button className={`tool-button ${tool === 'select' ? 'selected' : ''}`} onClick={() => onSelectTool('select')}><b>↖</b><span>선택</span></button>
        <button className={`tool-button ${tool === 'pen' ? 'selected' : ''}`} aria-pressed={tool === 'pen'} disabled={!items.some(item => item.id === selectedItemId)} title={tool === 'pen' ? '선택한 레이어 그리기 모드 켜짐' : '선택한 레이어에 영역을 그립니다'} onClick={() => onSelectTool(tool === 'pen' ? 'select' : 'pen')}><b>✎</b><span>{tool === 'pen' ? '그리기 모드 켜짐' : '펜 그리기'}</span></button>
        <button className="tool-button" disabled={!items.some(item => item.id === selectedItemId)} onClick={onApplyWholeSelection}><b>▣</b><span>전체 영역 적용</span></button>
        <button className="tool-button add-layer-button" onClick={onAddEmptyItem}><b>＋</b><span>아이템 추가</span></button>
      </div>
      {!items.some(item => item.kind === 'source') && <button className="selection-button restore-base" onClick={onRestoreBaseItem}>작업 이미지 레이어 복구</button>}
      {tool === 'pen' && <p className="selection-hint">선택한 레이어에 영역을 그립니다. 점을 3개 이상 찍고 시작점을 다시 누르거나 Enter를 누르면 적용돼요. 가이드 숨김 상태에서도 그릴 수 있습니다. Backspace는 점 하나 취소, Esc는 그리기 취소예요.</p>}
      <div className="section-label motion-label">아이템 목록 <span className="item-count">{items.length}</span></div>
      <button className="selection-button add-layer-action" onClick={onAddEmptyItem}>＋ 빈 아이템 추가</button>
      <button className="selection-button add-layer-action" onClick={() => imageLayerInputRef.current?.click()}>＋ 이미지 레이어 가져오기</button>
      <div className="item-list">{items.length ? items.map((item, index) => <div className={`item-row ${selectedItemId === item.id ? 'selected' : ''}`} key={item.id}>
        <button className="item-select" onClick={() => onSelectItem(item)}><span className="item-order">{String(index + 1).padStart(2, '0')}</span><span className="item-name">{item.name}</span><small>{selectedItemId === item.id && tool === 'pen' ? '현재 그리기 대상' : item.kind === 'empty' ? '빈 레이어' : item.points?.length ? '선택 영역' : '전체 이미지'}</small></button>
        <button className="item-visibility" title={item.visible ? '숨기기' : '보이기'} onClick={() => onToggleVisibility(item)}>{item.visible ? '◉' : '○'}</button>
        <button className="item-order-action" title="아래 레이어로" aria-label={`${item.name} 아래로`} disabled={index === 0} onClick={() => onMoveItem(item.id, -1)}>↓</button>
        <button className="item-order-action" title="위 레이어로" aria-label={`${item.name} 위로`} disabled={index === items.length - 1} onClick={() => onMoveItem(item.id, 1)}>↑</button>
        <button className="item-delete" aria-label={`${item.name} 삭제`} onClick={() => onDeleteItem(item.id)}>×</button>
      </div>) : <p className="empty-list">아직 아이템이 없어요.<br />빈 아이템을 추가해 영역을 그려보세요.</p>}</div>
      <div className="history-actions"><button className="selection-button" disabled={!history.length} onClick={onUndo}>↶ 실행 취소 <kbd>Ctrl Z</kbd></button><button className="selection-button" disabled={!items.length} onClick={onRemoveAll}>아이템 모두 지우기</button></div>
      <div className="panel-bottom"><div className="progress-label"><span>{isExporting ? '영상 만드는 중' : '저장 준비 완료'}</span><span>{isExporting ? `${progress}%` : '3 / 4'}</span></div><div className="progress-track"><div className={imageUrl ? 'progress-fill complete' : 'progress-fill'} style={isExporting ? { width: `${progress}%` } : undefined} /></div><button className="primary-button" disabled={!imageUrl || isExporting} onClick={onExport}>{isExporting ? '영상을 만들고 있어요…' : '움직이는 영상 저장'} <span>{isExporting ? `${progress}%` : '→'}</span></button><div className="local-note">◉ 그림은 이 기기에서 처리돼요</div></div>
    </>}
  </aside>
}
