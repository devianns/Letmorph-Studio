import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

let mainWindow: BrowserWindow | undefined

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#111217',
    title: 'Letmorph Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window

  const useDevServer = !app.isPackaged && !process.argv.includes('--production')
  if (useDevServer) {
    void window.loadURL('http://127.0.0.1:5173')
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

ipcMain.handle('animation:save', async (event, payload: unknown) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || !isSavePayload(payload)) {
    throw new Error('Invalid save request.')
  }
  if (payload.bytes.byteLength === 0 || payload.bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error('The animation file size is not supported.')
  }

  const safeName = payload.suggestedName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.(mp4|webm)$/i, '') + `.${payload.extension}`
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '움직이는 캐릭터 저장',
    defaultPath: safeName,
    filters: [{ name: `${payload.extension.toUpperCase()} video`, extensions: [payload.extension] }],
  })
  if (result.canceled || !result.filePath) return { cancelled: true }

  const selectedExtension = path.extname(result.filePath)
  const outputPath = selectedExtension
    ? `${result.filePath.slice(0, -selectedExtension.length)}.${payload.extension}`
    : `${result.filePath}.${payload.extension}`
  await writeFile(outputPath, Buffer.from(payload.bytes))
  return { cancelled: false }
})

ipcMain.handle('project:save', async (event, payload: unknown) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || !isProjectPayload(payload)) {
    throw new Error('Invalid project save request.')
  }
  if (payload.bytes.byteLength === 0 || payload.bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error('The project file size is not supported.')
  }
  const safeName = payload.suggestedName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.letmorph$/i, '') + '.letmorph'
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Letmorph Studio 작업 내보내기',
    defaultPath: safeName,
    filters: [{ name: 'Letmorph Studio Project', extensions: ['letmorph'] }],
  })
  if (result.canceled || !result.filePath) return { cancelled: true }
  const extension = path.extname(result.filePath)
  const outputPath = extension
    ? `${result.filePath.slice(0, -extension.length)}.letmorph`
    : `${result.filePath}.letmorph`
  await writeFile(outputPath, Buffer.from(payload.bytes))
  return { cancelled: false }
})

ipcMain.handle('project:open', async event => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Invalid project open request.')
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Letmorph Studio 작업 가져오기',
    properties: ['openFile'],
    filters: [{ name: 'Letmorph Studio Project', extensions: ['letmorph'] }],
  })
  if (result.canceled || !result.filePaths[0]) return { cancelled: true }
  const bytes = await readFile(result.filePaths[0])
  if (bytes.byteLength === 0 || bytes.byteLength > 100 * 1024 * 1024) throw new Error('The project file size is not supported.')
  return { cancelled: false, bytes: Uint8Array.from(bytes) }
})

function isProjectPayload(value: unknown): value is { bytes: Uint8Array; suggestedName: string } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return candidate.bytes instanceof Uint8Array && typeof candidate.suggestedName === 'string'
}

function isSavePayload(value: unknown): value is { bytes: Uint8Array; suggestedName: string; extension: 'mp4' | 'webm' } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return candidate.bytes instanceof Uint8Array
    && typeof candidate.suggestedName === 'string'
    && (candidate.extension === 'mp4' || candidate.extension === 'webm')
}

app.whenReady().then(() => {
  app.setName('Letmorph Studio')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
