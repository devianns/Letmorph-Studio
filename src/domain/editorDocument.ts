import type { CharacterProject } from './project'
import type { LayerDocument, LayerCommand } from './layerDocument'
import { createMotionItem, emptyLayerDocument, nextLayerName, reduceLayerDocument } from './layerDocument'

export interface EditorDocument {
  project?: CharacterProject
  layers: LayerDocument
  exportSettings: { format: 'mp4' | 'webm'; repeatCount: number }
}

export type EditorDocumentCommand =
  | { type: 'create-project'; project: CharacterProject }
  | { type: 'replace-document'; document: EditorDocument }
  | { type: 'resize-canvas'; width: number; height: number }
  | { type: 'set-export-settings'; settings: Partial<EditorDocument['exportSettings']> }
  | { type: 'layers'; command: LayerCommand }
  | { type: 'clear' }

export const emptyEditorDocument: EditorDocument = {
  layers: emptyLayerDocument,
  exportSettings: { format: 'webm', repeatCount: 1 },
}

export function clampCanvasDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(64, Math.min(32768, Math.round(width))),
    height: Math.max(64, Math.min(32768, Math.round(height))),
  }
}

export function reduceEditorDocument(document: EditorDocument, command: EditorDocumentCommand): EditorDocument {
  switch (command.type) {
    case 'create-project': {
      const sourceLayer = createMotionItem(`${command.project.id}:source`, nextLayerName([]), 'source')
      return { ...document, project: command.project,
        layers: reduceLayerDocument(document.layers, { type: 'load', items: [sourceLayer], selectedItemId: sourceLayer.id }) }
    }
    case 'replace-document':
      return { ...command.document, layers: reduceLayerDocument(emptyLayerDocument, {
        type: 'load', items: command.document.layers.items, selectedItemId: command.document.layers.selectedItemId,
      }) }
    case 'resize-canvas': {
      if (!document.project) return document
      const canvas = clampCanvasDimensions(command.width, command.height)
      return { ...document, project: { ...document.project, canvas } }
    }
    case 'set-export-settings':
      return { ...document, exportSettings: { ...document.exportSettings, ...command.settings } }
    case 'layers': return { ...document, layers: reduceLayerDocument(document.layers, command.command) }
    case 'clear': return { ...document, project: undefined, layers: emptyLayerDocument }
  }
}
