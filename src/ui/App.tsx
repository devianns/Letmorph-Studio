import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useAnimationExport } from './hooks/useAnimationExport'
import { useCharacterProject } from './hooks/useCharacterProject'
import type { ImageMotionSettings } from '../engine/evaluateImageMotion'
import type { MotionItemUpdate } from '../domain/motionItem'
import { mapCanvasSelectionToLayer } from '../engine/mapSelectionToLayer'
import { estimateVideoBytes, isVideoFormatSupported, MAX_VIDEO_EXPORT_BYTES } from '../platform/browser/recordVideo'
import { exportPortableProjectFile } from '../application/portableProjectFile'
import { hasDesktopProjectDialogs, openDesktopProjectFile, saveProjectFileText } from '../platform/browser/projectFileTransfer'
import { createMotionItem, nextLayerName, type LayerCommand } from '../domain/layerDocument'
import { createImageMotionLayer } from '../application/createImageMotionLayer'
import { inspectBrowserImage, readBrowserBlobAsDataUrl, readBrowserImageUrlAsDataUrl } from '../platform/browser/inspectImage'
import { clampCanvasDimensions, emptyEditorDocument, reduceEditorDocument } from '../domain/editorDocument'
import { PropertiesPanel, motionOptions } from './components/PropertiesPanel'
import { CanvasWorkspace } from './components/CanvasWorkspace'
import { ProjectLayerPanel } from './components/ProjectLayerPanel'
import { EditorTopbar } from './components/EditorTopbar'

type EditorTool = 'select' | 'pen'
const steps = ['그림 가져오기', '아이템 만들기', '움직임 조절', '영상 저장']

