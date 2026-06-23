// ZSnip 截图插件 - Preload 服务（使用 ZTools 官方 API）
// 遵循 ZTools 规范：源码清晰可读，禁止压缩/混淆

const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

// 安全获取 ztools 属性（overlay 窗口中可能不存在）
const ztools = typeof window.ztools !== 'undefined' ? window.ztools : null

// 通过 window 对象向渲染进程注入服务
window.services = {
    // ========== 文件操作（Node.js 能力） ==========

    // 读文件
    readFile(file) {
        return fs.readFileSync(file, { encoding: 'utf-8' })
    },

    // 文本写入到下载目录
    writeTextFile(text) {
        const downloadsPath = ztools
            ? ztools.getPath('downloads')
            : require('electron').app.getPath('downloads')
        const filePath = path.join(downloadsPath, Date.now().toString() + '.txt')
        fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
        return filePath
    },

    // 图片写入到下载目录
    writeImageFile(base64Url) {
        const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
        if (!matchs) return
        const downloadsPath = ztools
            ? ztools.getPath('downloads')
            : require('electron').app.getPath('downloads')
        const filePath = path.join(downloadsPath, Date.now().toString() + '.' + matchs[1])
        fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
        return filePath
    },

    // ========== 截图相关（使用 ZTools 官方 API） ==========

    /**
     * 屏幕截图 - 使用 ZTools 内置截图能力
     * @returns {Promise<{base64: string, width: number, height: number}>}
     */
    captureScreen() {
        return new Promise((resolve) => {
            if (!ztools) {
                // fallback: 返回占位图
                resolve(createPlaceholder())
                return
            }
            // 使用官方 screenCapture API
            ztools.screenCapture((imageBase64) => {
                if (imageBase64) {
                    // 从 base64 解析宽高（需要加载图片）
                    loadImageSize(imageBase64).then(({ width, height }) => {
                        resolve({ base64: imageBase64, width, height })
                    })
                } else {
                    resolve(createPlaceholder())
                }
            })
        })
    },

    /**
     * 复制图片到剪贴板 - 使用 ZTools 官方 API
     * @param {string} base64 - 图片 base64 Data URL
     * @returns {{success: boolean}}
     */
    copyToClipboard(base64) {
        if (!ztools) {
            return { success: false }
        }
        // 使用官方 copyImage API
        const success = ztools.copyImage(base64)
        return { success }
    },

    /**
     * 保存截图到文件
     * @param {string} base64 - 图片 base64 Data URL
     * @returns {{success: boolean, filePath?: string, error?: string}}
     */
    saveScreenshot(base64) {
        try {
            const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64)
            if (!matchs) return { success: false, error: 'Invalid base64' }
            const downloadsPath = ztools
                ? ztools.getPath('downloads')
                : require('electron').app.getPath('downloads')
            const filePath = path.join(downloadsPath, Date.now().toString() + '.' + matchs[1])
            fs.writeFileSync(filePath, base64.substring(matchs[0].length), { encoding: 'base64' })
            return { success: true, filePath }
        } catch (err) {
            console.error('[ZSnip] 保存文件失败:', err)
            return { success: false, error: err.message }
        }
    },

    /**
     * 获取所有显示器信息 - 使用 ZTools 官方 API
     * @returns {Array<{width: number, height: number, x: number, y: number, id: number}>}
     */
    getDisplays() {
        if (!ztools) {
            // fallback: 返回主显示器
            return [{ width: screen.width, height: screen.height, x: 0, y: 0, id: 0 }]
        }
        const displays = ztools.getAllDisplays()
        return displays.map((d, i) => ({
            width: d.size.width,
            height: d.size.height,
            x: d.bounds.x,
            y: d.bounds.y,
            id: d.id || i,
            scaleFactor: d.scaleFactor
        }))
    },

    /**
     * 获取主显示器信息 - 使用 ZTools 官方 API
     * @returns {{width: number, height: number, scaleFactor: number}}
     */
    getPrimaryDisplay() {
        if (!ztools) {
            return { width: screen.width, height: screen.height, scaleFactor: 1 }
        }
        const display = ztools.getPrimaryDisplay()
        return {
            width: display.size.width,
            height: display.size.height,
            scaleFactor: display.scaleFactor
        }
    },

    /**
     * 获取鼠标当前位置 - 使用 ZTools 官方 API
     * @returns {{x: number, y: number}}
     */
    getCursorScreenPoint() {
        if (!ztools) {
            return { x: 0, y: 0 }
        }
        return ztools.getCursorScreenPoint()
    },

    /**
     * 创建全屏透明截图遮罩窗口 - 使用 ZTools 官方 API
     * @param {string} url - 窗口加载的 URL
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    createOverlayWindow(url) {
        return new Promise((resolve) => {
            if (!ztools) {
                resolve({ success: false, error: 'ztools not available' })
                return
            }
            try {
                // 使用官方 createBrowserWindow API
                const win = ztools.createBrowserWindow(url, {
                    transparent: true,
                    frame: false,
                    alwaysOnTop: true,
                    skipTaskbar: true,
                    resizable: false,
                    fullscreen: false,
                    hasShadow: false,
                    backgroundColor: '#00000000',
                    webPreferences: {
                        preload: path.join(__dirname, 'services.js'),
                        contextIsolation: false,
                        nodeIntegration: false,
                        sandbox: false
                    }
                }, () => {
                    // 窗口加载完成回调
                    console.log('[ZSnip] Overlay window loaded')
                })
                if (win) {
                    // 设置全屏大小
                    const primary = ztools.getPrimaryDisplay()
                    win.setBounds({ x: 0, y: 0, width: primary.size.width, height: primary.size.height })
                    win.setAlwaysOnTop(true, 'screen-saver')
                    // macOS: setVisibleOnAllWorkspaces
                    if (process.platform === 'darwin') {
                        win.setVisibleOnAllWorkspaces(true)
                    }
                    resolve({ success: true })
                } else {
                    resolve({ success: false, error: 'Failed to create window' })
                }
            } catch (err) {
                console.error('[ZSnip] 创建窗口失败:', err)
                resolve({ success: false, error: err.message })
            }
        })
    },

    // ========== 窗口枚举（Node.js 能力，保留原实现） ==========

    /**
     * 获取所有可见窗口的位置和标题
     * Windows: 通过 PowerShell + .NET 枚举窗口
     * macOS: 通过 osascript + System Events 枚举窗口
     * @returns {{windows: Array<{id: number, title: string, x: number, y: number, width: number, height: number}>}}
     */
    getWindows() {
        try {
            const platform = process.platform
            if (platform === 'win32') {
                return { windows: getWindowsWin32() }
            } else if (platform === 'darwin') {
                return { windows: getWindowsDarwin() }
            }
        } catch (err) {
            console.error('[ZSnip] 窗口枚举失败:', err.message)
        }
        return { windows: [] }
    },

    // ========== 用户偏好持久化（使用 ZTools 官方 API） ==========

    /**
     * 获取用户偏好配置
     * @returns {{strokeColor: string, strokeWidth: number, fontSize: number, mosaicSize: number}}
     */
    getConfig() {
        const defaultConfig = {
            strokeColor: '#ef4444',
            strokeWidth: 3,
            fontSize: 16,
            mosaicSize: 10
        }
        if (!ztools) {
            return defaultConfig
        }
        const saved = ztools.dbStorage.getItem('zsnip_config')
        return saved ? { ...defaultConfig, ...saved } : defaultConfig
    },

    /**
     * 保存用户偏好配置
     * @param {{strokeColor?: string, strokeWidth?: number, fontSize?: number, mosaicSize?: number}} config
     */
    saveConfig(config) {
        if (!ztools) return
        ztools.dbStorage.setItem('zsnip_config', config)
    }
}

