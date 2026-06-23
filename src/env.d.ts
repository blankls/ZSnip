/// <reference types="vite/client" />

// Preload services 类型声明
interface Services {
  readFile: (file: string) => string
  writeTextFile: (text: string) => string
  writeImageFile: (base64Url: string) => string | undefined
  // Overlay 窗口专用方法
  captureScreen: () => Promise<{ base64: string | null; width: number; height: number }>
  copyToClipboard: (base64: string) => Promise<{ success: boolean }>
  saveScreenshot: (base64: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  getWindows: () => Promise<{ windows: { id: number; title: string; x: number; y: number; width: number; height: number }[] }>
  openScreenshotOverlay: () => Promise<{ success: boolean; error?: string }>
  closeScreenshotOverlay: () => Promise<void>
  confirmScreenshot: (data: { base64: string }) => Promise<void>
}

// ZTools API 扩展类型（包含 invoke 方法用于 IPC）
interface ZToolsExtended {
  onPluginEnter: (callback: (action: any) => void) => void
  onPluginOut: (callback: (processExit?: boolean) => void) => void
  outPlugin: () => void
  hideMainWindow: (isRestorePreWindow?: boolean) => boolean
  showMainWindow: () => boolean
  setExpendHeight: (height: number) => boolean
  resizeWindow: (width: number, height: number) => boolean
  showNotification: (message: string) => void
  showOpenDialog: (options: any) => string[] | undefined
  shellShowItemInFolder: (path: string) => void
  getPath: (name: string) => string
  invoke: (channel: string, ...args: any[]) => Promise<any>
}

declare global {
  interface Window {
    services: Services
    ztools: ZToolsExtended
  }
}

export {}