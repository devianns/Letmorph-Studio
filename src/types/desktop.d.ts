export {}

declare global {
  interface Window {
    desktop?: {
      platform: string
      saveAnimation: (bytes: Uint8Array, suggestedName: string, extension: 'mp4' | 'webm') => Promise<{ cancelled: boolean }>
      saveProject: (bytes: Uint8Array, suggestedName: string) => Promise<{ cancelled: boolean }>
      openProject: () => Promise<{ cancelled: boolean; bytes?: Uint8Array }>
    }
  }
}
