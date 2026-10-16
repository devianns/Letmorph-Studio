export {}

declare global {
  interface Window {
    desktop?: {
      platform: string
      saveAnimation: (bytes: Uint8Array, suggestedName: string, extension: 'mp4' | 'webm') => Promise<{ cancelled: boolean }>
    }
  }
}
