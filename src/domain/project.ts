/** Portable metadata for the current image-layer editor project. */
export interface CharacterProject {
  /** Version of the project metadata shape, independent of the .letmorph archive version. */
  schemaVersion: 1
  id: string
  name: string
  sourceImage: SourceImage
  canvas: { width: number; height: number }
  /** Opaque legacy v1 fields retained for lossless archive round trips; the current engine ignores them. */
  legacyArchiveData?: { parts: unknown[]; parameters: unknown[]; clips: unknown[] }
}

export interface SourceImage {
  fileName: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  sizeBytes: number
  width: number
  height: number
}
