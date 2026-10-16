import type { CharacterProject, SourceImage } from '../domain/project'
import type { ImageDimensions } from '../domain/image'
import { validateImageInput } from '../core/image/validateImage'

export interface CharacterProjectDependencies {
  inspectImage: (file: Blob) => Promise<ImageDimensions>
  createId: () => string
}

/** Application use case: validate an image and create the initial editable project state. */
export async function createCharacterProject(
  file: File,
  dependencies: CharacterProjectDependencies,
): Promise<CharacterProject> {
  validateImageInput(file)
  const dimensions = await dependencies.inspectImage(file)
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error('INVALID_IMAGE_DATA')
  }

  const sourceImage: SourceImage = {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    width: dimensions.width,
    height: dimensions.height,
  }

  return {
    schemaVersion: 1,
    id: dependencies.createId(),
    name: file.name.replace(/\.[^.]+$/, '') || '내 캐릭터',
    sourceImage,
    canvas: { width: dimensions.width, height: dimensions.height },
  }
}
