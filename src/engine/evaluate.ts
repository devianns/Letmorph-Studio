import type { CharacterProject, MotionClip, PartTransform } from '../domain/project'

export interface EvaluatedPart {
  id: string
  transform: PartTransform
  opacity: number
}

export interface EvaluatedPose {
  timeMs: number
  parts: Record<string, EvaluatedPart>
  parameters: Record<string, number>
}

/**
 * Deterministically evaluate a clip at a timestamp. Preview and offline export
 * should both call this function so the rendered frames match.
 */
export function evaluatePose(project: CharacterProject, clip: MotionClip, elapsedMs: number): EvaluatedPose {
  const timeMs = resolveTime(clip, elapsedMs)
  const parts: EvaluatedPose['parts'] = Object.fromEntries(project.parts.map(part => [part.id, {
    id: part.id,
    transform: { ...part.transform },
    opacity: part.opacity,
  }]))
  const parameters: EvaluatedPose['parameters'] = Object.fromEntries(
    project.parameters.map(parameter => [parameter.id, parameter.defaultValue]),
  )

  for (const track of clip.tracks) {
    const value = sampleTrack(track.keyframes, timeMs)
    if (value === undefined) continue

    if (track.target.kind === 'parameter') {
      const parameterId = track.target.parameterId
      const parameter = project.parameters.find(item => item.id === parameterId)
      if (parameter) parameters[parameter.id] = clamp(value, parameter.min, parameter.max)
      continue
    }

    const part = parts[track.target.partId]
    if (!part) continue
    if (track.target.property === 'opacity') {
      part.opacity = clamp(value, 0, 1)
    } else {
      part.transform[track.target.property] = value
    }
  }

  return { timeMs, parts, parameters }
}

function resolveTime(clip: MotionClip, elapsedMs: number): number {
  if (clip.durationMs <= 0) return 0
  const safeTime = Math.max(0, elapsedMs)
  return clip.loop ? safeTime % clip.durationMs : Math.min(safeTime, clip.durationMs)
}

function sampleTrack(keyframes: MotionClip['tracks'][number]['keyframes'], timeMs: number): number | undefined {
  if (keyframes.length === 0) return undefined
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs)
  if (timeMs <= sorted[0].timeMs) return sorted[0].value

  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index]
    const previous = sorted[index - 1]
    if (timeMs > next.timeMs) continue
    if (previous.interpolation === 'step' || next.timeMs <= previous.timeMs) return previous.value
    const progress = (timeMs - previous.timeMs) / (next.timeMs - previous.timeMs)
    return previous.value + (next.value - previous.value) * progress
  }

  return sorted[sorted.length - 1].value
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
