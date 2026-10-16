import type { CharacterProject } from '../domain/project'
import type { MotionItem } from '../domain/motionItem'
import type { EditorDocument } from '../domain/editorDocument'

export interface PortableProjectFile {
  format: 'letmorph-studio-project'
  formatVersion: 1
  project: LegacyCharacterProject
  sourceImageDataUrl: string
  items: LegacyMotionItem[]
  selectedItemId?: string
  exportSettings: { format: 'mp4' | 'webm'; repeatCount: number }
}

type LegacyMotionItem = Omit<MotionItem, 'kind'> & { source?: boolean; empty?: boolean }
type LegacyCharacterProject = Omit<CharacterProject, 'legacyArchiveData'> & {
  parts: unknown[]
  parameters: unknown[]
  clips: unknown[]
}

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
const allowedPresets = ['sway', 'bounce', 'nod', 'float', 'swing', 'pulse', 'wobble', 'breathe', 'shake']
const allowedMorphModes = ['wave', 'bend', 'ripple', 'flutter', 'pinch']
export const maxPortableProjectFileBytes = 100 * 1024 * 1024

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMotionItem(value: unknown): value is LegacyMotionItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.visible !== 'boolean') return false
  if (!allowedPresets.includes(String(item.preset)) || !isFiniteNumber(item.amount) || !isFiniteNumber(item.speed)) return false
  if (item.source !== undefined && typeof item.source !== 'boolean') return false
  if (item.empty !== undefined && typeof item.empty !== 'boolean') return false
  if (item.source === true && item.empty === true) return false
  if (item.source === true && item.imageDataUrl !== undefined) return false
  if (item.empty === true && (item.imageDataUrl !== undefined || item.points !== undefined)) return false
  if (item.imageDataUrl !== undefined && (typeof item.imageDataUrl !== 'string'
    || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(item.imageDataUrl))) return false
  for (const key of ['imageWidth', 'imageHeight'] as const) {
    if (item[key] !== undefined && (!isFiniteNumber(item[key]) || item[key] < 1 || item[key] > 8192)) return false
  }
  for (const key of ['positionX', 'positionY'] as const) {
    if (item[key] !== undefined && (!isFiniteNumber(item[key]) || item[key] < -300 || item[key] > 300)) return false
  }
  if (item.morphMode !== undefined && !allowedMorphModes.includes(String(item.morphMode))) return false
  for (const [key, min, max] of [['morphAmount', 0, 100], ['morphAngle', 0, 360], ['morphFrequency', 1, 8], ['morphWidthBias', -100, 100], ['sizeMultiplier', 0.1, 5]] as const) {
    if (item[key] !== undefined && (!isFiniteNumber(item[key]) || item[key] < min || item[key] > max)) return false
  }
  if (item.points !== undefined && (!Array.isArray(item.points) || item.points.length < 3 || item.points.length > 10000
    || !item.points.every(point => typeof point === 'object' && point !== null
      && isFiniteNumber((point as Record<string, unknown>).x) && isFiniteNumber((point as Record<string, unknown>).y)
      && (point as Record<string, number>).x >= 0 && (point as Record<string, number>).x <= 1
      && (point as Record<string, number>).y >= 0 && (point as Record<string, number>).y <= 1))) return false
  return true
}

function isCharacterProject(value: unknown): value is LegacyCharacterProject {
  if (typeof value !== 'object' || value === null) return false
  const project = value as Record<string, unknown>
  if (project.schemaVersion !== 1 || typeof project.id !== 'string' || typeof project.name !== 'string') return false
  if (typeof project.sourceImage !== 'object' || project.sourceImage === null || typeof project.canvas !== 'object' || project.canvas === null) return false
  const source = project.sourceImage as Record<string, unknown>
  const canvas = project.canvas as Record<string, unknown>
  return allowedMimeTypes.includes(String(source.mimeType))
    && typeof source.fileName === 'string'
    && isFiniteNumber(canvas.width) && canvas.width > 0 && canvas.width <= 32768
    && isFiniteNumber(canvas.height) && canvas.height > 0 && canvas.height <= 32768
    && Array.isArray(project.parts) && Array.isArray(project.parameters) && Array.isArray(project.clips)
}

function serializePortableProjectFile(
  document: EditorDocument,
  sourceImageDataUrl: string,
): string {
  if (!document.project) throw new Error('저장할 프로젝트가 없습니다.')
  const archive: PortableProjectFile = {
    format: 'letmorph-studio-project', formatVersion: 1,
    project: toLegacyCharacterProject(document.project), sourceImageDataUrl,
    items: document.layers.items.map(toLegacyMotionItem), selectedItemId: document.layers.selectedItemId,
    exportSettings: document.exportSettings,
  }
  return JSON.stringify(archive)
}

