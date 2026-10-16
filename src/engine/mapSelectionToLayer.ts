import type { CharacterProject } from '../domain/project'
import type { MotionItem } from '../domain/motionItem'
import { clipPolygonToUnitBounds } from './clipPolygon'

/** Convert canvas-normalized pen points into coordinates normalized to the target layer image. */
export function mapCanvasSelectionToLayer(
  points: Array<{ x: number; y: number }>,
  item: MotionItem,
  project: CharacterProject,
): Array<{ x: number; y: number }> {
  const imageWidth = item.imageWidth ?? project.sourceImage.width
  const imageHeight = item.imageHeight ?? project.sourceImage.height
  const size = item.sizeMultiplier ?? 1
  return clipPolygonToUnitBounds(points.map(point => ({
    x: 0.5 + (point.x - 0.5 - (item.positionX ?? 0) / 100) * project.canvas.width / (imageWidth * size),
    y: 0.5 + (point.y - 0.5 - (item.positionY ?? 0) / 100) * project.canvas.height / (imageHeight * size),
  })))
}
