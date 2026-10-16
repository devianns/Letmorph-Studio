export type ImageMotionPreset = 'sway' | 'bounce' | 'nod' | 'float' | 'swing' | 'pulse' | 'wobble' | 'breathe' | 'shake'

export type SpatialMorphMode = 'wave' | 'bend' | 'ripple'

export interface MotionTuning {
  horizontal?: number
  vertical?: number
  rotation?: number
  scale?: number
}

export interface ImageMotionSettings extends MotionTuning {
  preset: ImageMotionPreset
  amount: number
  speed: number
  background: string
  items?: MotionItem[]
}

export interface MotionItem extends MotionTuning {
  id: string
  name: string
  /** Undefined means the whole source image. Otherwise points are normalized to image bounds. */
  points?: Array<{ x: number; y: number }>
  /** The input image itself is the bottom/source layer; other whole-image items are copies above it. */
  source?: boolean
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
  /** Optional local mesh deformation, independent from the whole-item pose. */
  morphMode?: SpatialMorphMode
  morphAmount?: number
  morphAngle?: number
  morphFrequency?: number
  /** Negative favors the left side, positive favors the right side. */
  morphWidthBias?: number
}

export interface ImageMotionPose {
  x: number
  y: number
  rotation: number
  scale: number
}

/** Deterministic pose. The same timestamp and settings always produce the same pose. */
export function evaluateImageMotion(
  timeMs: number,
  imageWidth: number,
  imageHeight: number,
  settings: Pick<ImageMotionSettings, 'preset' | 'amount' | 'speed'> & MotionTuning,
): ImageMotionPose {
  const amount = Math.max(0, Math.min(1, settings.amount / 100))
  const speed = Math.max(0.25, Math.min(2.5, settings.speed))
  const horizontal = Math.max(-1, Math.min(1, (settings.horizontal ?? 100) / 100))
  const vertical = Math.max(-1, Math.min(1, (settings.vertical ?? 100) / 100))
  const rotation = Math.max(-1, Math.min(1, (settings.rotation ?? 100) / 100))
  const scale = Math.max(-1, Math.min(1, (settings.scale ?? 100) / 100))
  const phase = (timeMs / 2400) * Math.PI * 2 * speed
  let x = 0
  let y = 0
  let turn = 0
  let size = 0

  switch (settings.preset) {
    case 'bounce':
      x = Math.sin(phase) * imageWidth * 0.012
      y = -Math.abs(Math.sin(phase)) * imageHeight * 0.045
      turn = Math.sin(phase) * 0.025
      size = Math.max(0, Math.cos(phase)) * 0.018
      break
    case 'nod':
      y = Math.sin(phase) * imageHeight * 0.018
      turn = Math.sin(phase) * 0.09
      break
    case 'float':
      x = Math.sin(phase * 0.65) * imageWidth * 0.018
      y = Math.sin(phase) * imageHeight * 0.035
      turn = Math.sin(phase * 0.5) * 0.025
      size = Math.sin(phase + Math.PI / 2) * 0.012
      break
    case 'swing':
      x = Math.sin(phase) * imageWidth * 0.012
      y = Math.sin(phase * 2) * imageHeight * 0.009
      turn = Math.sin(phase) * 0.18
      break
    case 'pulse':
      size = Math.sin(phase) * 0.055
      break
    case 'wobble':
      x = Math.sin(phase * 2) * imageWidth * 0.014
      y = Math.sin(phase * 3) * imageHeight * 0.012
      turn = Math.sin(phase * 2) * 0.12
      size = Math.sin(phase * 2 + Math.PI / 2) * 0.012
      break
    case 'breathe':
      size = (0.5 + 0.5 * Math.sin(phase)) * 0.035
      y = -Math.max(0, Math.sin(phase)) * imageHeight * 0.008
      break
    case 'shake':
      x = Math.sin(phase * 3) * imageWidth * 0.009
      y = Math.sin(phase * 4) * imageHeight * 0.004
      turn = Math.sin(phase * 3) * 0.055
      break
    case 'sway':
    default:
      x = Math.sin(phase) * imageWidth * 0.018
      y = Math.sin(phase * 2) * imageHeight * 0.008
      turn = Math.sin(phase) * 0.07
      size = Math.sin(phase + Math.PI / 2) * 0.008
      break
  }

  return {
    x: x * horizontal * amount,
    y: y * vertical * amount,
    rotation: turn * rotation * amount,
    scale: 1 + size * scale * amount,
  }
}
