// ZSnip 截图插件 - 主进程模块
// 负责创建全屏透明截图遮罩窗口、处理 IPC 通信、窗口枚举
// 此文件由 ZTOOLS 主程序加载

const { BrowserWindow, screen, ipcMain, clipboard, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

let overlayWindow = null

/**
 * 获取所有可见窗口的位置和标题
 * Windows: 通过 PowerShell + .NET 枚举窗口
 * macOS: 通过 osascript + System Events 枚举窗口
 */
function getWindows() {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      return getWindowsWin32()
    } else if (platform === 'darwin') {
      return getWindowsDarwin()
    }
  } catch (err) {
    console.error('[ZSnip] 窗口枚举失败:', err.message)
  }
  return []
}

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
      // 排除工具窗口和无边框窗口
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
    timeout: 5000, maxBuffer: 1024 * 1024, windowsHide: true
  })
  const parsed = JSON.parse(result.toString().trim())
  return Array.isArray(parsed) ? parsed : [parsed]
}

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
    timeout: 5000, maxBuffer: 1024 * 1024
  })
  // 解析 AppleScript 返回的列表格式
  return parseAppleScriptWindowList(result.toString().trim())
}

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
      height: parseInt(match[6]),
    })
  }
  return windows
}

/**
 * 注册 IPC 处理器
 */
function registerIPCHandlers() {
  // 获取窗口列表
  ipcMain.handle('zsnip:get-windows', async () => {
    const windows = getWindows()
    return { windows }
  })

  // 创建全屏透明截图遮罩窗口
  ipcMain.handle('zsnip:open-overlay', async () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.focus()
      return { success: true }
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    const overlayPath = getOverlayPath()

    overlayWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      fullscreen: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload', 'services.js'),
        contextIsolation: false,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    overlayWindow.setBounds({ x: 0, y: 0, width, height })
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    overlayWindow.setVisibleOnAllWorkspaces(true)

    await overlayWindow.loadURL(overlayPath)

    return { success: true }
  })

  // 关闭截图遮罩窗口
  ipcMain.handle('zsnip:close-overlay', async () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close()
      overlayWindow = null
    }
  })

  // 截图确认
  ipcMain.handle('zsnip:confirm', async (_event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close()
      overlayWindow = null
    }
    return { success: true }
  })

  // 屏幕捕获
  ipcMain.handle('zsnip:capture-screen', async () => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size

      const sources = await require('electron').desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height },
      })

      if (sources.length > 0) {
        const source = sources[0]
        const thumbnail = source.thumbnail
        const base64 = thumbnail.toDataURL()
        return { base64, width, height }
      }

      return { base64: null, width, height }
    } catch (err) {
      console.error('[ZSnip] 屏幕捕获失败:', err)
      return { base64: null, width: 0, height: 0 }
    }
  })

  // 复制到剪贴板
  ipcMain.handle('zsnip:copy-to-clipboard', async (_event, base64) => {
    try {
      const img = nativeImage.createFromDataURL(base64)
      clipboard.writeImage(img)
      return { success: true }
    } catch (err) {
      console.error('[ZSnip] 复制到剪贴板失败:', err)
      return { success: false }
    }
  })

  // 保存截图到文件
  ipcMain.handle('zsnip:save-to-file', async (_event, base64) => {
    try {
      const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64)
      if (!matchs) return { success: false, error: 'Invalid base64' }
      const downloadsPath = require('electron').app.getPath('downloads')
      const filePath = path.join(downloadsPath, Date.now().toString() + '.' + matchs[1])
      fs.writeFileSync(filePath, base64.substring(matchs[0].length), { encoding: 'base64' })
      return { success: true, filePath }
    } catch (err) {
      console.error('[ZSnip] 保存文件失败:', err)
      return { success: false, error: err.message }
    }
  })

  console.log('[ZSnip] IPC handlers registered')
}

/**
 * 获取 overlay.html 路径
 */
function getOverlayPath() {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5173/public/overlay.html'
  }
  const distPath = path.join(__dirname, 'public', 'overlay.html')
  if (fs.existsSync(distPath)) {
    return `file://${distPath}`
  }
  return `file://${path.join(__dirname, 'index.html')}`
}

/**
 * 清理资源
 */
function cleanup() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
    overlayWindow = null
  }
}

// 自动注册 IPC 处理器（模块被加载时即注册）
registerIPCHandlers()

// 导出
module.exports = { registerIPCHandlers, cleanup }