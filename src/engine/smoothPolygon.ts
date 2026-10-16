export interface NormalizedPoint { x: number; y: number }

/** Cuts polygon corners using a single closed Chaikin pass; 0 leaves vertices untouched. */
export function smoothClosedPolygon(points: NormalizedPoint[], amount: number): NormalizedPoint[] {
  const strength = Math.max(0, Math.min(100, amount))
  if (points.length < 3 || strength === 0) return points
  const cut = 0.05 + (strength / 100) * 0.2
  const result: NormalizedPoint[] = []
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    result.push(
      { x: current.x * (1 - cut) + next.x * cut, y: current.y * (1 - cut) + next.y * cut },
      { x: current.x * cut + next.x * (1 - cut), y: current.y * cut + next.y * (1 - cut) },
    )
  }
  return result
}

export function normalizedPolygonPath(points: NormalizedPoint[]): string {
  if (!points.length) return ''
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 100} ${point.y * 100}`).join(' ')} Z`
}
