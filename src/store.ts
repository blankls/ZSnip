// ZSnip 截图插件 - Zustand 状态管理

import { create } from 'zustand'
import { HistoryStack } from './Screenshot/history'
import type { AnyShape, ScreenshotConfig, Selection, ToolType, ToolbarPosition, WindowInfo } from './types'

const history = new HistoryStack()

interface ScreenshotState {
  phase: 'idle' | 'capturing' | 'selecting' | 'selected' | 'annotating'
  selection: Selection | null
  activeTool: ToolType
  shapes: AnyShape[]
  drawingShape: AnyShape | null
  toolbarPosition: ToolbarPosition | null
  config: ScreenshotConfig
  screenshotBase64: string | null
  displays: { width: number; height: number }[]
  canUndo: boolean
  canRedo: boolean
  windows: WindowInfo[]
  hoveredWindow: WindowInfo | null
  setPhase: (p: ScreenshotState['phase']) => void
  setSelection: (s: Selection | null) => void
  setActiveTool: (t: ToolType) => void
  setShapes: (s: AnyShape[]) => void
  addShape: (s: AnyShape) => void
  setDrawingShape: (s: AnyShape | null) => void
  setToolbarPosition: (p: ToolbarPosition | null) => void
  setConfig: (c: Partial<ScreenshotConfig>) => void
  setScreenshotBase64: (d: string | null) => void
  setDisplays: (d: { width: number; height: number }[]) => void
  setWindows: (w: WindowInfo[]) => void
  setHoveredWindow: (w: WindowInfo | null) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

const init = {
  phase: 'idle' as const,
  selection: null as Selection | null,
  activeTool: null as ToolType,
  shapes: [] as AnyShape[],
  drawingShape: null as AnyShape | null,
  toolbarPosition: null as ToolbarPosition | null,
  config: { strokeColor: '#ef4444', strokeWidth: 3, fontSize: 16, mosaicSize: 10 } as ScreenshotConfig,
  screenshotBase64: null as string | null,
  displays: [] as { width: number; height: number }[],
  canUndo: false,
  canRedo: false,
  windows: [] as WindowInfo[],
  hoveredWindow: null as WindowInfo | null,
}

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  ...init,
  setPhase: (p) => set({ phase: p }),
  setSelection: (s) => set({ selection: s }),
  setActiveTool: (t) => set({ activeTool: t }),
  setShapes: (s) => set({ shapes: s }),
  addShape: (s) => { history.recordAdd(s); set({ shapes: history.getAllShapes(), canUndo: history.canUndo, canRedo: false }) },
  setDrawingShape: (s) => set({ drawingShape: s }),
  setToolbarPosition: (p) => set({ toolbarPosition: p }),
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
  setScreenshotBase64: (d) => set({ screenshotBase64: d }),
  setDisplays: (d) => set({ displays: d }),
  setWindows: (w) => set({ windows: w }),
  setHoveredWindow: (w) => set({ hoveredWindow: w }),
  undo: () => { const r = history.undo(); if (r) set({ shapes: r, canUndo: history.canUndo, canRedo: history.canRedo }) },
  redo: () => { const r = history.redo(); if (r) set({ shapes: r, canUndo: history.canUndo, canRedo: history.canRedo }) },
  reset: () => { history.reset(); set({ ...init }) },
}))