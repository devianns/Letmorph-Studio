import type { CharacterProject } from '../../domain/project'
import type { EditorDocument } from '../../domain/editorDocument'

function formatBytes(bytes: number, maxBytes: number): string {
  if (!Number.isFinite(bytes) || bytes > maxBytes) return '512 MB 초과'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '장시간'
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}시간`
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}분`
  return `${seconds.toFixed(1)}초`
}

interface EditorTopbarProps {
  project?: CharacterProject
  canvasDraft: { width: number; height: number }
  exportSettings: EditorDocument['exportSettings']
  mp4Supported: boolean
  webmSupported: boolean
  maxExportBytes: number
  estimatedExportBytes: number
  saved: boolean
  theme: 'light' | 'dark'
  onCanvasDraftChange(draft: { width: number; height: number }): void
  onApplyCanvasSize(): void
  onExportFormatChange(format: 'mp4' | 'webm'): void
  onRepeatCountChange(count: number): void
  onExport(): void
  onReset(): void
  onToggleTheme(): void
}

export function EditorTopbar({
  project, canvasDraft, exportSettings, mp4Supported, webmSupported, maxExportBytes, estimatedExportBytes,
  saved, theme, onCanvasDraftChange, onApplyCanvasSize,
  onExportFormatChange, onRepeatCountChange, onExport, onReset, onToggleTheme,
}: EditorTopbarProps) {
  const exportTooLarge = estimatedExportBytes > maxExportBytes
  return <header className="topbar">
    <div className="brand"><span className="brand-mark">L</span><span>Letmorph <span className="brand-light">Studio</span></span></div>
    <div className="project-title">{project?.name ?? '새 캐릭터'} <span className="unsaved-dot" /></div>
    <div className="top-actions">
      <button className="quiet-button" disabled={!project} onClick={onReset}>처음으로</button>
      <details className="canvas-size-menu"><summary>캔버스 {project ? `${project.canvas.width}×${project.canvas.height}` : '크기'}</summary><div className="canvas-size-fields"><label>너비<input type="number" min="64" max="32768" value={canvasDraft.width || ''} disabled={!project} onChange={event => onCanvasDraftChange({ ...canvasDraft, width: Number(event.target.value) })} /></label><label>높이<input type="number" min="64" max="32768" value={canvasDraft.height || ''} disabled={!project} onChange={event => onCanvasDraftChange({ ...canvasDraft, height: Number(event.target.value) })} /></label><button disabled={!project} onClick={onApplyCanvasSize}>적용</button></div></details>
      <label className="export-format-control"><span>형식</span><select aria-label="내보내기 형식" value={exportSettings.format} onChange={event => onExportFormatChange(event.target.value as 'mp4' | 'webm')}><option value="mp4" disabled={!mp4Supported}>MP4{mp4Supported ? '' : ' (지원 안 됨)'}</option><option value="webm" disabled={!webmSupported}>WebM{webmSupported ? '' : ' (지원 안 됨)'}</option></select></label>
      <label className="export-format-control repeat-count-control"><span>반복</span><input aria-label="영상 반복 횟수" type="number" min="1" step="1" value={exportSettings.repeatCount} onChange={event => { const count = Number(event.target.value); if (Number.isSafeInteger(count) && count > 0) onRepeatCountChange(count) }} /><small>{formatDuration(exportSettings.repeatCount * 2.4)} · 약 {formatBytes(estimatedExportBytes, maxExportBytes)}</small></label>
      <span className="save-state">{saved ? '영상이 저장됐어요' : '작업 중'}</span>
      <button className="quiet-button" disabled={!project || !(exportSettings.format === 'mp4' ? mp4Supported : webmSupported) || exportTooLarge} title={exportTooLarge ? '예상 영상이 512 MB를 넘습니다. 반복 횟수를 줄이거나 캔버스 크기를 낮춰 주세요.' : undefined} onClick={onExport}>영상 저장</button>
      <button className="theme-toggle" aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} onClick={onToggleTheme}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><small>{theme === 'dark' ? '라이트' : '다크'}</small></button>
    </div>
  </header>
}
