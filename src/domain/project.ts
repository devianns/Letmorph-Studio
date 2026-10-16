/** Portable, renderer-independent data for an editable character project. */
export interface CharacterProject {
  schemaVersion: 1
  id: string
  name: string
  sourceImage: SourceImage
  canvas: { width: number; height: number }
  parts: CharacterPart[]
  parameters: MotionParameter[]
  clips: MotionClip[]
}

export interface SourceImage {
  fileName: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  sizeBytes: number
  width: number
  height: number
}

export interface CharacterPart {
  id: string
  name: string
  /** Asset paths are relative to the project package. */
  image: string
  mask?: string
  order: number
  parentId?: string
  pivot: { x: number; y: number }
  transform: PartTransform
  opacity: number
}

export interface PartTransform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface MotionParameter {
  id: string
  name: string
  min: number
  max: number
  defaultValue: number
}

export interface MotionClip {
  id: string
  name: string
  durationMs: number
  loop: boolean
  tracks: MotionTrack[]
}

export type MotionTrackTarget =
  | { kind: 'part'; partId: string; property: PartTrackProperty }
  | { kind: 'parameter'; parameterId: string }

export type PartTrackProperty = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity'

export interface MotionTrack {
  id: string
  target: MotionTrackTarget
  keyframes: MotionKeyframe[]
}

export interface MotionKeyframe {
  timeMs: number
  value: number
  interpolation: 'linear' | 'step'
}
