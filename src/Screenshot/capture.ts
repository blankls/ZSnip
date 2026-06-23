// ZSnip 截图插件 - 屏幕捕获（使用 ZTools 官方 API）

/**
 * 屏幕截图 - 通过 preload services 调用 ztools.screenCapture
 * @returns {Promise<{base64: string; width: number; height: number}>}
 */
export async function captureScreen(): Promise<{ base64: string; width: number; height: number }> {
    try {
        const result = await window.services.captureScreen()
        if (result?.base64) {
            return {
                base64: result.base64,
                width: result.width || screen.width,
                height: result.height || screen.height
            }
        }
    } catch (err) {
        console.error('[ZSnip] 屏幕捕获失败:', err)
    }
    // fallback: 创建占位图
    return createPlaceholder()
}

/**
 * 创建占位图（截图失败时使用）
 */
function createPlaceholder(): { base64: string; width: number; height: number } {
    const w = screen.width || 1920
    const h = screen.height || 1080
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    // 绘制灰色背景
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, w, h)
    // 绘制网格线
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 50) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
    }
    for (let y = 0; y < h; y += 50) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
    }
    return { base64: c.toDataURL('image/png'), width: w, height: h }
}

/**
 * 加载 base64 图片为 HTMLImageElement
 */
export function loadImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = base64
    })
}

/**
 * 获取所有显示器信息
 */
export async function getDisplays(): Promise<Array<{ width: number; height: number; x: number; y: number; id: number; scaleFactor: number }>> {
    try {
        const displays = window.services.getDisplays()
        return displays || [{ width: screen.width, height: screen.height, x: 0, y: 0, id: 0, scaleFactor: 1 }]
    } catch {
        return [{ width: screen.width, height: screen.height, x: 0, y: 0, id: 0, scaleFactor: 1 }]
    }
}

/**
 * 获取主显示器信息
 */
export function getPrimaryDisplay(): { width: number; height: number; scaleFactor: number } {
    try {
        return window.services.getPrimaryDisplay()
    } catch {
        return { width: screen.width, height: screen.height, scaleFactor: 1 }
    }
}