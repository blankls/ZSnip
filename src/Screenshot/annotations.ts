// ZSnip 截图插件 - 标注绘制函数

import type { AnyShape, RectShape, CircleShape, ArrowShape, PenShape, TextShape, MosaicShape } from '../types'

export function drawShape(ctx: CanvasRenderingContext2D, s: AnyShape) {
  ctx.save()
  switch (s.type) {
    case 'rect': drawRect(ctx, s); break
    case 'circle': drawCircle(ctx, s); break
    case 'arrow': drawArrow(ctx, s); break
    case 'pen': drawPen(ctx, s); break
    case 'text': drawText(ctx, s); break
    case 'mosaic': drawMosaic(ctx, s); break
  }
  ctx.restore()
}

export function drawTempShape(ctx: CanvasRenderingContext2D, s: AnyShape) {
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  switch (s.type) {
    case 'rect': { ctx.strokeRect(s.x, s.y, s.width, s.height); break }
    case 'circle': { ctx.beginPath(); ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2); ctx.stroke(); break }
    case 'arrow': { drawArrowLine(ctx, s.x1, s.y1, s.x2, s.y2, 2, '#3b82f6'); break }
    case 'mosaic': { ctx.strokeRect(s.x, s.y, s.width, s.height); break }
    case 'pen': { if (s.points.length >= 2) { ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y); for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y); ctx.stroke() } break }
  }
  ctx.restore()
}

function drawRect(ctx: CanvasRenderingContext2D, s: RectShape) {
  ctx.strokeStyle = s.color; ctx.lineWidth = s.lineWidth; ctx.strokeRect(s.x, s.y, s.width, s.height)
}

function drawCircle(ctx: CanvasRenderingContext2D, s: CircleShape) {
  ctx.strokeStyle = s.color; ctx.lineWidth = s.lineWidth; ctx.beginPath(); ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2); ctx.stroke()
}

function drawArrow(ctx: CanvasRenderingContext2D, s: ArrowShape) {
  drawArrowLine(ctx, s.x1, s.y1, s.x2, s.y2, s.lineWidth, s.color)
}

function drawArrowLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lw: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  const angle = Math.atan2(y2 - y1, x2 - x1), headLen = lw * 4
  ctx.fillStyle = color; ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
  ctx.closePath(); ctx.fill()
}

function drawPen(ctx: CanvasRenderingContext2D, s: PenShape) {
  if (s.points.length < 2) return
  ctx.strokeStyle = s.color; ctx.lineWidth = s.lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y)
  for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
  ctx.stroke()
}

function drawText(ctx: CanvasRenderingContext2D, s: TextShape) {
  ctx.font = `${s.fontSize}px sans-serif`; ctx.fillStyle = s.color; ctx.fillText(s.text, s.x, s.y + s.fontSize)
}

function drawMosaic(ctx: CanvasRenderingContext2D, s: MosaicShape) {
  const size = s.mosaicSize; const cols = Math.ceil(s.width / size), rows = Math.ceil(s.height / size)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s.x, s.y, s.width, s.height)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ctx.strokeRect(s.x + c * size, s.y + r * size, size, size)
}