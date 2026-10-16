export interface NormalizedPoint {
  x: number
  y: number
}

type Edge = 'left' | 'right' | 'top' | 'bottom'

function inside(point: NormalizedPoint, edge: Edge): boolean {
  if (edge === 'left') return point.x >= 0
  if (edge === 'right') return point.x <= 1
  if (edge === 'top') return point.y >= 0
  return point.y <= 1
}

function intersection(from: NormalizedPoint, to: NormalizedPoint, edge: Edge): NormalizedPoint {
  if (edge === 'left' || edge === 'right') {
    const x = edge === 'left' ? 0 : 1
    const amount = (x - from.x) / (to.x - from.x)
    return { x, y: from.y + (to.y - from.y) * amount }
  }
  const y = edge === 'top' ? 0 : 1
  const amount = (y - from.y) / (to.y - from.y)
  return { x: from.x + (to.x - from.x) * amount, y }
}

/** Clips a polygon to the selected image's normalized pixel bounds. */
export function clipPolygonToUnitBounds(points: NormalizedPoint[]): NormalizedPoint[] {
  let output = points
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const input = output
    output = []
    if (!input.length) break
    let previous = input[input.length - 1]
    for (const current of input) {
      const previousInside = inside(previous, edge)
      const currentInside = inside(current, edge)
      if (currentInside) {
        if (!previousInside) output.push(intersection(previous, current, edge))
        output.push(current)
      } else if (previousInside) output.push(intersection(previous, current, edge))
      previous = current
    }
  }
  return output
}
