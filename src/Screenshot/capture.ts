// ZSnip 截图插件 - 屏幕捕获（通过 IPC 请求主进程）

export async function captureScreen(): Promise<{ base64: string; width: number; height: number }> {
  try {
    const result = await window.services.captureScreen()
    if (result?.base64) return { base64: result.base64, width: result.width || screen.width, height: result.height || screen.height }
  } catch {}
  return createPlaceholder()
}

function createPlaceholder(): { base64: string; width: number; height: number } {
  const w = screen.width || 1920, h = screen.height || 1080
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1
  for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  return { base64: c.toDataURL('image/png'), width: w, height: h }
}

export function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('load failed')); img.src = base64
  })
}