function toLegacyCharacterProject(project: CharacterProject): LegacyCharacterProject {
  const { legacyArchiveData, ...metadata } = project
  return {
    ...metadata,
    parts: legacyArchiveData?.parts ?? [],
    parameters: legacyArchiveData?.parameters ?? [],
    clips: legacyArchiveData?.clips ?? [],
  }
}

/** Keep the v1 archive shape stable while the runtime model uses an explicit layer kind. */
function toLegacyMotionItem(item: MotionItem): LegacyMotionItem {
  const { kind, ...legacy } = item
  if (kind === 'source') return { ...legacy, source: true }
  if (kind === 'empty') return { ...legacy, empty: true }
  return legacy
}

function fromLegacyMotionItem(item: LegacyMotionItem): MotionItem {
  const { source, empty, ...data } = item
  const kind = source ? 'source' : empty ? 'empty' : item.imageDataUrl ? 'image' : 'cutout'
  return { ...data, kind }
}

/** Build the complete portable output from the runtime document and a platform-provided source image reader. */
export async function exportPortableProjectFile(
  document: EditorDocument,
  sourceImageUrl: string,
  readSourceImage: (url: string) => Promise<string>,
): Promise<{ contents: string; fileName: string }> {
  if (!document.project || !sourceImageUrl) throw new Error('저장할 프로젝트나 원본 이미지가 없습니다.')
  const sourceImageDataUrl = await readSourceImage(sourceImageUrl)
  const fileName = `${document.project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.letmorph`
  return { contents: serializePortableProjectFile(document, sourceImageDataUrl), fileName }
}

/** Decode the legacy v1 file shape into the runtime document without browser or Electron APIs. */
export function deserializePortableProjectFile(contents: string, fileSizeBytes: number): { document: EditorDocument; sourceImageDataUrl: string } {
  if (fileSizeBytes > maxPortableProjectFileBytes) throw new Error('작업 파일은 100MB 이하여야 합니다.')
  let parsed: unknown
  try { parsed = JSON.parse(contents) } catch { throw new Error('작업 파일을 읽을 수 없습니다. 파일이 손상되었는지 확인해 주세요.') }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Letmorph Studio 작업 파일이 아닙니다.')
  const archive = parsed as Record<string, unknown>
  if (archive.format !== 'letmorph-studio-project' || archive.formatVersion !== 1
    || !isCharacterProject(archive.project) || !Array.isArray(archive.items)
    || archive.items.length > 500 || !archive.items.every(isMotionItem)) {
    throw new Error('지원하지 않거나 손상된 작업 파일입니다.')
  }
  if (archive.items.filter(item => Boolean((item as MotionItem).imageDataUrl)).length > 32) {
    throw new Error('이미지 레이어는 작업 파일당 최대 32개까지 지원합니다.')
  }
  const exportSettings = archive.exportSettings as Record<string, unknown> | undefined
  if (!exportSettings || !['mp4', 'webm'].includes(String(exportSettings.format))
    || typeof exportSettings.repeatCount !== 'number' || !Number.isSafeInteger(exportSettings.repeatCount) || exportSettings.repeatCount < 1) {
    throw new Error('작업 파일의 영상 저장 설정이 올바르지 않습니다.')
  }
  if (typeof archive.sourceImageDataUrl !== 'string') throw new Error('작업 파일에 원본 이미지가 없습니다.')
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(archive.sourceImageDataUrl)
  if (!match || match[1] !== archive.project.sourceImage.mimeType) throw new Error('작업 파일의 원본 이미지 형식이 올바르지 않습니다.')
  const base64 = match[2].replace(/\s/g, '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error('작업 파일의 원본 이미지 데이터를 읽을 수 없습니다.')
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const sourceImageBytes = Math.floor(base64.length * 3 / 4) - padding
  if (sourceImageBytes <= 0 || sourceImageBytes > 50 * 1024 * 1024) throw new Error('작업 파일의 원본 이미지는 50MB 이하여야 합니다.')
  const { parts, parameters, clips, ...projectMetadata } = archive.project
  const project: CharacterProject = {
    ...projectMetadata,
    legacyArchiveData: { parts, parameters, clips },
  }
  return {
    document: {
      project,
      layers: { items: (archive.items as LegacyMotionItem[]).map(fromLegacyMotionItem), selectedItemId: typeof archive.selectedItemId === 'string' ? archive.selectedItemId : undefined, history: [] },
      exportSettings: {
        format: exportSettings.format as 'mp4' | 'webm',
        repeatCount: Math.floor(exportSettings.repeatCount),
      },
    },
    sourceImageDataUrl: archive.sourceImageDataUrl,
  }
}
