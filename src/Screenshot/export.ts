// ZSnip 截图插件 - 数据导出

import { useScreenshotStore } from '../store'
import { drawShape } from './annotations'
import type { Selection, AnyShape, RectShape, CircleShape, ArrowShape, PenShape, TextShape, MosaicShape } from '../types'

function renderToCanvas(sel: Selection): HTMLCanvasElement {
  const { shapes, screenshotBase64 } = useScreenshotStore.getState()
  const dpr = window.devicePixelRatio || 1
  const c = document.createElement('canvas'); c.width = sel.width * dpr; c.height = sel.height * dpr
  const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr)
  if (screenshotBase64) { const img = new Image(); img.src = screenshotBase64; ctx.drawImage(img, sel.x, sel.y, sel.width, sel.height, 0, 0, sel.width, sel.height) }
  for (const s of shapes) drawShape(ctx, offsetShape(s, sel))
  return c
}

function offsetShape(shape: AnyShape, sel: Selection): AnyShape {
  switch (shape.type) {
    case 'rect': return { ...shape, x: shape.x - sel.x, y: shape.y - sel.y } as RectShape
    case 'circle': return { ...shape, cx: shape.cx - sel.x, cy: shape.cy - sel.y } as CircleShape
    case 'arrow': return { ...shape, x1: shape.x1 - sel.x, y1: shape.y1 - sel.y, x2: shape.x2 - sel.x, y2: shape.y2 - sel.y } as ArrowShape
    case 'pen': return { ...shape, points: shape.points.map(p => ({ x: p.x - sel.x, y: p.y - sel.y })) } as PenShape
    case 'text': return { ...shape, x: shape.x - sel.x, y: shape.y - sel.y } as TextShape
    case 'mosaic': return { ...shape, x: shape.x - sel.x, y: shape.y - sel.y } as MosaicShape
  }
}

export async function copyToClipboard(): Promise<boolean> {
  const { selection } = useScreenshotStore.getState()
  if (!selection) return false
  try {
    const c = renderToCanvas(selection)
    const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png'))
    const base64 = await blobToBase64(blob)
    const result = await window.services.copyToClipboard(base64)
    return result?.success ?? false
  } catch {
    try {
      const c = renderToCanvas(selection); const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return true
    } catch { return false }
  }
}

export async function saveToFile(): Promise<string | null> {
  const { selection } = useScreenshotStore.getState()
  if (!selection) return null
  try {
    const c = renderToCanvas(selection); const base64 = c.toDataURL('image/png')
    const result = await window.services.saveScreenshot(base64)
    return result?.filePath || null
  } catch { return null }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob) })
}