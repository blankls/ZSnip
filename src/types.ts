// ZSnip 截图插件 - 类型定义

export type ToolType = 'rect' | 'circle' | 'arrow' | 'pen' | 'text' | 'mosaic' | null

export interface Point { x: number; y: number }

export interface Bounds { x: number; y: number; width: number; height: number }

export interface Selection { x: number; y: number; width: number; height: number }

export interface ToolbarPosition { x: number; y: number; flipped: boolean }

export interface ScreenshotConfig {
  strokeColor: string
  strokeWidth: number
  fontSize: number
  mosaicSize: number
}

export interface WindowInfo {
  id: number
  title: string
  x: number
  y: number
  width: number
  height: number
}

export interface RectShape { id: string; type: 'rect'; x: number; y: number; width: number; height: number; color: string; lineWidth: number; bounds: Bounds }
export interface CircleShape { id: string; type: 'circle'; cx: number; cy: number; rx: number; ry: number; color: string; lineWidth: number; bounds: Bounds }
export interface ArrowShape { id: string; type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lineWidth: number; bounds: Bounds }
export interface PenShape { id: string; type: 'pen'; points: Point[]; pathKey: string; color: string; lineWidth: number; bounds: Bounds }
export interface TextShape { id: string; type: 'text'; x: number; y: number; text: string; color: string; fontSize: number; bounds: Bounds }
export interface MosaicShape { id: string; type: 'mosaic'; x: number; y: number; width: number; height: number; color: string; lineWidth: number; mosaicSize: number; bounds: Bounds }

export type AnyShape = RectShape | CircleShape | ArrowShape | PenShape | TextShape | MosaicShape