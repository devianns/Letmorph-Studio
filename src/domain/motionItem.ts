/** Stable data model for one editable image-backed layer and its procedural motion. */
export type ImageMotionPreset = 'sway' | 'bounce' | 'nod' | 'float' | 'swing' | 'pulse' | 'wobble' | 'breathe' | 'shake'
export type SpatialMorphMode = 'wave' | 'bend' | 'ripple' | 'flutter' | 'pinch'
export type MotionItemKind = 'source' | 'empty' | 'cutout' | 'image'
export type MotionItemUpdate = Partial<Omit<MotionItem, 'id' | 'kind'>>

export interface MotionTuning {
  horizontal?: number
  vertical?: number
  rotation?: number
  scale?: number
}

export interface MotionItem extends MotionTuning {
  id: string
  name: string
  kind: MotionItemKind
  /** Undefined means the whole layer image. Otherwise points are normalized to image bounds. */
  points?: Array<{ x: number; y: number }>
  /** Additional raster layer embedded in portable project files. */
  imageDataUrl?: string
  imageWidth?: number
  imageHeight?: number
  /** Position offset from the canvas center, expressed as a percent of canvas size. */
  positionX?: number
  positionY?: number
  preset: ImageMotionPreset
  amount: number
  speed: number
  visible: boolean
  trailCount?: number
  trailIntervalMs?: number
  trailOpacity?: number
  trailFade?: number
  edgeSmoothing?: number
  edgeFeather?: number
  morphMode?: SpatialMorphMode
  morphAmount?: number
  morphAngle?: number
  morphFrequency?: number
  /** Negative favors the left side, positive favors the right side. */
  morphWidthBias?: number
  sizeMultiplier?: number
}

export interface ImageMotionPose {
  x: number
  y: number
  rotation: number
  scale: number
}