function createInitialEditorDocument() {
  return {
    ...emptyEditorDocument,
    exportSettings: { format: isVideoFormatSupported('webm') ? 'webm' as const : 'mp4' as const, repeatCount: 1 },
  }
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { imageUrl, error: importError, isLoading, importImage, importProjectFile: loadProjectFile, clearProject } = useCharacterProject()
  const { isExporting, progress, error: exportError, saved, exportAnimation } = useAnimationExport()
  const [editorDocument, dispatchEditorDocument] = useReducer(reduceEditorDocument, emptyEditorDocument, createInitialEditorDocument)
  const { project, exportSettings } = editorDocument
  const { items, history, selectedItemId } = editorDocument.layers
  const [tool, setTool] = useState<EditorTool>('select')
  const [playing, setPlaying] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [boundaryEdit, setBoundaryEdit] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('letmorph-theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  const [previewError, setPreviewError] = useState<string>()
  const [projectFileError, setProjectFileError] = useState<string>()
  const [canvasDraft, setCanvasDraft] = useState({ width: 0, height: 0 })
  const latestItems = useRef(items)
  const latestProjectId = useRef(project?.id)
  const imageLayerImporting = useRef(false)
  latestItems.current = items
  latestProjectId.current = project?.id
  const selectedItem = items.find(item => item.id === selectedItemId)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('letmorph-theme', theme) } catch { /* Theme still works for this session. */ }
  }, [theme])

  const dispatchLayerCommand = (command: LayerCommand) => dispatchEditorDocument({ type: 'layers', command })
  const rememberItems = () => dispatchLayerCommand({ type: 'checkpoint' })
  const updateItem = (id: string, changes: MotionItemUpdate) => dispatchLayerCommand({ type: 'update', id, changes })
  const undo = useCallback(() => dispatchEditorDocument({ type: 'layers', command: { type: 'undo' } }), [])
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
      if (shortcutAllowed && event.key === '3' && selectedItem?.points?.length) {
        event.preventDefault()
        setTool('select')
        setBoundaryEdit(value => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedItem?.id, Boolean(selectedItem?.points?.length), undo])
  const addEmptyItem = () => {
    const item = createMotionItem(crypto.randomUUID(), nextLayerName(items), 'empty')
    dispatchLayerCommand({ type: 'add', item })
    setTool('pen')
  }
  const importCharacterImage = async (file?: File) => {
    const nextProject = await importImage(file)
    if (!nextProject) return
    dispatchEditorDocument({ type: 'create-project', project: nextProject })
    setCanvasDraft({ width: nextProject.canvas.width, height: nextProject.canvas.height })
    setTool('select')
  }
  const addImageLayer = async (file?: File) => {
    if (!file || !project || imageLayerImporting.current) return
    const projectId = project.id
    imageLayerImporting.current = true
    try {
      const item = await createImageMotionLayer(file, latestItems.current, project.sourceImage.sizeBytes, {
        inspectImage: inspectBrowserImage,
        readDataUrl: readBrowserBlobAsDataUrl,
        createId: () => crypto.randomUUID(),
      })
      if (latestProjectId.current !== projectId) return
      dispatchLayerCommand({ type: 'add', item })
      setTool('select')
      setProjectFileError(undefined)
    } catch (cause) {
      setProjectFileError(cause instanceof Error ? cause.message : '이미지 레이어를 읽을 수 없습니다. 다른 이미지로 다시 시도해 주세요.')
    } finally {
      imageLayerImporting.current = false
    }
  }
  const applyCanvasSize = () => {
    const canvas = clampCanvasDimensions(canvasDraft.width, canvasDraft.height)
    setCanvasDraft(canvas)
    dispatchEditorDocument({ type: 'resize-canvas', ...canvas })
  }
  const moveItem = (id: string, direction: -1 | 1) => {
    dispatchLayerCommand({ type: 'move', id, direction })
  }
  const applyWholeSelection = () => {
    if (!selectedItem) return
    dispatchLayerCommand({ type: 'set-region', id: selectedItem.id, points: undefined,
      edgeSmoothing: selectedItem.edgeSmoothing ?? 0, edgeFeather: selectedItem.edgeFeather ?? 0 })
    setTool('select')
  }
  const updateSelected = (update: MotionItemUpdate) => {
    if (!selectedItem) return
    dispatchLayerCommand({ type: 'update', id: selectedItem.id, changes: update, checkpoint: true })
  }
  const updateSelectedItem = (changes: MotionItemUpdate) => {
    if (!selectedItem) return
    updateItem(selectedItem.id, changes)
  }
  const applyDrawnRegion = (targetId: string, points: Array<{ x: number; y: number }>) => {
    const target = items.find(item => item.id === targetId)
    if (!target || !project) return
    const localPoints = mapCanvasSelectionToLayer(points, target, project)
    if (localPoints.length < 3) {
      setProjectFileError(`그린 영역이 “${target.name}” 이미지와 겹치지 않습니다. 선택한 레이어 위에서 다시 그려 주세요.`)
      return
    }
    setProjectFileError(undefined)
    dispatchLayerCommand({ type: 'set-region', id: target.id, points: localPoints,
      edgeSmoothing: target.edgeSmoothing ?? 0, edgeFeather: target.edgeFeather ?? 0 })
    dispatchLayerCommand({ type: 'select', id: target.id })
  }
  const deleteItem = (id: string) => {
    dispatchLayerCommand({ type: 'remove', id })
  }
  const restoreBaseItem = () => {
    if (!project || items.some(item => item.kind === 'source')) return
    const baseItem = createMotionItem(`${project.id}:source`, nextLayerName(items), 'source')
    dispatchLayerCommand({ type: 'restore-source', item: baseItem })
  }
  const resetProject = () => {
    clearProject(); dispatchEditorDocument({ type: 'clear' }); setTool('select')
  }
  const exportProjectFile = async () => {
    if (!project || !imageUrl) return
    try {
      const { contents, fileName } = await exportPortableProjectFile(editorDocument, imageUrl, readBrowserImageUrlAsDataUrl)
      await saveProjectFileText(contents, fileName)
      setProjectFileError(undefined)
    } catch (cause) {
      setProjectFileError(cause instanceof Error ? cause.message : '작업 파일 내보내기에 실패했습니다.')
    }
  }
  const restoreProjectFile = async (file?: File) => {
    if (!file) return
    try {
      const document = await loadProjectFile(file)
      if (!document?.project) return
      dispatchEditorDocument({ type: 'replace-document', document })
      setCanvasDraft({ width: document.project.canvas.width, height: document.project.canvas.height })
      setTool('select')
      setProjectFileError(undefined)
    } catch (cause) {
      setProjectFileError(cause instanceof Error ? cause.message : '작업 파일을 가져오지 못했습니다.')
    }
  }
  const openProject = async (): Promise<boolean> => {
    if (!hasDesktopProjectDialogs()) return false
    try {
      const file = await openDesktopProjectFile()
      if (file) await restoreProjectFile(file)
      return true
    } catch (cause) {
      setProjectFileError(cause instanceof Error ? cause.message : '작업 파일을 열지 못했습니다.')
      return true
    }
  }
  const settings = useMemo<ImageMotionSettings>(() => ({
    preset: selectedItem?.preset ?? 'sway', amount: selectedItem?.amount ?? 65, speed: selectedItem?.speed ?? 1,
    background: '#f2efe8', canvasWidth: project?.canvas.width, canvasHeight: project?.canvas.height, items,
  }), [items, project?.canvas.height, project?.canvas.width, selectedItem])
  const estimatedExportBytes = estimateVideoBytes(settings, 2400 * exportSettings.repeatCount)
  const onPreviewError = useCallback((message: string) => setPreviewError(message), [])
  const handleExport = () => { if (imageUrl) void exportAnimation(imageUrl, settings, exportSettings.format, exportSettings.repeatCount) }
  const currentError = importError ?? exportError ?? projectFileError ?? previewError

  return <main className="app-shell" data-theme={theme}>
    <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void importCharacterImage(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <EditorTopbar project={project} canvasDraft={canvasDraft} exportSettings={exportSettings} mp4Supported={isVideoFormatSupported('mp4')} webmSupported={isVideoFormatSupported('webm')} maxExportBytes={MAX_VIDEO_EXPORT_BYTES} estimatedExportBytes={estimatedExportBytes} saved={saved} theme={theme} onCanvasDraftChange={setCanvasDraft} onApplyCanvasSize={applyCanvasSize} onExportFormatChange={format => dispatchEditorDocument({ type: 'set-export-settings', settings: { format } })} onRepeatCountChange={repeatCount => dispatchEditorDocument({ type: 'set-export-settings', settings: { repeatCount } })} onExport={handleExport} onReset={resetProject} onToggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} />
    <nav className="workflow" aria-label="만들기 단계">{steps.map((step, index) => <div className={`workflow-step ${index === (imageUrl ? 1 : 0) ? 'active' : ''}`} key={step}><span className="step-number">0{index + 1}</span>{step}{index < steps.length - 1 && <span className="step-arrow">›</span>}</div>)}</nav>
    <section className="workspace">
      <ProjectLayerPanel project={project} imageUrl={imageUrl} isLoading={isLoading} tool={tool} items={items} history={history} selectedItemId={selectedItemId} error={currentError} progress={progress} isExporting={isExporting} onImportCharacterImage={importCharacterImage} onAddImageLayer={addImageLayer} onOpenProject={openProject} onImportProjectFile={restoreProjectFile} onSaveProject={() => void exportProjectFile()} onRequestSourceImage={() => inputRef.current?.click()} onSelectTool={setTool} onApplyWholeSelection={applyWholeSelection} onAddEmptyItem={addEmptyItem} onRestoreBaseItem={restoreBaseItem} onSelectItem={item => { dispatchLayerCommand({ type: 'select', id: item.id }); if (item.kind === 'empty') setTool('pen') }} onToggleVisibility={item => dispatchLayerCommand({ type: 'update', id: item.id, changes: { visible: !item.visible }, checkpoint: true })} onMoveItem={moveItem} onDeleteItem={deleteItem} onUndo={undo} onRemoveAll={() => dispatchLayerCommand({ type: 'remove-all' })} onExport={handleExport} />
      <CanvasWorkspace imageUrl={imageUrl} imageWidth={project?.sourceImage.width} imageHeight={project?.sourceImage.height} canvasWidth={project?.canvas.width} canvasHeight={project?.canvas.height} projectName={project?.name} settings={settings} items={items} selectedItem={selectedItem} selectedMotionName={motionOptions.find(option => option.id === selectedItem?.preset)?.name} selectedItemId={selectedItemId} tool={tool} playing={playing} showGuides={showGuides} boundaryEdit={boundaryEdit} onTogglePlaying={() => setPlaying(value => !value)} onToggleGuides={() => setShowGuides(value => !value)} onToggleBoundaryEdit={() => { setTool('select'); setBoundaryEdit(value => !value) }} onPreviewError={onPreviewError} onBeginBoundaryEdit={rememberItems} onBeginItemMove={rememberItems} onUpdateItemPosition={(id, positionX, positionY) => dispatchLayerCommand({ type: 'update', id, changes: { positionX, positionY } })} onUpdatePoints={(id, points) => dispatchLayerCommand({ type: 'update', id, changes: { points } })} onClosePath={applyDrawnRegion} onRequestImageImport={() => inputRef.current?.click()} />
      <PropertiesPanel item={selectedItem} tool={tool} onCheckpoint={rememberItems} onUpdate={updateSelectedItem} onCommit={updateSelected} onSelectTool={setTool} onDisableBoundaryEdit={() => setBoundaryEdit(false)} />
    </section>
    <footer className="statusbar"><span><i className="status-dot" />{isExporting ? '영상 저장 중' : '준비됨'}</span><span>Letmorph Studio <b>0.1.0</b></span><span>Windows 데스크톱</span></footer>
  </main>
}
