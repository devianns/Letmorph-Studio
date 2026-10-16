import { downloadBlob } from './downloadFile'

export async function saveVideoFile(blob: Blob, fileName: string, format: 'mp4' | 'webm'): Promise<boolean> {
  if (!blob.type.toLowerCase().startsWith(`video/${format}`)) {
    throw new Error(`영상이 ${format.toUpperCase()} 형식으로 만들어지지 않았습니다. 다시 시도해 주세요.`)
  }
  if (window.desktop) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const result = await window.desktop.saveAnimation(bytes, fileName, format)
    return !result.cancelled
  }
  downloadBlob(blob, fileName)
  return true
}
