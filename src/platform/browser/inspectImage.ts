import { ImageInputError, type ImageInputErrorCode } from '../../core/image/validateImage'
import type { ImageDimensions } from '../../domain/image'

/** Browser adapter for decoding an image without putting browser APIs in the application use case. */
export async function inspectBrowserImage(file: Blob): Promise<ImageDimensions> {
  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
    return { width: bitmap.width, height: bitmap.height }
  } catch {
    const code: ImageInputErrorCode = 'INVALID_IMAGE_DATA'
    throw new ImageInputError(code)
  } finally {
    bitmap?.close()
  }
}

export function readBrowserBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('이미지 데이터를 읽을 수 없습니다.'))
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('이미지 데이터 변환에 실패했습니다.'))
    reader.readAsDataURL(blob)
  })
}

export async function readBrowserFileText(file: File, maximumBytes: number): Promise<string> {
  if (file.size > maximumBytes) throw new Error(`작업 파일은 ${Math.floor(maximumBytes / (1024 * 1024))}MB 이하여야 합니다.`)
  return file.text()
}

export function createBrowserFileFromDataUrl(dataUrl: string, fileName: string, mimeType: string): File {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1).replace(/\s/g, '')
  let binary: string
  try { binary = atob(encoded) } catch { throw new Error('작업 파일의 원본 이미지 데이터를 읽을 수 없습니다.') }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new File([bytes], fileName, { type: mimeType })
}

export async function readBrowserImageUrlAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('원본 이미지 미리보기를 읽을 수 없습니다.')
  return readBrowserBlobAsDataUrl(await response.blob())
}

export function createBrowserImagePreview(file: Blob): string {
  return URL.createObjectURL(file)
}

export function releaseBrowserImagePreview(url: string): void {
  URL.revokeObjectURL(url)
}
