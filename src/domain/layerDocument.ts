import type { MotionItem, MotionItemUpdate, ImageMotionPreset } from './motionItem'

/** Editable layer state. This is the single source of truth for layer order, selection and undo. */
export interface LayerDocument {
  items: MotionItem[]
  selectedItemId?: string
  history: MotionItem[][]
}

export type LayerCommand =
  | { type: 'load'; items: MotionItem[]; selectedItemId?: string }
  | { type: 'clear' }
  | { type: 'select'; id?: string }
  | { type: 'add'; item: MotionItem; select?: boolean }
  | { type: 'update'; id: string; changes: MotionItemUpdate; checkpoint?: boolean }
  | { type: 'set-region'; id: string; points?: NonNullable<MotionItem['points']>; edgeSmoothing: number; edgeFeather: number }
  | { type: 'remove'; id: string }
  | { type: 'remove-all' }
  | { type: 'move'; id: string; direction: -1 | 1 }
  | { type: 'restore-source'; item: MotionItem }
  | { type: 'checkpoint' }
  | { type: 'undo' }

export const emptyLayerDocument: LayerDocument = { items: [], history: [] }

export function cloneLayerItems(items: MotionItem[]): MotionItem[] {
  return items.map(item => ({ ...item, points: item.points?.map(point => ({ ...point })) }))
}

function checkpoint(document: LayerDocument): MotionItem[][] {
  const previous = document.history[document.history.length - 1]
  if (previous && sameLayerItems(previous, document.items)) return document.history
  return [...document.history.slice(-49), cloneLayerItems(document.items)]
}

function sameLayerItems(left: MotionItem[], right: MotionItem[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => {
    const other = right[index]
    const keys = Object.keys(item) as Array<keyof MotionItem>
    if (keys.length !== Object.keys(other).length) return false
    return keys.every(key => {
      const value = item[key]
      const otherValue = other[key]
      if (key !== 'points') return value === otherValue
      const points = value as MotionItem['points']
      const otherPoints = otherValue as MotionItem['points']
      return points === otherPoints || (points?.length === otherPoints?.length
        && points?.every((point, pointIndex) => point.x === otherPoints?.[pointIndex].x && point.y === otherPoints?.[pointIndex].y))
    })
  })
}

/** Pure layer commands; React and rendering code do not own layer mutation rules. */
export function reduceLayerDocument(document: LayerDocument, command: LayerCommand): LayerDocument {
  switch (command.type) {
    case 'load': {
      const items = cloneLayerItems(command.items)
      return { items, selectedItemId: command.selectedItemId && items.some(item => item.id === command.selectedItemId)
        ? command.selectedItemId : items[0]?.id, history: [] }
    }
    case 'clear': return emptyLayerDocument
    case 'select': return { ...document, selectedItemId: command.id && document.items.some(item => item.id === command.id) ? command.id : undefined }
    case 'add': {
      const items = [...document.items, command.item]
      return { items, selectedItemId: command.select === false ? document.selectedItemId : command.item.id, history: checkpoint(document) }
    }
    case 'update': {
      if (!document.items.some(item => item.id === command.id)) return document
      return {
        items: document.items.map(item => item.id === command.id ? { ...item, ...command.changes } : item),
        selectedItemId: document.selectedItemId,
        history: command.checkpoint ? checkpoint(document) : document.history,
      }
    }
    case 'set-region': {
      const target = document.items.find(item => item.id === command.id)
      if (!target) return document
      return {
        ...document,
        items: document.items.map(item => item.id === command.id ? {
          ...item,
          kind: item.kind === 'empty' ? 'cutout' : item.kind,
          points: command.points,
          edgeSmoothing: command.edgeSmoothing,
          edgeFeather: command.edgeFeather,
        } : item),
        history: checkpoint(document),
      }
    }
    case 'remove': {
      if (!document.items.some(item => item.id === command.id)) return document
      const items = document.items.filter(item => item.id !== command.id)
      return { items, selectedItemId: document.selectedItemId === command.id ? undefined : document.selectedItemId, history: checkpoint(document) }
    }
    case 'remove-all':
      return document.items.length ? { items: [], history: checkpoint(document) } : document
    case 'move': {
      const index = document.items.findIndex(item => item.id === command.id)
      const target = index + command.direction
      if (index < 0 || target < 0 || target >= document.items.length) return document
      const items = [...document.items]
      ;[items[index], items[target]] = [items[target], items[index]]
      return { ...document, items, history: checkpoint(document) }
    }
    case 'restore-source': {
      if (document.items.some(item => item.kind === 'source')) return document
      const items = [command.item, ...document.items]
      return { items, selectedItemId: command.item.id, history: checkpoint(document) }
    }
    case 'checkpoint': return { ...document, history: checkpoint(document) }
    case 'undo': {
      if (!document.history.length) return document
      const items = cloneLayerItems(document.history[document.history.length - 1])
      return { items, selectedItemId: document.selectedItemId && items.some(item => item.id === document.selectedItemId)
        ? document.selectedItemId : undefined, history: document.history.slice(0, -1) }
    }
  }
}

export function createMotionItem(id: string, name: string, kind: 'empty' | 'source' | 'image'): MotionItem {
  const base = { id, name, kind, preset: 'sway' as ImageMotionPreset, amount: kind === 'empty' ? 65 : 45, speed: 1,
    horizontal: 100, vertical: 100, rotation: 100, scale: 100, visible: true }
  if (kind === 'source') return { ...base }
  if (kind === 'empty') return { ...base, edgeSmoothing: 0, edgeFeather: 0, trailCount: 0 }
  return { ...base, sizeMultiplier: 1, positionX: 0, positionY: 0, trailCount: 0 }
}

export function nextLayerName(items: MotionItem[]): string {
  let index = 1
  while (items.some(item => item.name === `레이어 ${index}`)) index += 1
  return `레이어 ${index}`
}
