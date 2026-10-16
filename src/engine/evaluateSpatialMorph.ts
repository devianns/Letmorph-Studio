import type { MotionItem, SpatialMorphMode } from './evaluateImageMotion'

export interface MorphOffset { x: number; y: number }

/** Returns a deterministic local displacement in output pixels for normalized mesh coordinates. */
export function evaluateSpatialMorph(
  u: number, v: number, timeMs: number, width: number, height: number,
  item: Pick<MotionItem, 'morphMode' | 'morphAmount' | 'morphAngle' | 'morphFrequency' | 'morphWidthBias' | 'speed'>,
): MorphOffset {
  const mode: SpatialMorphMode | undefined = item.morphMode
  if (!mode) return { x: 0, y: 0 }
  const amount = Math.max(0, Math.min(100, item.morphAmount ?? 0)) / 100
  if (!amount) return { x: 0, y: 0 }
  const angle = (item.morphAngle ?? 0) * Math.PI / 180
  const dx = Math.cos(angle), dy = Math.sin(angle)
  const across = (u - 0.5) * -dy + (v - 0.5) * dx
  const frequency = Math.max(1, Math.min(8, item.morphFrequency ?? 2))
  const phase = timeMs / 2400 * Math.PI * 2 * Math.max(0.25, Math.min(2.5, item.speed))
  const bias = Math.max(-100, Math.min(100, item.morphWidthBias ?? 0)) / 100
  const side = Math.max(0, 1 + bias * (u * 2 - 1))
  const amplitude = Math.min(width, height) * 0.08 * amount * side
  let displacement = 0
  if (mode === 'wave') displacement = Math.sin(across * Math.PI * frequency * 2 + phase) * amplitude
  else if (mode === 'bend') displacement = Math.sin(phase + across * Math.PI) * across * Math.abs(across) * 4 * amplitude
  else {
    const rx = u - 0.5, ry = v - 0.5
    const radius = Math.hypot(rx, ry)
    const wave = Math.sin(radius * Math.PI * frequency * 4 - phase) * amplitude
    if (radius > 1e-4) return { x: rx / radius * wave, y: ry / radius * wave }
  }
  return { x: dx * displacement, y: dy * displacement }
}
