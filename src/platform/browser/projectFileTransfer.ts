import { downloadBlob } from './downloadFile'

const projectMimeType = 'application/vnd.letmorph.project+json'

export function hasDesktopProjectDialogs(): boolean {
  return Boolean(window.desktop)
}

/** Choose the native Electron save dialog or a browser download without exposing this choice to UI panels. */
export async function saveProjectFileText(contents: string, fileName: string): Promise<void> {
  const bytes = new TextEncoder().encode(contents)
  if (window.desktop) {
    await window.desktop.saveProject(bytes, fileName)
    return
  }
  downloadBlob(new Blob([contents], { type: projectMimeType }), fileName)
}

/** Return a File from the native dialog; browser callers should use their file input instead. */
export async function openDesktopProjectFile(): Promise<File | undefined> {
  if (!window.desktop) return undefined
  const result = await window.desktop.openProject()
  if (result.cancelled || !result.bytes) return undefined
  return new File([result.bytes], 'character.letmorph', { type: projectMimeType })
}
