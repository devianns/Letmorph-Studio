import type { CharacterProject } from '../domain/project'
import type { MotionItem } from '../engine/evaluateImageMotion'

export interface PortableProjectFile {
  format: 'letmorph-studio-project'
  formatVersion: 1
  project: CharacterProject
  sourceImageDataUrl: string
  items: MotionItem[]
  selectedItemId?: string
  exportSettings: { format: 'mp4' | 'webm'; repeatCount: number }
}

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
const allowedPresets = ['sway', 'bounce', 'nod', 'float', 'swing', 'pulse', 'wobble', 'breathe', 'shake']
const allowedMorphModes = ['wave', 'bend', 'ripple', 'flutter', 'pinch']

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMotionItem(value: unknown): value is MotionItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.visible !== 'boolean') return false
  if (!allowedPresets.includes(String(item.preset)) || !isFiniteNumber(item.amount) || !isFiniteNumber(item.speed)) return false
  if (item.source !== undefined && typeof item.source !== 'boolean') return false
  if (item.empty !== undefined && typeof item.empty !== 'boolean') return false
  if (item.source === true && item.empty === true) return false
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

function isCharacterProject(value: unknown): value is CharacterProject {
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

export function createPortableProjectFile(
  project: CharacterProject,
  sourceImageDataUrl: string,
  items: MotionItem[],
  selectedItemId: string | undefined,
  exportSettings: PortableProjectFile['exportSettings'],
): PortableProjectFile {
  return { format: 'letmorph-studio-project', formatVersion: 1, project, sourceImageDataUrl, items, selectedItemId, exportSettings }
}

export function parsePortableProjectFile(contents: string): { archive: PortableProjectFile; sourceImage: File } {
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
  let binary: string
  try { binary = atob(match[2].replace(/\s/g, '')) } catch { throw new Error('작업 파일의 원본 이미지 데이터를 읽을 수 없습니다.') }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  if (bytes.byteLength === 0 || bytes.byteLength > 50 * 1024 * 1024) throw new Error('작업 파일의 원본 이미지는 50MB 이하여야 합니다.')
  const project = archive.project
  const sourceImage = new File([bytes], project.sourceImage.fileName, { type: project.sourceImage.mimeType })
  return {
    archive: {
      format: 'letmorph-studio-project',
      formatVersion: 1,
      project,
      sourceImageDataUrl: archive.sourceImageDataUrl,
      items: archive.items,
      selectedItemId: typeof archive.selectedItemId === 'string' ? archive.selectedItemId : undefined,
      exportSettings: {
        format: exportSettings.format as 'mp4' | 'webm',
        repeatCount: Math.floor(exportSettings.repeatCount),
      },
    },
    sourceImage,
  }
}
