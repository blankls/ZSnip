// ZSnip 截图插件 - 文字输入组件

import { useState, useRef, useEffect } from 'react'
import { useScreenshotStore } from '../store'
import { uid } from '../utils'
import type { TextShape } from '../types'

export default function TextInput({ x, y }: { x: number; y: number }) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const { addShape, setPhase, config } = useScreenshotStore()

  useEffect(() => { ref.current?.focus() }, [])

  const commit = () => {
    const t = text.trim()
    if (t) {
      const shape: TextShape = { id: uid(), type: 'text', x, y, text: t, color: config.strokeColor, fontSize: config.fontSize, bounds: { x, y, width: t.length * config.fontSize * 0.6, height: config.fontSize * 1.5 } }
      addShape(shape)
    }
    setText('')
    const { phase } = useScreenshotStore.getState()
    if (phase === 'selected') setPhase('annotating')
  }

  return (
    <textarea
      ref={ref}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
      style={{
        position: 'fixed', left: x, top: y, minWidth: 100, minHeight: 30,
        fontSize: config.fontSize, color: config.strokeColor,
        background: 'transparent', border: 'none', outline: 'none',
        resize: 'none', overflow: 'hidden', zIndex: 1000, fontFamily: 'sans-serif',
      }}
    />
  )
}