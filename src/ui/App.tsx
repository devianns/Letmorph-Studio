import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CanvasPreview } from './CanvasPreview'
import { useAnimationExport } from './hooks/useAnimationExport'
import { useCharacterProject } from './hooks/useCharacterProject'
import type { ImageMotionPreset, ImageMotionSettings, MotionItem } from '../engine/evaluateImageMotion'
import { isVideoFormatSupported } from '../platform/browser/recordVideo'
import { createPortableProjectFile, parsePortableProjectFile, type PortableProjectFile } from '../application/portableProjectFile'
import { downloadBlob } from '../platform/browser/downloadFile'

type EditorTool = 'select' | 'pen'
const steps = ['그림 가져오기', '아이템 만들기', '움직임 조절', '영상 저장']
const motionOptions: { id: ImageMotionPreset; name: string; description: string }[] = [
  { id: 'sway', name: '살랑살랑', description: '천천히 좌우로 흔들려요' },
  { id: 'bounce', name: '통통', description: '위아래로 튀어요' },
  { id: 'nod', name: '끄덕끄덕', description: '부드럽게 기울여요' },
  { id: 'float', name: '둥실둥실', description: '천천히 떠다녀요' },
  { id: 'swing', name: '흔들흔들', description: '회전하며 흔들려요' },
  { id: 'pulse', name: '두근두근', description: '크기가 커졌다 작아져요' },
  { id: 'wobble', name: '빙글빙글', description: '빠르게 여러 방향으로 움직여요' },
  { id: 'breathe', name: '숨쉬기', description: '천천히 부풀었다 돌아와요' },
  { id: 'shake', name: '파르르', description: '작고 빠르게 떨려요' },
]

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('원본 이미지를 작업 파일에 담지 못했습니다.'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('원본 이미지 변환에 실패했습니다.'))
    reader.readAsDataURL(blob)
  })
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const pendingProjectRestore = useRef<PortableProjectFile | undefined>(undefined)
  const { project, imageUrl, error: importError, isLoading, importImage, clearProject } = useCharacterProject()
  const { isExporting, progress, error: exportError, saved, exportAnimation } = useAnimationExport()
  const [items, setItems] = useState<MotionItem[]>([])
  const [history, setHistory] = useState<MotionItem[][]>([])
  const [selectedItemId, setSelectedItemId] = useState<string>()
  const [tool, setTool] = useState<EditorTool>('select')
  const [editTargetId, setEditTargetId] = useState<string>()
  const [playing, setPlaying] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [boundaryEdit, setBoundaryEdit] = useState(false)
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'webm'>(() => isVideoFormatSupported('webm') ? 'webm' : 'mp4')
  const [repeatCount, setRepeatCount] = useState(1)
  const [previewError, setPreviewError] = useState<string>()
  const [projectFileError, setProjectFileError] = useState<string>()
  const [projectRestoreRevision, setProjectRestoreRevision] = useState(0)
  const selectedItem = items.find(item => item.id === selectedItemId)

  const commitItems = useCallback((next: MotionItem[]) => {
    setHistory(stack => [...stack.slice(-49), items.map(item => ({ ...item, points: item.points?.map(point => ({ ...point })) }))])
    setItems(next)
  }, [items])
  const rememberItems = () => setHistory(stack => [...stack.slice(-49), items.map(item => ({ ...item, points: item.points?.map(point => ({ ...point })) }))])
  const undo = useCallback(() => {
    setHistory(stack => {
      if (!stack.length) return stack
      setItems(stack[stack.length - 1])
      return stack.slice(0, -1)
    })
  }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        const target = event.target as HTMLElement | null
        if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return
        event.preventDefault()
        undo()
      }
      const target = event.target as HTMLElement | null
      const shortcutAllowed = !event.ctrlKey && !event.metaKey && !event.altKey
        && !target?.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (shortcutAllowed && event.key === '1') {
        event.preventDefault()
        setPlaying(value => !value)
      }
      if (shortcutAllowed && event.key === '2') {
        event.preventDefault()
        setShowGuides(value => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])
  useEffect(() => {
    if (project) {
      const restored = pendingProjectRestore.current
      if (restored?.project.id === project.id) {
        setItems(restored.items)
        setSelectedItemId(restored.selectedItemId && restored.items.some(item => item.id === restored.selectedItemId)
          ? restored.selectedItemId
          : restored.items[0]?.id)
        setVideoFormat(restored.exportSettings.format)
        setRepeatCount(restored.exportSettings.repeatCount)
        pendingProjectRestore.current = undefined
        setHistory([]); setTool('select'); setEditTargetId(undefined)
        return
      }
      pendingProjectRestore.current = undefined
      const baseItem: MotionItem = { id: `${project.id}:source`, name: '기본 이미지', source: true, preset: 'sway', amount: 45, speed: 1, horizontal: 100, vertical: 100, rotation: 100, scale: 100, visible: true }
      setItems([baseItem]); setSelectedItemId(baseItem.id)
    } else {
      setItems([]); setSelectedItemId(undefined)
    }
    setHistory([]); setTool('select'); setEditTargetId(undefined)
  }, [project?.id, projectRestoreRevision])

  const addEmptyItem = () => {
    const number = items.filter(item => !item.source).length + 1
    const item: MotionItem = {
      id: crypto.randomUUID(), name: `아이템 ${number}`, source: false, empty: true,
      preset: 'sway', amount: 65, speed: 1, horizontal: 100, vertical: 100, rotation: 100, scale: 100,
      edgeSmoothing: 15, edgeFeather: 0.5, trailCount: 0, visible: true,
    }
    commitItems([...items, item])
    setSelectedItemId(item.id)
    setEditTargetId(undefined)
    setTool('pen')
  }
  const applyWholeSelection = () => {
    if (!selectedItem || selectedItem.source) return
    updateSelected({ points: undefined, empty: false })
    setEditTargetId(undefined)
    setTool('select')
  }
  const updateSelected = (update: Partial<MotionItem>) => {
    if (!selectedItem) return
    commitItems(items.map(item => item.id === selectedItem.id ? { ...item, ...update } : item))
  }
  const applyDrawnRegion = (points: Array<{ x: number; y: number }>) => {
    const targetId = editTargetId ?? selectedItemId
    const target = items.find(item => item.id === targetId)
    if (!target || target.source) return
    commitItems(items.map(item => item.id === target.id ? {
      ...item, points, empty: false,
      edgeSmoothing: item.edgeSmoothing ?? 15,
      edgeFeather: item.edgeFeather ?? 0.5,
    } : item))
    setSelectedItemId(target.id)
    setEditTargetId(undefined)
    setTool('select')
  }
  const deleteItem = (id: string) => {
    commitItems(items.filter(item => item.id !== id))
    if (selectedItemId === id) setSelectedItemId(undefined)
  }
  const restoreBaseItem = () => {
    if (!project || items.some(item => item.source)) return
    const baseItem: MotionItem = { id: `${project.id}:source`, name: '기본 이미지', source: true, preset: 'sway', amount: 45, speed: 1, horizontal: 100, vertical: 100, rotation: 100, scale: 100, visible: true }
    commitItems([baseItem, ...items])
    setSelectedItemId(baseItem.id)
  }
  const resetProject = () => {
    pendingProjectRestore.current = undefined
    clearProject(); setItems([]); setHistory([]); setSelectedItemId(undefined); setTool('select'); setEditTargetId(undefined)
  }
  const exportProjectFile = async () => {
    if (!project || !imageUrl) return
    try {
      const sourceBlob = await fetch(imageUrl).then(response => response.blob())
      const archive = createPortableProjectFile(project, await blobAsDataUrl(sourceBlob), items, selectedItemId, { format: videoFormat, repeatCount })
      const bytes = new TextEncoder().encode(JSON.stringify(archive))
      const fileName = `${project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.letmorph`
      if (window.desktop) {
        await window.desktop.saveProject(bytes, fileName)
      } else {
        downloadBlob(new Blob([bytes], { type: 'application/vnd.letmorph.project+json' }), fileName)
      }
      setProjectFileError(undefined)
    } catch (cause) {
      setProjectFileError(cause instanceof Error ? cause.message : '작업 파일 내보내기에 실패했습니다.')
    }
  }
  const importProjectFile = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('작업 파일은 100MB 이하여야 합니다.')
      const { archive, sourceImage } = parsePortableProjectFile(await file.text())
      pendingProjectRestore.current = archive
      const loadedProject = await importImage(sourceImage, archive.project)
      if (!loadedProject) {
        pendingProjectRestore.current = undefined
        throw new Error('작업 파일의 원본 이미지를 불러오지 못했습니다.')
      }
      setProjectFileError(undefined)
      if (project?.id === archive.project.id) setProjectRestoreRevision(value => value + 1)
    } catch (cause) {
      pendingProjectRestore.current = undefined
      setProjectFileError(cause instanceof Error ? cause.message : '작업 파일을 가져오지 못했습니다.')
    }
  }
  const settings = useMemo<ImageMotionSettings>(() => ({
    preset: selectedItem?.preset ?? 'sway', amount: selectedItem?.amount ?? 65, speed: selectedItem?.speed ?? 1,
    background: '#f2efe8', items,
  }), [items, selectedItem])
  const onPreviewError = useCallback((message: string) => setPreviewError(message), [])
  const handleExport = () => { if (imageUrl) void exportAnimation(imageUrl, settings, videoFormat, repeatCount) }
  const currentError = importError ?? exportError ?? projectFileError ?? previewError

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><span>Letmorph <span className="brand-light">Studio</span></span></div>
      <div className="project-title">{project?.name ?? '새 캐릭터'} <span className="unsaved-dot" /></div>
      <div className="top-actions"><button className="quiet-button" disabled={!imageUrl} onClick={resetProject}>처음으로</button><label className="export-format-control"><span>형식</span><select aria-label="내보내기 형식" value={videoFormat} onChange={event => setVideoFormat(event.target.value as 'mp4' | 'webm')}><option value="mp4" disabled={!isVideoFormatSupported('mp4')}>MP4{isVideoFormatSupported('mp4') ? '' : ' (지원 안 됨)'}</option><option value="webm" disabled={!isVideoFormatSupported('webm')}>WebM{isVideoFormatSupported('webm') ? '' : ' (지원 안 됨)'}</option></select></label><label className="export-format-control repeat-count-control"><span>반복</span><input aria-label="영상 반복 횟수 (최대 25회)" type="number" min="1" max="25" step="1" value={repeatCount} onChange={event => setRepeatCount(Math.max(1, Math.min(25, Number(event.target.value) || 1)))} /><small>{(repeatCount * 2.4).toFixed(1)}초</small></label><span className="save-state">{saved ? '영상이 저장됐어요' : '작업 중'}</span><button className="quiet-button" disabled={!imageUrl || isExporting || !isVideoFormatSupported(videoFormat)} onClick={handleExport}>영상 저장</button></div>
    </header>
    <nav className="workflow" aria-label="만들기 단계">{steps.map((step, index) => <div className={`workflow-step ${index === (imageUrl ? 1 : 0) ? 'active' : ''}`} key={step}><span className="step-number">0{index + 1}</span>{step}{index < steps.length - 1 && <span className="step-arrow">›</span>}</div>)}</nav>
    <section className="workspace">
      <aside className="left-panel">
        <div className="panel-heading"><div><span className="eyebrow">나만의 움직이는 캐릭터</span><h1>{imageUrl ? '움직일 아이템을 만드세요' : '그림을 가져와 주세요'}</h1></div></div>
        <p className="panel-copy">{imageUrl ? '원본 그림 위에 움직일 아이템을 얹어요. 원본은 잘리거나 바뀌지 않습니다.' : '그림 한 장으로 나만의 움직이는 캐릭터를 만들어요.'}</p>
        <div className="section-label">캐릭터 그림</div>
        {project ? <div className="file-card"><div className="file-icon">▧</div><div className="file-meta"><strong title={project.sourceImage.fileName}>{project.sourceImage.fileName}</strong><span>{project.sourceImage.width} × {project.sourceImage.height}</span></div><button className="more-button" onClick={() => inputRef.current?.click()}>변경</button></div> : <button className="drop-card" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void importImage(event.dataTransfer.files[0]) }}><span className="upload-icon">{isLoading ? '…' : '↑'}</span><strong>{isLoading ? '그림을 확인하고 있어요' : '이미지를 여기에 놓으세요'}</strong><span>{isLoading ? '잠시만 기다려 주세요' : '또는 클릭하여 파일 선택'}</span><small>PNG · JPG · WEBP</small></button>}
        <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void importImage(event.target.files?.[0]); event.currentTarget.value = '' }} />
        <div className="project-file-actions"><button className="selection-button" onClick={() => window.desktop ? void window.desktop.openProject().then(result => {
          if (result.cancelled || !result.bytes) return
          void importProjectFile(new File([result.bytes], 'character.letmorph', { type: 'application/vnd.letmorph.project+json' }))
        }).catch(cause => setProjectFileError(cause instanceof Error ? cause.message : '작업 파일을 열지 못했습니다.')) : projectInputRef.current?.click()}>작업 가져오기</button><button className="selection-button" disabled={!project || !imageUrl} onClick={() => void exportProjectFile()}>작업 내보내기</button></div>
        <input ref={projectInputRef} className="visually-hidden" type="file" accept=".letmorph,application/vnd.letmorph.project+json,application/json" onChange={event => { void importProjectFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
        {projectFileError && <p className="input-error" role="alert">{projectFileError}</p>}
        {imageUrl && <>
          <div className="section-label motion-label">도구</div>
          <div className="tool-list" role="toolbar" aria-label="편집 도구">
            <button className={`tool-button ${tool === 'select' ? 'selected' : ''}`} onClick={() => setTool('select')}><b>↖</b><span>선택</span></button>
            <button className="tool-button" disabled={!selectedItem || selectedItem.source} title="빈 아이템을 추가하고 선택한 뒤 그릴 수 있어요" onClick={() => { setEditTargetId(undefined); setTool('pen') }}><b>✎</b><span>선택 아이템 그리기</span></button>
            <button className="tool-button" disabled={!selectedItem || selectedItem.source} onClick={applyWholeSelection}><b>▣</b><span>전체 영역 적용</span></button>
            <button className="tool-button add-layer-button" onClick={addEmptyItem}><b>＋</b><span>아이템 추가</span></button>
          </div>
          {!items.some(item => item.source) && <button className="selection-button restore-base" onClick={restoreBaseItem}>기본 이미지 레이어 복구</button>}
          {tool === 'pen' && <p className="selection-hint">{selectedItem?.source ? '기본 이미지에는 영역을 그릴 수 없어요. + 아이템을 추가해 선택하세요.' : `현재 아이템 “${selectedItem?.name ?? '없음'}”에 영역을 그립니다. 점을 3개 이상 찍고 시작점을 다시 누르거나 Enter를 누르면 적용돼요. Backspace는 점 하나 취소, Esc는 그리기 취소예요.`}</p>}
          <div className="section-label motion-label">아이템 목록 <span className="item-count">{items.length}</span></div>
          <button className="selection-button add-layer-action" onClick={addEmptyItem}>＋ 빈 아이템 추가</button>
          <div className="item-list">{items.length ? items.map((item, index) => <div className={`item-row ${selectedItemId === item.id ? 'selected' : ''}`} key={item.id}>
            <button className="item-select" onClick={() => { setSelectedItemId(item.id); setEditTargetId(undefined); setTool(item.empty ? 'pen' : 'select') }}><span className="item-order">{String(index + 1).padStart(2, '0')}</span><span className="item-name">{item.name}</span><small>{item.source ? '기본 이미지 레이어' : item.empty ? '빈 레이어 · 그릴 영역 없음' : item.points ? '펜 선택 영역' : '전체 선택 복사본'}</small></button>
            <button className="item-visibility" title={item.visible ? '숨기기' : '보이기'} onClick={() => commitItems(items.map(value => value.id === item.id ? { ...value, visible: !value.visible } : value))}>{item.visible ? '◉' : '○'}</button>
            <button className="item-delete" aria-label={`${item.name} 삭제`} onClick={() => deleteItem(item.id)}>×</button>
          </div>) : <p className="empty-list">아직 아이템이 없어요.<br />빈 아이템을 추가해 영역을 그려보세요.</p>}</div>
          <div className="history-actions"><button className="selection-button" disabled={!history.length} onClick={undo}>↶ 실행 취소 <kbd>Ctrl Z</kbd></button><button className="selection-button" disabled={!items.length} onClick={() => { commitItems([]); setSelectedItemId(undefined) }}>아이템 모두 지우기</button></div>
          {currentError && <p className="input-error" role="alert">{currentError}</p>}
          <div className="panel-bottom"><div className="progress-label"><span>{isExporting ? '영상 만드는 중' : imageUrl ? '저장 준비 완료' : '만들기 진행'}</span><span>{isExporting ? `${progress}%` : imageUrl ? '3 / 4' : '0 / 4'}</span></div><div className="progress-track"><div className={imageUrl ? 'progress-fill complete' : 'progress-fill'} style={isExporting ? { width: `${progress}%` } : undefined} /></div><button className="primary-button" disabled={!imageUrl || isExporting} onClick={handleExport}>{isExporting ? '영상을 만들고 있어요…' : '움직이는 영상 저장'} <span>{isExporting ? `${progress}%` : '→'}</span></button><div className="local-note">◉ 그림은 이 기기에서 처리돼요</div></div>
        </>}
      </aside>
      <section className="canvas-area" aria-label="움직임 미리보기">
        <div className="canvas-toolbar"><div className="canvas-label"><span className="live-indicator" /> 미리보기 <span className="canvas-divider">/</span> {project?.name ?? '새 캐릭터'}</div><div className="canvas-tools"><button onClick={() => setPlaying(value => !value)} title="재생/멈춤 토글 (숫자키 1)">{playing ? 'Ⅱ' : '▶'} <kbd>1</kbd></button><span>{playing ? '재생 중' : '멈춤'}</span><button className={`guide-toggle ${showGuides ? 'active' : ''}`} aria-pressed={showGuides} onClick={() => setShowGuides(value => !value)} title="가이드 토글 (숫자키 2)">{showGuides ? '가이드 숨기기' : '가이드 보기'} <kbd>2</kbd></button><span className="toolbar-divider" /><span>{tool === 'pen' ? '펜 모드' : items.length ? `${items.length}개 아이템` : '정적 원본'}</span></div></div>
        <div className={`canvas-stage ${imageUrl ? 'has-image' : ''}`}>
          {imageUrl && project ? <CanvasPreview sourceUrl={imageUrl} imageWidth={project.canvas.width} imageHeight={project.canvas.height} settings={settings} playing={playing} onError={onPreviewError} items={items} selectedItemId={selectedItemId} tool={tool} showGuides={showGuides} boundaryEdit={boundaryEdit && tool === 'select'} onBeginBoundaryEdit={rememberItems} onUpdatePoints={(id, points) => setItems(current => current.map(item => item.id === id ? { ...item, points } : item))} onClosePath={applyDrawnRegion} /> : <div className="empty-state"><div className="empty-illustration"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="empty-spark">✦</div><div className="empty-frame"><span>✧</span></div><div className="float-dot dot-one"/><div className="float-dot dot-two"/></div><h2>캐릭터에 첫 움직임을 넣어보세요</h2><p>그림을 추가하면 바로 미리 볼 수 있어요.</p><button className="outline-button" onClick={() => inputRef.current?.click()}>그림 가져오기 <span>↗</span></button></div>}
          {showGuides && <div className="canvas-coordinate">CANVAS <span>{project ? `${project.canvas.width} × ${project.canvas.height}` : '— × —'}</span></div>}
        </div>
        <div className="canvas-footer"><span>{selectedItem ? `${selectedItem.name} · ${motionOptions.find(option => option.id === selectedItem.preset)?.name}` : '움직임 아이템 없음'}</span><span>{selectedItem?.source ? '기본 이미지 레이어에 효과 적용 중' : '추가 아이템은 기본 이미지 위에서 움직입니다'}</span></div>
      </section>
      <aside className="right-panel"><div className="right-heading"><span className="eyebrow">아이템 속성</span><h2>{selectedItem?.name ?? '아이템을 선택하세요'}</h2></div>
        {selectedItem ? <div className="item-properties">
          <label className="property-name">이름<input value={selectedItem.name} onFocus={rememberItems} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, name: event.target.value } : item))} /></label>
          {selectedItem.empty && <p className="selection-hint">아직 그려진 영역이 없는 빈 아이템입니다. 펜으로 영역을 닫으면 이 아이템에 저장됩니다.</p>}
          <div className="section-label motion-label">움직임</div><div className="motion-options" role="radiogroup" aria-label="움직임 선택">{motionOptions.map(option => <button key={option.id} className={`motion-option ${selectedItem.preset === option.id ? 'selected' : ''}`} role="radio" aria-checked={selectedItem.preset === option.id} onClick={() => updateSelected({ preset: option.id })}><span className={`motion-symbol ${option.id}`}>{option.id === 'sway' ? '↝' : option.id === 'bounce' ? '↟' : '↶'}</span><span><strong>{option.name}</strong><small>{option.description}</small></span></button>)}</div>
          <label className="range-control"><span>움직임 크기 <b>{selectedItem.amount}%</b></span><input type="range" min="0" max="100" value={selectedItem.amount} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, amount: Number(event.target.value) } : item))} /></label>
          <label className="range-control"><span>아이템 크기 <b>{(selectedItem.sizeMultiplier ?? 1).toFixed(2)}×</b></span><input aria-label="선택 아이템 크기" type="range" min="0.5" max="2" step="0.05" value={selectedItem.sizeMultiplier ?? 1} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, sizeMultiplier: Number(event.target.value) } : item))} /></label>
          <label className="range-control"><span>움직임 속도 <b>{selectedItem.speed.toFixed(1)}배</b></span><input type="range" min="0.5" max="1.8" step="0.1" value={selectedItem.speed} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, speed: Number(event.target.value) } : item))} /></label>
          <div className="section-label tuning-heading">세부 조절 <small>프리셋 움직임의 축별 크기</small></div>
          {([
            ['horizontal', '좌우 이동', '좌우 움직임'], ['vertical', '위아래 이동', '위아래 움직임'], ['rotation', '회전', '기울어지는 크기'], ['scale', '크기 변화', '커지고 작아지는 정도'],
          ] as const).map(([key, label, help]) => <label className="range-control tuning-control" key={key} title={help}><span>{label} <b>{selectedItem[key] ?? 100}%</b></span><input type="range" min="-100" max="100" value={selectedItem[key] ?? 100} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, [key]: Number(event.target.value) } : item))} /></label>)}
          <div className="section-label tuning-heading">고급 모핑 <small>영역 안의 위치별 변형</small></div>
          <label className="trail-toggle"><input type="checkbox" checked={Boolean(selectedItem.morphMode)} onChange={event => updateSelected(event.target.checked ? { morphMode: 'wave', morphAmount: selectedItem.morphAmount ?? 40, morphAngle: selectedItem.morphAngle ?? 0, morphFrequency: selectedItem.morphFrequency ?? 2, morphWidthBias: selectedItem.morphWidthBias ?? 0 } : { morphMode: undefined })} /><span>공간 모핑 사용</span></label>
          {selectedItem.morphMode && <>
            <label className="range-control"><span>모핑 방식</span><select className="morph-select" value={selectedItem.morphMode} onChange={event => updateSelected({ morphMode: event.target.value as 'wave' | 'bend' | 'ripple' | 'flutter' | 'pinch' })}><option value="wave">물결</option><option value="bend">굽힘</option><option value="ripple">방사형 파동</option><option value="flutter">가장자리 펄럭임</option><option value="pinch">중심 수축·팽창</option></select></label>
            {([['morphAmount', '변형 강도', 0, 100, 1, '%'], ['morphAngle', '변형 방향', 0, 360, 1, '°'], ['morphFrequency', '공간 빈도', 1, 8, 1, ''], ['morphWidthBias', '좌우 강도 편차', -100, 100, 1, '%']] as const).map(([key, label, min, max, step, unit]) => <label className="range-control tuning-control" key={key}><span>{label} <b>{selectedItem[key] ?? (key === 'morphAmount' ? 40 : key === 'morphFrequency' ? 2 : 0)}{unit}</b></span><input type="range" min={min} max={max} step={step} value={selectedItem[key] ?? (key === 'morphAmount' ? 40 : key === 'morphFrequency' ? 2 : 0)} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, [key]: Number(event.target.value) } : item))} /></label>)}
            <p className="selection-hint">방향과 빈도로 변형의 진행 방향과 반복 수를 정합니다. 좌우 편차는 선택 영역의 좌우에 서로 다른 힘을 줍니다.</p>
          </>}
          <div className="section-label tuning-heading">잔상 효과</div>
          <label className="trail-toggle"><input type="checkbox" checked={(selectedItem.trailCount ?? 0) > 0} onChange={event => updateSelected({ trailCount: event.target.checked ? 3 : 0 })} /><span>이 아이템에 잔상 표시</span></label>
          {(selectedItem.trailCount ?? 0) > 0 && <>
            <label className="range-control tuning-control"><span>잔상 개수 <b>{selectedItem.trailCount}</b></span><input type="range" min="1" max="32" step="1" value={selectedItem.trailCount} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, trailCount: Number(event.target.value) } : item))} /></label>
            <label className="range-control tuning-control"><span>시간 간격 <b>{selectedItem.trailIntervalMs ?? 40}ms</b></span><input type="range" min="10" max="200" step="10" value={selectedItem.trailIntervalMs ?? 40} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, trailIntervalMs: Number(event.target.value) } : item))} /></label>
            <label className="range-control tuning-control"><span>잔상 불투명도 <b>{selectedItem.trailOpacity ?? 35}%</b></span><input type="range" min="5" max="80" value={selectedItem.trailOpacity ?? 35} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, trailOpacity: Number(event.target.value) } : item))} /></label>
            <label className="range-control tuning-control"><span>뒤로 갈수록 흐리게 <b>{selectedItem.trailFade ?? 75}%</b></span><input type="range" min="0" max="100" value={selectedItem.trailFade ?? 75} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, trailFade: Number(event.target.value) } : item))} /></label>
          </>}
          {selectedItem.points && <>
            <div className="section-label tuning-heading">선택 영역 다듬기</div>
            <label className="range-control tuning-control"><span>모서리 다듬기 <b>{selectedItem.edgeSmoothing ?? 0}%</b></span><input type="range" min="0" max="100" value={selectedItem.edgeSmoothing ?? 0} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, edgeSmoothing: Number(event.target.value) } : item))} /></label>
            <label className="range-control tuning-control"><span>경계 부드럽게 <b>{(selectedItem.edgeFeather ?? 0).toFixed(1)}%</b></span><input type="range" min="0" max="3" step="0.1" value={selectedItem.edgeFeather ?? 0} onPointerDown={rememberItems} onKeyDown={event => { if (event.key.startsWith('Arrow')) rememberItems() }} onChange={event => setItems(current => current.map(item => item.id === selectedItem.id ? { ...item, edgeFeather: Number(event.target.value) } : item))} /></label>
            <p className="selection-hint">모서리 다듬기는 꼭짓점을 깎아 선을 부드럽게 하고, 경계 부드럽게는 이미지 크기에 비례해 가장자리를 흐립니다.</p>
          </>}
          {selectedItem.points && <>
            <button className={`selection-button edit-region ${boundaryEdit ? 'selected' : ''}`} aria-pressed={boundaryEdit} onClick={() => { setTool('select'); setBoundaryEdit(value => !value) }}>{boundaryEdit ? '경계 조절 완료' : '경계점 조절'}</button>
            <button className="selection-button edit-region" onClick={() => { setBoundaryEdit(false); setEditTargetId(selectedItem.id); setTool('pen') }}>펜으로 영역 다시 그리기</button>
          </>}
        </div> : <div className="inspector-empty"><div className="layers-icon">▤</div><strong>목록에서 아이템을 고르거나 새로 만드세요</strong><p>선택한 아이템마다 이름과 움직임을 따로 관리할 수 있어요.</p></div>}
        <div className="format-note"><span>ⓘ</span><p>{selectedItem?.source ? '기본 이미지 레이어는 입력한 원본입니다. 효과를 바꾸거나 숨기고 삭제할 수 있으며, 삭제 후에는 기본 이미지 레이어 복구 도구로 다시 추가할 수 있습니다.' : '펜/전체 선택 아이템은 기본 이미지 위에 복사해 올립니다. 원본 픽셀은 지우지 않으므로 움직여도 바닥 그림은 유지됩니다.'}</p></div>
      </aside>
    </section>
    <footer className="statusbar"><span><i className="status-dot" />{isExporting ? '영상 저장 중' : '준비됨'}</span><span>Letmorph Studio <b>0.1.0</b></span><span>Windows 데스크톱</span></footer>
  </main>
}