// ========== 辅助函数 ==========

/**
 * 创建占位图（截图失败时使用）
 */
function createPlaceholder() {
    const w = screen.width || 1920
    const h = screen.height || 1080
    // 返回一个简单的灰色网格占位图 base64
    const canvas = {
        width: w,
        height: h,
        toDataURL: () => {
            // 简化版：返回一个 1x1 灰色像素
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }
    }
    return { base64: canvas.toDataURL(), width: w, height: h }
}

/**
 * 从 base64 图片加载尺寸
 */
async function loadImageSize(base64) {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.width, height: img.height })
        img.onerror = () => resolve({ width: screen.width || 1920, height: screen.height || 1080 })
        img.src = base64
    })
}

/**
 * Windows 窗口枚举（PowerShell + .NET）
 */
function getWindowsWin32() {
    const psScript = `
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Window {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
  [DllImport("user32.dll")] public static extern uint GetWindowLong(IntPtr hWnd, int nIndex);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public const uint GW_OWNER = 4;
  public const int GWL_EXSTYLE = -20;
  public const uint WS_EX_TOOLWINDOW = 0x80;
  public const uint WS_EX_APPWINDOW = 0x40000;
  public static List<object> GetVisibleWindows() {
    var windows = new List<object>();
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      int len = GetWindowTextLength(hWnd);
      if (len == 0) return true;
      StringBuilder sb = new StringBuilder(len + 1);
      GetWindowText(hWnd, sb, sb.Capacity);
      string title = sb.ToString();
      if (string.IsNullOrEmpty(title)) return true;
      uint exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
      bool isToolWindow = (exStyle & WS_EX_TOOLWINDOW) != 0;
      if (isToolWindow && (exStyle & WS_EX_APPWINDOW) == 0) return true;
      RECT rect;
      if (!GetWindowRect(hWnd, out rect)) return true;
      int w = rect.Right - rect.Left, h = rect.Bottom - rect.Top;
      if (w < 50 || h < 50) return true;
      windows.Add(new { id = (int)hWnd, title = title, x = rect.Left, y = rect.Top, width = w, height = h });
      return true;
    }, IntPtr.Zero);
    return windows;
  }
}
"@
[Win32Window]::GetVisibleWindows() | ConvertTo-Json -Compress
`
    const result = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
    })
    const parsed = JSON.parse(result.toString().trim())
    return Array.isArray(parsed) ? parsed : [parsed]
}

