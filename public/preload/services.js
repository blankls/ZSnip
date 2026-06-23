const fs = require('node:fs')
const path = require('node:path')
const { ipcRenderer, contextBridge } = require('electron')

// 安全获取 ztools 属性（overlay 窗口中可能不存在）
const ztools = typeof window.ztools !== 'undefined' ? window.ztools : null

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
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

  // ========== Overlay 窗口专用方法（通过 IPC 通信） ==========

  // 获取窗口列表
  async getWindows() {
    try {
      return await ipcRenderer.invoke('zsnip:get-windows')
    } catch (err) {
      console.error('[ZSnip] 获取窗口列表失败:', err)
      return { windows: [] }
    }
  },

  // 屏幕捕获
  async captureScreen() {
    try {
      return await ipcRenderer.invoke('zsnip:capture-screen')
    } catch (err) {
      console.error('[ZSnip] 屏幕捕获失败:', err)
      return { base64: null, width: 0, height: 0 }
    }
  },

  // 复制到剪贴板
  async copyToClipboard(base64) {
    try {
      return await ipcRenderer.invoke('zsnip:copy-to-clipboard', base64)
    } catch (err) {
      console.error('[ZSnip] 复制到剪贴板失败:', err)
      return { success: false }
    }
  },

  // 保存截图到文件
  async saveScreenshot(base64) {
    try {
      return await ipcRenderer.invoke('zsnip:save-to-file', base64)
    } catch (err) {
      console.error('[ZSnip] 保存截图失败:', err)
      return { success: false, error: err.message }
    }
  },

  // 请求主进程创建全屏透明截图遮罩窗口
  async openScreenshotOverlay() {
    try {
      const result = await ipcRenderer.invoke('zsnip:open-overlay')
      return result
    } catch (err) {
      console.error('[ZSnip] 创建截图遮罩窗口失败:', err)
      return { success: false, error: err.message }
    }
  },

  // 通知主进程关闭截图遮罩窗口
  async closeScreenshotOverlay() {
    try {
      await ipcRenderer.invoke('zsnip:close-overlay')
    } catch (err) {
      console.error('[ZSnip] 关闭截图遮罩窗口失败:', err)
    }
  },

  // 通知主进程截图完成
  async confirmScreenshot(data) {
    try {
      return await ipcRenderer.invoke('zsnip:confirm', data)
    } catch (err) {
      console.error('[ZSnip] 确认截图失败:', err)
    }
  }
}