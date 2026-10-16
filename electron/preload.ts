import { contextBridge, ipcRenderer } from 'electron'

// Expose only explicit, typed capabilities. The renderer never receives raw Node APIs.
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  saveAnimation: (bytes: Uint8Array, suggestedName: string, extension: 'mp4' | 'webm') =>
    ipcRenderer.invoke('animation:save', { bytes, suggestedName, extension }) as Promise<{ cancelled: boolean }>,
})