/**
 * macOS 窗口枚举（osascript + System Events）
 */
function getWindowsDarwin() {
    const script = `
tell application "System Events"
  set winList to {}
  repeat with proc in (every process whose background only is false)
    set procName to name of proc
    try
      repeat with w in (every window of proc)
        set winTitle to name of w
        set winPos to position of w
        set winSize to size of w
        set end of winList to {id:0, title:procName & " - " & winTitle, ¬
          x:item 1 of winPos, y:item 2 of winPos, ¬
          width:item 1 of winSize, height:item 2 of winSize}
      end repeat
    end try
  end repeat
  return winList
end tell
`
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        timeout: 5000,
        maxBuffer: 1024 * 1024
    })
    return parseAppleScriptWindowList(result.toString().trim())
}

/**
 * 解析 AppleScript 返回的窗口列表
 */
function parseAppleScriptWindowList(str) {
    const windows = []
    const itemRegex = /\{id:(\d+),\s*title:"([^"]+)",\s*x:(\d+),\s*y:(\d+),\s*width:(\d+),\s*height:(\d+)\}/g
    let match
    while ((match = itemRegex.exec(str)) !== null) {
        windows.push({
            id: parseInt(match[1]),
            title: match[2],
            x: parseInt(match[3]),
            y: parseInt(match[4]),
            width: parseInt(match[5]),
            height: parseInt(match[6])
        })
    }
    return windows
}

console.log('[ZSnip] Preload services loaded (using official ZTools API)')