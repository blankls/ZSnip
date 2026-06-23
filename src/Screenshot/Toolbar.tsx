// ZSnip 截图插件 - 工具栏组件

import { useRef, useCallback, useState, useEffect } from 'react'
import { useScreenshotStore } from '../store'
import { copyToClipboard, saveToFile } from './export'
import type { ToolType } from '../types'
import './Toolbar.css'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000']
const TOOLS: { type: ToolType; icon: string; label: string }[] = [
  { type: 'rect', icon: '▢', label: '矩形' }, { type: 'circle', icon: '○', label: '圆形' },
  { type: 'arrow', icon: '→', label: '箭头' }, { type: 'pen', icon: '✎', label: '画笔' },
  { type: 'text', icon: 'T', label: '文字' }, { type: 'mosaic', icon: '◫', label: '马赛克' },
]
const TH = 44, TG = 8

export default function Toolbar() {
  const ref = useRef<HTMLDivElement>(null)
  const [cpOpen, setCpOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0, flipped: false })
  const { selection, activeTool, config, canUndo, canRedo, setActiveTool, setConfig, undo, redo, reset } = useScreenshotStore()

  const calc = useCallback(() => {
    if (!selection || !ref.current) return
    const tw = ref.current.offsetWidth, sh = window.innerHeight, sw = window.innerWidth
    let x = selection.x + (selection.width - tw) / 2, y = selection.y + selection.height + TG, flipped = false
    if (y + TH > sh) { y = selection.y - TH - TG; flipped = true }
    if (x < 4) x = 4; if (x + tw > sw - 4) x = sw - tw - 4
    setPos({ x, y, flipped })
  }, [selection])

  useEffect(() => { calc(); const t = setTimeout(calc, 50); return () => clearTimeout(t) }, [selection, calc])
  useEffect(() => { window.addEventListener('resize', calc); return () => window.removeEventListener('resize', calc) }, [calc])

  if (!selection) return null

  return (
    <div ref={ref} className="toolbar" style={{ left: pos.x, top: pos.y }}>
      {TOOLS.map(t => <button key={t.type} className={`tool-btn ${activeTool === t.type ? 'active' : ''}`} onClick={() => setActiveTool(activeTool === t.type ? null : t.type)} title={t.label}>{t.icon}</button>)}
      <div className="toolbar-divider" />
      <div className="toolbar-props">
        <div className="color-picker-wrap">
          <div className="color-swatch" style={{ backgroundColor: config.strokeColor }} onClick={() => setCpOpen(!cpOpen)} />
          {cpOpen && <div className="color-picker-popup">{COLORS.map(c => <div key={c} className={`color-option ${config.strokeColor === c ? 'selected' : ''}`} style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #666' : undefined }} onClick={() => { setConfig({ strokeColor: c }); setCpOpen(false) }} />)}</div>}
        </div>
        <div className="stroke-width-slider"><input type="range" min="1" max="12" value={config.strokeWidth} onChange={e => setConfig({ strokeWidth: +e.target.value })} /><span>{config.strokeWidth}px</span></div>
        <div className="font-size-display" title="字体大小" onClick={() => { const s = [12, 14, 16, 20, 24, 32, 48]; setConfig({ fontSize: s[(s.indexOf(config.fontSize) + 1) % s.length] }) }}>{config.fontSize}</div>
      </div>
      <div className="toolbar-divider" />
      <button className="tool-btn" onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)">↩</button>
      <button className="tool-btn" onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)">↪</button>
      <div className="toolbar-divider" />
      <button className="tool-btn danger" onClick={reset} title="取消 (Esc)">✕</button>
      <button className="tool-btn success" onClick={async () => { await copyToClipboard(); reset() }} title="确认复制 (Enter)">✓</button>
      <button className="tool-btn" onClick={async () => { await saveToFile(); reset() }} title="保存 (Ctrl+S)">💾</button>
    </div>
  )
}