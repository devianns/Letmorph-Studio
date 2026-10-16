import { validateImageInput } from '../core/image/validateImage'
import { createMotionItem, nextLayerName } from '../domain/layerDocument'
import type { MotionItem } from '../domain/motionItem'
import type { ImageDimensions } from '../domain/image'

const maxImageLayers = 32
const maxEmbeddedProjectBytes = 90 * 1024 * 1024
const maxLayerDimension = 8192

export interface CreateImageMotionLayerDependencies {
  inspectImage(file: Blob): Promise<ImageDimensions>
  readDataUrl(file: Blob): Promise<string>
  createId(): string
}

/** Validate and prepare an imported image as a portable motion-layer asset. */
export async function createImageMotionLayer(
  file: File,
  existingItems: MotionItem[],
  sourceImageSizeBytes: number,
  dependencies: CreateImageMotionLayerDependencies,
): Promise<MotionItem> {
  if (existingItems.filter(item => item.imageDataUrl).length >= maxImageLayers) {
    throw new Error(`이미지 레이어는 프로젝트당 최대 ${maxImageLayers}개까지 추가할 수 있습니다.`)
  }

  validateImageInput(file)
  const dimensions = await dependencies.inspectImage(file)
  if (dimensions.width > maxLayerDimension || dimensions.height > maxLayerDimension) {
    throw new Error(`이미지 레이어의 너비와 높이는 각각 ${maxLayerDimension}px 이하여야 합니다.`)
  }

  const imageDataUrl = await dependencies.readDataUrl(file)
  const embeddedSize = sourceImageSizeBytes * 4 / 3
    + existingItems.reduce((size, item) => size + (item.imageDataUrl?.length ?? 0), 0)
    + imageDataUrl.length
  if (embeddedSize > maxEmbeddedProjectBytes) {
    throw new Error('이미지 레이어를 포함한 작업 파일 크기가 너무 큽니다. 90MB 이하가 되도록 이미지 크기를 줄여 주세요.')
  }

  return {
    ...createMotionItem(dependencies.createId(), nextLayerName(existingItems), 'image'),
    imageDataUrl,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
  }
}
