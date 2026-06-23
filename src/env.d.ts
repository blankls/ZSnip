/// <reference types="vite/client" />

// ========== Preload services 类型声明 ==========

interface WindowInfo {
    id: number
    title: string
    x: number
    y: number
    width: number
    height: number
}

interface DisplayInfo {
    width: number
    height: number
    x: number
    y: number
    id: number
    scaleFactor: number
}

interface ScreenshotConfig {
    strokeColor: string
    strokeWidth: number
    fontSize: number
    mosaicSize: number
}

interface Services {
    // 文件操作（Node.js 能力）
    readFile: (file: string) => string
    writeTextFile: (text: string) => string
    writeImageFile: (base64Url: string) => string | undefined

    // 截图相关（使用 ZTools 官方 API）
    captureScreen: () => Promise<{ base64: string; width: number; height: number }>
    copyToClipboard: (base64: string) => Promise<{ success: boolean }>
    saveScreenshot: (base64: string) => Promise<{ success: boolean; filePath?: string; error?: string }>

    // 显示器信息（使用 ZTools 官方 API）
    getDisplays: () => DisplayInfo[]
    getPrimaryDisplay: () => { width: number; height: number; scaleFactor: number }
    getCursorScreenPoint: () => { x: number; y: number }

    // 窗口创建（使用 ZTools 官方 API）
    createOverlayWindow: (url: string) => Promise<{ success: boolean; error?: string }>

    // 窗口枚举（Node.js 能力）
    getWindows: () => Promise<{ windows: WindowInfo[] }>

    // 用户偏好持久化（使用 ZTools 官方 API）
    getConfig: () => ScreenshotConfig
    saveConfig: (config: Partial<ScreenshotConfig>) => void
}

// ========== ZTools API 类型声明（仅包含官方 API） ==========

interface ZToolsAPI {
    // 基础 API
    getAppName: () => string
    getPathForFile: (file: File) => string
    isMacOs: () => boolean
    isMacOS: () => boolean
    isWindows: () => boolean
    isLinux: () => boolean
    getNativeId: () => string
    getAppVersion: () => string
    getWindowType: () => string
    isDarkColors: () => boolean
    isDev: () => boolean
    getWebContentsId: () => number
    setExpendHeight: (height: number) => boolean
    showNotification: (body: string) => void

    // 模拟输入
    sendInputEvent: (event: any) => void
    simulateKeyboardTap: (key: string, ...modifiers: string[]) => boolean

    // 窗口管理
    showMainWindow: () => Promise<boolean>
    hideMainWindow: (isRestorePreWindow?: boolean) => Promise<boolean>
    outPlugin: (isKill?: boolean) => Promise<boolean>
    createBrowserWindow: (url: string, options: any, callback?: () => void) => any | null

    // 事件监听
    onPluginEnter: (callback: (param: any) => void) => void
    onPluginOut: (callback: (isKill: boolean) => void) => void
    onPluginDetach: (callback: () => void) => void
    onMainPush: (callback: (queryData: any) => any[], selectCallback?: (selectData: any) => boolean) => void
    onPluginReady: (callback: (param: any) => void) => void

    // 搜索框
    setSubInput: (onChange: (text: string) => void, placeholder: string, isFocus?: boolean) => void
    setSubInputValue: (text: string) => void
    subInputFocus: () => boolean
    subInputBlur: () => boolean
    subInputSelect: () => boolean
    removeSubInput: () => Promise<boolean>

    // 数据库
    db: {
        put: (doc: any) => any
        get: (id: string) => any | null
        remove: (docOrId: any | string) => any
        bulkDocs: (docs: any[]) => any[]
        allDocs: (key?: string) => any[]
        postAttachment: (id: string, attachment: string | Buffer, type: string) => any
        getAttachment: (id: string) => Buffer
        getAttachmentType: (id: string) => string
        promises: {
            put: (doc: any) => Promise<any>
            get: (id: string) => Promise<any | null>
            remove: (docOrId: any | string) => Promise<any>
            bulkDocs: (docs: any[]) => Promise<any[]>
            allDocs: (key?: string) => Promise<any[]>
            postAttachment: (id: string, attachment: string | Buffer, type: string) => Promise<any>
            getAttachment: (id: string) => Promise<Buffer>
            getAttachmentType: (id: string) => Promise<string>
        }
    }

    // 简化存储
    dbStorage: {
        setItem: (key: string, value: any) => void
        getItem: (key: string) => any | null
        removeItem: (key: string) => void
    }

    // 动态 Feature
    getFeatures: (codes?: string[]) => any[]
    setFeature: (feature: any) => boolean
    removeFeature: (code: string) => boolean

    // 剪贴板
    clipboard: {
        getHistory: (page: number, pageSize: number, filter?: string) => Promise<any>
        search: (keyword: string) => Promise<any[]>
        delete: (id: string) => Promise<boolean>
        clear: (type?: string) => Promise<boolean>
        getStatus: () => Promise<any>
        write: (id: string, shouldPaste?: boolean) => Promise<boolean>
        writeContent: (data: { type: 'text' | 'image'; content: string }, shouldPaste?: boolean) => Promise<boolean>
        updateConfig: (config: any) => Promise<boolean>
        onChange: (callback: (item: any) => void) => void
    }
    copyText: (text: string) => boolean
    copyImage: (image: string) => boolean
    copyFile: (filePath: string) => boolean

    // 文件操作
    getPath: (name: string) => string
    showSaveDialog: (options: any) => string | undefined
    showOpenDialog: (options: any) => string[] | undefined
    screenCapture: (callback: (image: string) => void) => void

    // 显示器
    getPrimaryDisplay: () => any
    getAllDisplays: () => any[]
    getCursorScreenPoint: () => { x: number; y: number }
    getDisplayNearestPoint: (point: { x: number; y: number }) => any
    desktopCaptureSources: (options: any) => Promise<any[]>
    dipToScreenPoint: (point: { x: number; y: number }) => { x: number; y: number }
    screenToDipPoint: (point: { x: number; y: number }) => { x: number; y: number }
    dipToScreenRect: (rect: { x: number; y: number; width: number; height: number }) => { x: number; y: number; width: number; height: number }

    // Shell
    shellOpenExternal: (url: string) => boolean
    shellOpenPath: (fullPath: string) => boolean
    shellShowItemInFolder: (fullPath: string) => boolean

    // 其他
    redirect: (label: string, payload: any) => boolean
    http: {
        setHeaders: (headers: any) => boolean
        getHeaders: () => any
        clearHeaders: () => boolean
    }

    // AI
    ai: (option: any, streamCallback?: (chunk: any) => void) => any
    allAiModels: () => Promise<any[]>
}

declare global {
    interface Window {
        services: Services
        ztools: ZToolsAPI
    }
}

export {}