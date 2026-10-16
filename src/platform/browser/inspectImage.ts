import { ImageInputError, type ImageInputErrorCode } from '../../core/image/validateImage'
import type { ImageDimensions } from '../../application/createCharacterProject'

/** Browser adapter for decoding an image without putting browser APIs in the application use case. */
export async function inspectBrowserImage(file: Blob): Promise<ImageDimensions> {
  try {
    const bitmap = await createImageBitmap(file)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    const code: ImageInputErrorCode = 'INVALID_IMAGE_DATA'
    throw new ImageInputError(code)
  }
}

export function createBrowserImagePreview(file: Blob): string {
  return URL.createObjectURL(file)
}

export function releaseBrowserImagePreview(url: string): void {
  URL.revokeObjectURL(url)
}
