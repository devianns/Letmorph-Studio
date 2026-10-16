export const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const
export type SupportedImageType = (typeof supportedImageTypes)[number]

export type ImageInputErrorCode = 'UNSUPPORTED_TYPE' | 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_IMAGE_DATA'

export class ImageInputError extends Error {
  constructor(readonly code: ImageInputErrorCode) {
    super(code)
    this.name = 'ImageInputError'
  }
}

const maxImageBytes = 50 * 1024 * 1024

export interface ImageInputMetadata {
  type: string
  size: number
}

export function validateImageInput(file: ImageInputMetadata): asserts file is ImageInputMetadata & { type: SupportedImageType } {
  if (!supportedImageTypes.includes(file.type as SupportedImageType)) {
    throw new ImageInputError('UNSUPPORTED_TYPE')
  }
  if (file.size <= 0) throw new ImageInputError('EMPTY_FILE')
  if (file.size > maxImageBytes) throw new ImageInputError('FILE_TOO_LARGE')
}
