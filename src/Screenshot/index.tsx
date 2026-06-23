// ZSnip 截图插件 - 截图遮罩层主组件（框选 + 标注 + 窗口自动识别）

import { useEffect, useRef, useCallback, useState } from 'react'
import { useScreenshotStore } from '../store'
import { captureScreen, loadImage } from './capture'
import { clamp, uid } from '../utils'
import { drawShape, drawTempShape } from './annotations'
import { copyToClipboard, saveToFile } from './export'
import Toolbar from './Toolbar'
import TextInput from './TextInput'
import type { Selection, AnyShape, Point, WindowInfo } from '../types'
import './index.css'

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function Screenshot() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const isDragging = useRef(false)
  const startPoint = useRef({ x: 0, y: 0 })
  const penPoints = useRef<Point[]>([])
  const initialized = useRef(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null)
  const screenSize = useRef({ width: 0, height: 0 })

  const { phase, selection, activeTool, shapes, drawingShape, config, windows, hoveredWindow, setPhase, setSelection, setScreenshotBase64, setDisplays, setActiveTool, setDrawingShape, addShape, setWindows, setHoveredWindow, undo, redo, reset } = useScreenshotStore()

  // 检测光标下的窗口
  const findWindowAt = useCallback((x: number, y: number): WindowInfo | null => {
    // 从上层到底层遍历（后面加入的是上层窗口）
    for (let i = windows.length - 1; i >= 0; i--) {
      const w = windows[i]
      if (x >= w.x && x <= w.x + w.width && y >= w.y && y <= w.y + w.height) {
        return w
      }
    }
    return null
  }, [windows])

  const getDragSelection = useCallback((e: MouseEvent): Selection => {
    const sx = startPoint.current.x, sy = startPoint.current.y
    let x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY), w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy)
    if (e.shiftKey) { const s = Math.max(w, h); w = s; h = s; if (e.clientX < sx) x = sx - s; if (e.clientY < sy) y = sy - s }
    if (e.altKey) { x = sx - w; y = sy - h; w *= 2; h *= 2 }
    return { x, y, width: w, height: h }
  }, [])

  const getTempShape = useCallback((e: MouseEvent): AnyShape | null => {
    const sx = startPoint.current.x, sy = startPoint.current.y, ex = e.clientX, ey = e.clientY
    const { strokeColor, strokeWidth, mosaicSize } = config
    switch (activeTool) {
      case 'rect': { const x = Math.min(sx, ex), y = Math.min(sy, ey), w = Math.abs(ex - sx), h = Math.abs(ey - sy); return { id: '__temp__', type: 'rect', x, y, width: w, height: h, color: strokeColor, lineWidth: strokeWidth, bounds: { x, y, width: w, height: h } } as AnyShape }
      case 'circle': { const cx = (sx + ex) / 2, cy = (sy + ey) / 2, rx = Math.abs(ex - sx) / 2, ry = Math.abs(ey - sy) / 2; return { id: '__temp__', type: 'circle', cx, cy, rx, ry, color: strokeColor, lineWidth: strokeWidth, bounds: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 } } as AnyShape }
      case 'arrow': { const dx = Math.abs(ex - sx), dy = Math.abs(ey - sy); return { id: '__temp__', type: 'arrow', x1: sx, y1: sy, x2: ex, y2: ey, color: strokeColor, lineWidth: strokeWidth, bounds: { x: Math.min(sx, ex), y: Math.min(sy, ey), width: dx, height: dy } } as AnyShape }
      case 'mosaic': { const x = Math.min(sx, ex), y = Math.min(sy, ey), w = Math.abs(ex - sx), h = Math.abs(ey - sy); return { id: '__temp__', type: 'mosaic', x, y, width: w, height: h, color: strokeColor, lineWidth: strokeWidth, mosaicSize, bounds: { x, y, width: w, height: h } } as AnyShape }
      default: return null
    }
  }, [activeTool, config])

  const commitAnnotation = useCallback((e: MouseEvent) => {
    const { strokeColor, strokeWidth, mosaicSize } = config; const sx = startPoint.current.x, sy = startPoint.current.y
    let shape: AnyShape | null = null
    switch (activeTool) {
      case 'rect': { const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY), w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy); if (w < 3 && h < 3) return; shape = { id: uid(), type: 'rect', x, y, width: w, height: h, color: strokeColor, lineWidth: strokeWidth, bounds: { x, y, width: w, height: h } } as AnyShape; break }
      case 'circle': { const cx = (sx + e.clientX) / 2, cy = (sy + e.clientY) / 2, rx = Math.abs(e.clientX - sx) / 2, ry = Math.abs(e.clientY - sy) / 2; if (rx < 2 && ry < 2) return; shape = { id: uid(), type: 'circle', cx, cy, rx, ry, color: strokeColor, lineWidth: strokeWidth, bounds: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 } } as AnyShape; break }
      case 'arrow': { const dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy); if (dx < 5 && dy < 5) return; shape = { id: uid(), type: 'arrow', x1: sx, y1: sy, x2: e.clientX, y2: e.clientY, color: strokeColor, lineWidth: strokeWidth, bounds: { x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), width: dx, height: dy } } as AnyShape; break }
      case 'pen': { if (penPoints.current.length < 2) return; const pts = [...penPoints.current]; const pathKey = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' '); const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const pad = strokeWidth + 2; shape = { id: uid(), type: 'pen', points: pts, pathKey, color: strokeColor, lineWidth: strokeWidth, bounds: { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...ys) - Math.min(...ys) + pad * 2 } } as AnyShape; break }
      case 'mosaic': { const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY), w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy); if (w < 5 && h < 5) return; shape = { id: uid(), type: 'mosaic', x, y, width: w, height: h, color: strokeColor, lineWidth: strokeWidth, mosaicSize, bounds: { x, y, width: w, height: h } } as AnyShape; break }
    }
    if (shape) addShape(shape); setDrawingShape(null)
  }, [activeTool, config, addShape, setDrawingShape])

  const drawFrame = useCallback((sel: Selection | null, isFinal: boolean) => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d')!; const dpr = window.devicePixelRatio || 1; const w = screenSize.current.width, h = screenSize.current.height
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr)
    if (bgImageRef.current) ctx.drawImage(bgImageRef.current, 0, 0, w, h)
    if (sel) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, sel.y); ctx.fillRect(0, sel.y + sel.height, w, h - sel.y - sel.height); ctx.fillRect(0, sel.y, sel.x, sel.height); ctx.fillRect(sel.x + sel.width, sel.y, w - sel.x - sel.width, sel.height)
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1
      if (isFinal && !prefersReducedMotion.matches) { ctx.setLineDash([4, 4]); ctx.lineDashOffset = -(Date.now() / 50) % 8 }
      else if (isFinal) { ctx.strokeStyle = '#3b82f6'; ctx.setLineDash([]) }
      ctx.strokeRect(sel.x, sel.y, sel.width, sel.height); ctx.setLineDash([])
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, h)
      // 绘制窗口高亮
      if (hoveredWindow) {
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([])
        ctx.strokeRect(hoveredWindow.x, hoveredWindow.y, hoveredWindow.width, hoveredWindow.height)
        ctx.fillStyle = 'rgba(59,130,246,0.08)'; ctx.fillRect(hoveredWindow.x, hoveredWindow.y, hoveredWindow.width, hoveredWindow.height)
      }
    }
    for (const s of useScreenshotStore.getState().shapes) drawShape(ctx, s)
    const ts = useScreenshotStore.getState().drawingShape; if (ts) drawTempShape(ctx, ts)
    ctx.restore()
  }, [hoveredWindow])

  const initCapture = useCallback(async () => { setPhase('capturing')
    try {
      const { base64, width, height } = await captureScreen()
      screenSize.current = { width, height }; setScreenshotBase64(base64); setDisplays([{ width, height }])
      const img = await loadImage(base64); bgImageRef.current = img
      const canvas = canvasRef.current
      if (canvas) { const dpr = window.devicePixelRatio || 1; canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.width = width + 'px'; canvas.style.height = height + 'px' }
      // 获取窗口列表
      const winResult = await window.services.getWindows()
      if (winResult?.windows) setWindows(winResult.windows)
      drawFrame(null, false); setPhase('selecting'); initialized.current = true
    } catch { reset() }
  }, [setPhase, setScreenshotBase64, setDisplays, setWindows, reset, drawFrame])

  const confirmSelection = useCallback((sel: Selection) => { if (sel.width < 5 && sel.height < 5) { setSelection(null); drawFrame(null, false); return } setSelection(sel); setPhase('selected') }, [setSelection, setPhase, drawFrame])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 点击窗口 → 直接选中
    if (phase === 'selecting' && hoveredWindow) {
      const sel: Selection = { x: hoveredWindow.x, y: hoveredWindow.y, width: hoveredWindow.width, height: hoveredWindow.height }
      setSelection(sel); setHoveredWindow(null); setPhase('selected')
      return
    }
    isDragging.current = true; startPoint.current = { x: e.clientX, y: e.clientY }; setMousePos({ x: e.clientX, y: e.clientY })
    if (activeTool === 'text' && (phase === 'selected' || phase === 'annotating')) { setTextInputPos({ x: e.clientX, y: e.clientY }); setActiveTool(null); isDragging.current = false; return }
    if (activeTool === 'pen' && (phase === 'selected' || phase === 'annotating')) { penPoints.current = [{ x: e.clientX, y: e.clientY }]; if (phase === 'selected') setPhase('annotating') }
  }, [phase, hoveredWindow, activeTool, setActiveTool, setPhase, setSelection, setHoveredWindow])

  useEffect(() => {
    const mm = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
      // 悬停窗口检测
      if (phase === 'selecting' && !isDragging.current) {
        const hw = findWindowAt(e.clientX, e.clientY)
        setHoveredWindow(hw)
        drawFrame(null, false)
        return
      }
      if (!isDragging.current) return
      if (phase === 'selecting') drawFrame(getDragSelection(e), false)
      else if ((phase === 'selected' || phase === 'annotating') && activeTool) {
        if (activeTool === 'pen') { penPoints.current = [...penPoints.current, { x: e.clientX, y: e.clientY }]; setDrawingShape({ id: '__temp__', type: 'pen', points: penPoints.current, color: config.strokeColor, lineWidth: config.strokeWidth, pathKey: '', bounds: { x: 0, y: 0, width: 0, height: 0 } } as AnyShape) }
        else setDrawingShape(getTempShape(e))
        drawFrame(selection, true)
      }
    }
    const mu = (e: MouseEvent) => {
      if (!isDragging.current) return; isDragging.current = false; setHoveredWindow(null)
      if (phase === 'selecting') confirmSelection(getDragSelection(e))
      else if ((phase === 'selected' || phase === 'annotating') && activeTool) { commitAnnotation(e); if (phase === 'selected') setPhase('annotating'); drawFrame(selection, true) }
    }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu)
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu) }
  }, [phase, activeTool, selection, config, getDragSelection, getTempShape, commitAnnotation, drawFrame, confirmSelection, setDrawingShape, setPhase, setHoveredWindow, findWindowAt])

  useEffect(() => { if (phase !== 'selected' && phase !== 'annotating') return; if (!selection) return; const a = () => { drawFrame(selection, true); animFrameRef.current = requestAnimationFrame(a) }; animFrameRef.current = requestAnimationFrame(a); return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) } }, [phase, selection, drawFrame])
  useEffect(() => { initCapture() }, [initCapture])

  // 退出时关闭 overlay 窗口
  useEffect(() => {
    if (phase === 'idle' && initialized.current) {
      window.services.closeScreenshotOverlay()
    }
  }, [phase])

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (phase === 'selected' || phase === 'annotating') { setPhase('selecting'); setSelection(null); setActiveTool(null); setDrawingShape(null); drawFrame(null, false); return } reset(); return }
      if (phase === 'selected' || phase === 'annotating') { if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return } if (e.ctrlKey && e.key === 'Z') { e.preventDefault(); redo(); return } if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveToFile().then(() => reset()); return } if (e.key === 'Enter') { e.preventDefault(); copyToClipboard().then(() => reset()); return } if (!selection) return; const step = e.shiftKey ? 10 : 1; let { x, y } = selection; switch (e.key) { case 'ArrowUp': y -= step; e.preventDefault(); break; case 'ArrowDown': y += step; e.preventDefault(); break; case 'ArrowLeft': x -= step; e.preventDefault(); break; case 'ArrowRight': x += step; e.preventDefault(); break; default: return } setSelection({ x: clamp(x, 0, screenSize.current.width - selection.width), y: clamp(y, 0, screenSize.current.height - selection.height), width: selection.width, height: selection.height }) }
    }
    document.addEventListener('keydown', kd); return () => document.removeEventListener('keydown', kd)
  }, [phase, selection, setPhase, setSelection, setActiveTool, setDrawingShape, drawFrame, reset, undo, redo])

  useEffect(() => () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); const c = canvasRef.current; if (c) { c.width = 0; c.height = 0 }; bgImageRef.current = null }, [])

  const dragTip = phase === 'selecting' && isDragging.current ? <div className="size-tooltip" style={{ left: Math.min(mousePos.x + 12, screenSize.current.width - 120), top: Math.min(mousePos.y + 12, screenSize.current.height - 30) }}>{Math.abs(mousePos.x - startPoint.current.x)} × {Math.abs(mousePos.y - startPoint.current.y)}</div> : null
  const hint = phase === 'selecting' ? <div className="overlay-hint">拖拽框选 · 点击窗口选中 · Shift 正方形 · Alt 中心扩展 · Esc 取消</div> : phase === 'selected' ? <div className="overlay-hint">选择工具标注 · Enter 确认 · Ctrl+S 保存 · Esc 重选</div> : phase === 'annotating' ? <div className="overlay-hint">{activeTool ? `正在绘制: ${activeTool}` : '选择工具'} · Enter 确认 · Esc 重选</div> : null
  const windowLabel = phase === 'selecting' && hoveredWindow ? <div className="window-label" style={{ left: hoveredWindow.x + 4, top: Math.max(hoveredWindow.y - 24, 4) }}>{hoveredWindow.title}</div> : null

  return (
    <div className="screenshot-overlay" role="region" aria-label="截图选区" aria-live="polite" onMouseDown={handleMouseDown}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {selection && (phase === 'selected' || phase === 'annotating') && <div className="size-tooltip" style={{ left: Math.min(selection.x + selection.width + 8, screenSize.current.width - 120), top: Math.min(selection.y + selection.height + 8, screenSize.current.height - 30) }}>{selection.width} × {selection.height}</div>}
      {dragTip}{hint}{windowLabel}
      {(phase === 'selected' || phase === 'annotating') && <Toolbar />}
      {textInputPos && <TextInput x={textInputPos.x} y={textInputPos.y} />}
    </div>
  )
}