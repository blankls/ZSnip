# ZSnip 截图插件 — 完整开发方案

> **版本**: v1.0.0 | **日期**: 2026-06-24 | **类型**: 媒体处理插件 | **技术栈**: Electron + React 18 + TypeScript
>
> **项目状态**: 初始项目，所有功能待从零实现。

---

## 0. 项目介绍

### 0.1 项目名称

- **中文名**: 妙截 ZTools（miào jié）
- **英文名**: ZSnip（Z + Snip = 品牌基因 + 截图通用词）
- **内部包名**: `@ztools/plugin-zsnip`
- **Plugin ID**: `zsnap`
- **命令行/快捷键前缀**: `zs.`（例如 `zs.capture`、`zs.pin`）

### 0.2 项目描述

ZSnip（妙截 ZTools）是一款专为 ZTOOLS 桌面工具箱生态打造的**轻量级、高性能屏幕截取与标注插件**。

**核心价值主张**:
- **零学习成本**: UI 风格、交互逻辑与 ZTOOLS 主程序保持 100% 一致
- **极致效率**: 全局热键 `Ctrl+Alt+A` 唤起，从唤起至完成复制全程 < 3 秒
- **专业标注**: 内置矩形、圆形、箭头、直线、画笔、文字、马赛克等标注工具，支持无限级撤销/重做
- **多端导出**: 一键复制到剪贴板、保存为 PNG/JPG、钉在桌面作为临时参考
- **高清适配**: 全面支持 Retina/4K 高清屏，精准处理多显示器坐标映射

**面向用户**: 软件工程师、UI/UX 设计师、产品经理、内容创作者、运维人员等所有需要频繁截图标注的桌面端用户。

### 0.3 Logo 图标规范

| 属性 | 规范 |
|------|------|
| 主体图形 | 经典相机轮廓（取景器 + 镜头），圆角矩形外框 |
| 主色 | `#3b82f6`（ZTools 品牌蓝） |
| 辅色 | `#06b6d4`（青蓝） |
| 背景 | 渐变 `linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)` |
| 尺寸 | 128×128px（主图）、64×64px（缩略图）、32×32px（小图标） |
| 格式 | SVG（首选）、PNG（备用，透明背景） |

---

## 1. 项目定位与设计原则

### 1.1 插件定位

| 维度 | 定位 |
|------|------|
| 核心场景 | 快速截取屏幕任意区域，添加标注后复制到剪贴板或保存本地，支持钉图 |
| 效率目标 | 从唤起至完成截图复制，目标耗时 **< 3 秒** |
| 体验目标 | UI 风格与 ZTOOLS 主程序保持 100% 一致，用户零学习成本 |
| 集成方式 | 遵循 ZTOOLS 插件规范，独立安装/卸载/更新，与主程序松耦合 |

### 1.2 设计原则

- **极简交互**: 每一步操作都有明确的视觉反馈，无隐藏逻辑
- **键盘优先**: 所有高频操作支持快捷键，鼠标作为辅助
- **即时响应**: Canvas 渲染帧率稳定在 60fps，无卡顿感
- **内存安全**: 截图完成后主动释放视频流与缓冲区，杜绝内存泄漏
- **数据驱动**: 图形标注采用 shapes 数组驱动 Canvas 渲染，支持撤销/重做

---

## 2. 技术架构设计

### 2.1 核心架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    主进程 (Main Process)                         │
│  globalShortcut ──→ desktopCapturer ──→ BrowserWindow           │
│  (全局热键注册)      (屏幕源获取)          (窗口管理)              │
│  clipboard ──→ dialog ──→ electron-store                        │
│  (剪贴板)       (保存对话框)  (配置持久化)                         │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ IPC 桥接
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                   渲染进程 (Renderer Process)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ React 18    │  │ Canvas API   │  │ 状态管理 (Zustand)    │    │
│  │ (UI 组件层) │  │ (画布渲染)   │  │ shapes / selection    │    │
│  └─────────────┘  └──────────────┘  └──────────────────────┘    │
│  工具栏 · 遮罩层 · 钉图窗口 · 颜色选择器 · 尺寸提示               │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 主进程与渲染进程分离

| 职责 | 主进程 (Main) | 渲染进程 (Renderer) |
|------|--------------|---------------------|
| 屏幕捕获 | `desktopCapturer.getSources()` | 接收视频流，Canvas 渲染 |
| 窗口管理 | 创建/销毁遮罩窗口、置顶窗口 | 窗口内 UI 渲染 |
| 系统 API | 剪贴板、保存对话框、全局热键 | 通过 IPC 调用 |
| 用户交互 | — | 框选、绘制、工具栏点击 |
| 状态管理 | — | Zustand |

> **架构要点**: 严禁在渲染进程中直接调用 Node.js 原生模块，所有系统级操作必须通过 IPC 桥接。

### 2.3 状态管理设计

采用 **Zustand** 作为状态管理库：

```typescript
interface ScreenshotState {
  selection: { x: number; y: number; width: number; height: number } | null;
  activeTool: 'rect' | 'circle' | 'arrow' | 'line' | 'pen' | 'text' | 'mosaic' | null;
  shapes: Shape[];
  undoStack: Shape[][];
  redoStack: Shape[][];
  toolbarPosition: { x: number; y: number };
  config: { strokeColor: string; strokeWidth: number; fontSize: number; lineDash: boolean };
}
```

---

## 3. 完整功能清单（按优先级排列）

本项目所有功能均需从零实现，以下为完整功能清单及优先级划分：

### 🔴 P0 - 核心功能（MVP 必须实现）

| 序号 | 功能 | 说明 |
| :--- | :--- | :--- |
| 1 | **全屏遮罩 + 截图引擎** | 全屏半透明黑色遮罩（`rgba(0,0,0,0.35)`），通过 `desktopCapturer` 获取屏幕源渲染到 Canvas |
| 2 | **鼠标框选选区** | 支持鼠标拖拽框选、Shift 锁定正方形、Alt 中心扩展、方向键微调（1px/10px） |
| 3 | **蓝色选区边框** | 选区边框使用品牌蓝 `#3b82f6`，蚂蚁线动画，支持无障碍降级（`prefers-reduced-motion`） |
| 4 | **尺寸提示** | 左上角同时显示选区像素尺寸，空间不足时自动内嵌 |
| 5 | **智能窗口识别** | Windows（PowerShell）/ macOS（AppleScript）枚举窗口，hover 时高亮可点击选中 |
| 6 | **工具栏** | 含绘制工具区、属性控制区、操作按钮区，选区下方居右对齐，空间不足时翻转或内嵌 |
| 7 | **矩形标注** | 支持实线/虚线切换 |
| 8 | **圆形标注** | 支持实线/虚线切换 |
| 9 | **箭头标注** | 支持实线/虚线切换 |
| 10 | **直线工具** | 普通直线（不带箭头），支持实线/虚线切换 |
| 11 | **画笔自由绘制** | 鼠标自由轨迹 |
| 12 | **文字标注** | textarea 悬浮于 Canvas 之上的方案 |
| 13 | **马赛克** | 真正的像素化模糊（取区域平均色填充色块），而非简单网格线 |
| 14 | **虚线样式** | 所有线条类标注支持虚线模式切换 |
| 15 | **撤销/重做** | 自研 diff 历史栈，无限级撤销/重做 |
| 16 | **颜色选择器 + 线宽调节** | 颜色选择器色板，线宽滑块 |
| 17 | **复制到剪贴板** | Enter 快捷键确认并复制，支持粘贴到微信/Word/PS |
| 18 | **保存为文件** | Ctrl+S 保存为 PNG/JPG，系统原生保存对话框 |
| 19 | **退出/取消** | Esc 取消截图 |

### 🟡 P1 - 重要功能

| 序号 | 功能 | 说明 |
| :--- | :--- | :--- |
| 20 | **固定到屏幕（钉图 Pin）** | 创建置顶无边框窗口悬浮截图于桌面，**支持同时钉多个**，各自独立拖拽/缩放/关闭 |
| 21 | **钉图窗口交互** | 滚轮缩放、悬停显示工具栏（复制/保存/放大/缩小/1:1/关闭）、阴影边缘、右下角缩放手柄 |
| 22 | **钉图鼠标穿透** | 双击切换穿透模式，穿透时可操作后方窗口 |
| 23 | **选区调整手柄** | 四角 + 四边共 8 个拖拽手柄，可拖拽调整选区大小 |
| 24 | **OCR 文字提取** | 调用系统 OCR API 或 Tesseract.js，识别截图中的文字并复制到剪贴板 |

### 🟢 P2 - 增强功能

| 序号 | 功能 | 说明 |
| :--- | :--- | :--- |
| 25 | **长截图/滚动截图** | 框选区域后自动滚动并逐帧拼接 |
| 26 | **GIF 录制** | 使用 MediaRecorder API 录制指定区域，编码为 GIF/WebM |
| 27 | **"完成"与"复制"分离** | 完成 = 复制并关闭；退出 = 不保存；保存 = 保存文件 |
| 28 | **钉图默认不自动复制** | 支持"仅钉图不复制"选项 |
| 29 | **全局热键冲突回退** | 多候选热键自动尝试，失败时弹窗引导 |
| 30 | **首次使用引导** | 渐进式披露，第二次唤起成功后显示快捷键提示 Toast |

---

## 4. 具体实现方案

### 4.1 截图引擎

**需创建文件**: `src/Screenshot/index.tsx`（截图主组件）、主进程 `screenCapture.ts`

```typescript
// 主进程: screenCapture.ts
import { desktopCapturer, ipcMain } from 'electron';

ipcMain.handle('capture-screen', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1, height: 1 }
  });
  return sources[0]?.id;
});

// 渲染进程: ScreenshotCanvas.tsx
async function startCapture() {
  const sourceId = await ipcRenderer.invoke('capture-screen');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        minWidth: screen.width * window.devicePixelRatio,
        minHeight: screen.height * window.devicePixelRatio,
      }
    } as any
  });

  videoRef.current.srcObject = stream;
  await videoRef.current.play();

  const dpr = window.devicePixelRatio || 1;
  canvas.width = screen.width * dpr;
  canvas.height = screen.height * dpr;
  canvas.style.width = screen.width + 'px';
  canvas.style.height = screen.height + 'px';
  ctx.scale(dpr, dpr);
  ctx.drawImage(videoRef.current, 0, 0, screen.width, screen.height);
}
```

> **高清屏注意**: Canvas 的 `width/height` 属性必须设置为物理像素（乘以 `devicePixelRatio`），再通过 CSS 缩放回逻辑像素，否则截图会模糊。

---

### 4.2 选区框选 + 蓝色边框 + 尺寸提示（左上角）

**需创建文件**: `src/Screenshot/index.tsx`、`src/Screenshot/index.css`

**① 选区框选逻辑**

```typescript
// 鼠标事件处理
const handleMouseDown = (e: MouseEvent) => {
    startPos = { x: e.clientX, y: e.clientY }
    setPhase('selecting')
}

const handleMouseMove = (e: MouseEvent) => {
    if (phase !== 'selecting') return
    let x = Math.min(startPos.x, e.clientX)
    let y = Math.min(startPos.y, e.clientY)
    let w = Math.abs(e.clientX - startPos.x)
    let h = Math.abs(e.clientY - startPos.y)

    // Shift 锁定正方形
    if (e.shiftKey) {
        const size = Math.max(w, h)
        w = size; h = size
    }
    // Alt 中心扩展
    if (e.altKey) {
        x = startPos.x - w; y = startPos.y - h
        w *= 2; h *= 2
    }
    setSelection({ x, y, width: w, height: h })
}

const handleMouseUp = () => {
    if (selection && selection.width >= 5 && selection.height >= 5) {
        setPhase('selected')
    } else {
        setPhase('idle')
    }
}
```

**② 选区边框（品牌蓝 + 蚂蚁线 + 无障碍降级）**

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function drawSelectionBorder(ctx: CanvasRenderingContext2D, sel: Selection, isFinal: boolean) {
    ctx.strokeStyle = '#3b82f6'  // 品牌蓝
    ctx.lineWidth = 2
    if (isFinal && !prefersReducedMotion.matches) {
        ctx.setLineDash([4, 4])
        ctx.lineDashOffset = -(Date.now() / 50) % 8
    } else {
        ctx.setLineDash([])
    }
    ctx.strokeRect(sel.x, sel.y, sel.width, sel.height)
}
```

**③ 尺寸提示（左上角，空间不足时内嵌）**

```typescript
function getTooltipPosition(sel: Selection, screenW: number, screenH: number) {
    const tipW = 110, tipH = 26, margin = 8

    // 首选选区外左上角，空间不足时内嵌到选区内部
    let x = sel.x + margin
    let y = sel.y - tipH - margin
    let inside = false
    if (sel.y < tipH + margin * 2) {
        y = sel.y + margin
        inside = true
    }
    if (sel.x < margin) x = margin

    return { x, y, inside }
}
```

---

### 4.3 工具栏

**需创建文件**: `src/Screenshot/Toolbar.tsx`、`src/Screenshot/Toolbar.css`

工具栏位于选区**下方居右对齐**，空间不足时自动翻转或内嵌。

**① 工具栏布局**

```
┌──────────────────────────────────────────────────────────────┐
│  [▢] [○] [T] [✎] [→] [━] [◫]  │  [╌] [●] [━]  │  [↩] [💾] [✕] [✓] [📌] │
│   ← 绘制工具区 →                  │  属性区       │  操作区                │
└──────────────────────────────────────────────────────────────┘
```

**② 动态定位（底部 → 顶部翻转 → 内嵌）**

```typescript
const calc = useCallback(() => {
    if (!selection || !ref.current) return
    const tw = ref.current.offsetWidth, th = ref.current.offsetHeight
    const sh = window.innerHeight, sw = window.innerWidth
    const { x: sx, y: sy, width: selW, height: selH } = selection
    const TG = 8 // 间距

    // 默认：选区下方居右对齐
    let x = sx + selW - tw - TG, y = sy + selH + TG, flipped = false, inside = false

    // 1. 下方放不下 → 翻到选区上方
    if (y + th > sh) {
        y = sy - th - TG
        flipped = true
        if (y < 0) {
            // 2. 上方也放不下 → 嵌入选区内部底部
            y = sy + selH - th - TG
            inside = true
            flipped = false
        }
    }
    // 水平钳制（靠右不超出屏幕）
    if (x + tw > sw - 4) x = sw - tw - 4
    if (x < 4) x = 4
    if (inside && selH < th + TG * 2) {
        y = Math.max(4, Math.min(sh - th - 4, y))
    }
    setPos({ x, y, flipped, inside })
}, [selection])
```

CSS 内嵌样式：

```css
.toolbar.inside {
    background: rgba(30, 41, 59, 0.85) !important;
    backdrop-filter: blur(8px);
}
.size-tooltip.inside {
    background: rgba(59, 130, 246, 0.9) !important;
}
```

---

### 4.4 标注系统（Canvas 数据驱动渲染）

**需创建文件**: `src/Screenshot/annotations.ts`、`src/types.ts`

**① 类型定义**

```typescript
// src/types.ts
export type ToolType = 'rect' | 'circle' | 'arrow' | 'line' | 'pen' | 'text' | 'mosaic' | null

export interface RectShape {
    id: string; type: 'rect'
    x: number; y: number; width: number; height: number
    color: string; lineWidth: number; dashed?: boolean
    bounds: Bounds
}

export interface CircleShape {
    id: string; type: 'circle'
    cx: number; cy: number; rx: number; ry: number
    color: string; lineWidth: number; dashed?: boolean
    bounds: Bounds
}

export interface ArrowShape {
    id: string; type: 'arrow'
    x1: number; y1: number; x2: number; y2: number
    color: string; lineWidth: number; dashed?: boolean
    bounds: Bounds
}

export interface LineShape {
    id: string; type: 'line'
    x1: number; y1: number; x2: number; y2: number
    color: string; lineWidth: number; dashed: boolean
    bounds: Bounds
}

export interface PenShape {
    id: string; type: 'pen'
    points: { x: number; y: number }[]
    color: string; lineWidth: number
    bounds: Bounds
}

export interface TextShape {
    id: string; type: 'text'
    x: number; y: number; text: string
    color: string; fontSize: number
    bounds: Bounds
}

export interface MosaicShape {
    id: string; type: 'mosaic'
    x: number; y: number; width: number; height: number
    mosaicSize: number
    bounds: Bounds
}

export type Shape = RectShape | CircleShape | ArrowShape | LineShape | PenShape | TextShape | MosaicShape

export interface ScreenshotConfig {
    strokeColor: string
    strokeWidth: number
    fontSize: number
    lineDash: boolean
}
```

**② 绘制函数**

```typescript
// src/Screenshot/annotations.ts
function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save()
    ctx.strokeStyle = shape.color
    ctx.lineWidth = shape.lineWidth || 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const dashed = (shape as any).dashed
    if (dashed) ctx.setLineDash([6, 4])

    switch (shape.type) {
        case 'rect':
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
            break
        case 'circle':
            ctx.beginPath()
            ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, 2 * Math.PI)
            ctx.stroke()
            break
        case 'arrow':
            drawArrow(ctx, shape)
            break
        case 'line':
            ctx.beginPath()
            ctx.moveTo(shape.x1, shape.y1)
            ctx.lineTo(shape.x2, shape.y2)
            ctx.stroke()
            break
        case 'pen':
            ctx.beginPath()
            shape.points.forEach((p, i) =>
                i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
            )
            ctx.stroke()
            break
        case 'text':
            ctx.font = `${shape.fontSize}px sans-serif`
            ctx.fillStyle = shape.color
            ctx.fillText(shape.text, shape.x, shape.y)
            break
        case 'mosaic':
            drawMosaic(ctx, shape)
            break
    }
    ctx.setLineDash([])
    ctx.restore()
}
```

**③ 箭头绘制**

```typescript
function drawArrow(ctx: CanvasRenderingContext2D, s: ArrowShape) {
    const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
    const headLen = 12

    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
    ctx.stroke()

    // 箭头头部
    ctx.beginPath()
    ctx.moveTo(s.x2, s.y2)
    ctx.lineTo(
        s.x2 - headLen * Math.cos(angle - Math.PI / 6),
        s.y2 - headLen * Math.sin(angle - Math.PI / 6)
    )
    ctx.moveTo(s.x2, s.y2)
    ctx.lineTo(
        s.x2 - headLen * Math.cos(angle + Math.PI / 6),
        s.y2 - headLen * Math.sin(angle + Math.PI / 6)
    )
    ctx.stroke()
}
```

**④ 真正的马赛克（像素化模糊）**

```typescript
function drawMosaic(ctx: CanvasRenderingContext2D, s: MosaicShape) {
    const size = s.mosaicSize || 10
    const cols = Math.ceil(s.width / size)
    const rows = Math.ceil(s.height / size)

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const bx = s.x + c * size
            const by = s.y + r * size
            const pixel = ctx.getImageData(bx + size/2, by + size/2, 1, 1).data
            ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`
            ctx.fillRect(bx, by, size, size)
        }
    }
}
```

**⑤ 文字输入（textarea 悬浮方案）**

```typescript
// 用户点击 Canvas，在点击位置生成绝对定位的 <textarea>
// textarea 样式: 透明背景、无边框、文字颜色跟随当前选中颜色
// 用户按 Enter 或失焦后，提取文本内容推入 shapes 数组
// 销毁 textarea，Canvas 重绘时通过 ctx.fillText() 渲染文字
```

---

### 4.5 选区调整手柄（8 点拖拽缩放）

**需实现位置**: `src/Screenshot/index.tsx`、`src/Screenshot/index.css`

```typescript
const HANDLE_SIZE = 8
const HANDLES = [
    { name: 'nw', cursor: 'nw-resize' },
    { name: 'n',  cursor: 'n-resize'  },
    { name: 'ne', cursor: 'ne-resize' },
    { name: 'e',  cursor: 'e-resize'  },
    { name: 'se', cursor: 'se-resize' },
    { name: 's',  cursor: 's-resize'  },
    { name: 'sw', cursor: 'sw-resize' },
    { name: 'w',  cursor: 'w-resize'  },
]

function getHandlePositions(sel: Selection) {
    const { x, y, width: w, height: h } = sel
    const hs = HANDLE_SIZE
    return [
        { name: 'nw', x: x - hs/2, y: y - hs/2 },
        { name: 'n',  x: x + w/2 - hs/2, y: y - hs/2 },
        { name: 'ne', x: x + w - hs/2, y: y - hs/2 },
        { name: 'e',  x: x + w - hs/2, y: y + h/2 - hs/2 },
        { name: 'se', x: x + w - hs/2, y: y + h - hs/2 },
        { name: 's',  x: x + w/2 - hs/2, y: y + h - hs/2 },
        { name: 'sw', x: x - hs/2, y: y + h - hs/2 },
        { name: 'w',  x: x - hs/2, y: y + h/2 - hs/2 },
    ]
}
```

```css
.selection-handle {
    position: fixed;
    background: #ffffff;
    border: 2px solid #3b82f6;
    border-radius: 2px;
    z-index: 10001;
    pointer-events: auto;
}
```

---

### 4.6 固定到屏幕（钉图 Pin）

**需创建文件**: `public/pin.html`、`public/preload/pin-preload.js`
**需实现功能**: 主进程 `pinManager.ts`（多窗口管理）、渲染进程钉图触发逻辑

> **关键设计**: 钉图支持同时存在多个。每次点击"钉图"都会创建一个新的独立钉图窗口，互不干扰。

**① 钉图窗口管理器（主进程，支持多窗口）**

```typescript
// main/pinManager.ts — 多钉图窗口管理器
import { BrowserWindow, ipcMain } from 'electron';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

// 活跃的钉图窗口集合
const pinWindows = new Map<string, { win: BrowserWindow; filepath: string }>();

async function createPinWindow(imageBase64: string, bounds: Rect): Promise<string> {
  const pinId = randomUUID();

  // 1. 过滤非法字符
  const safe = imageBase64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (safe.length === 0) throw new Error('Invalid image data');

  // 2. 写入临时文件
  const tmpDir = join(tmpdir(), 'zsnip');
  await mkdir(tmpDir, { recursive: true });
  const filepath = join(tmpDir, `pin-${pinId}.png`);
  await writeFile(filepath, Buffer.from(safe, 'base64'));

  // 3. 创建窗口（每个钉图偏移 20px，方便区分多个钉图）
  const offset = pinWindows.size * 20;
  const win = new BrowserWindow({
    width: bounds.width, height: bounds.height,
    x: bounds.x + offset, y: bounds.y + offset,
    frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: true, transparent: true, hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: PIN_PRELOAD_PATH,
    }
  });

  await win.loadFile(join(__dirname, 'pin.html'), { query: { image: filepath, pinId } });

  // 4. CSP 设置
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; img-src 'self' file:; style-src 'self' 'unsafe-inline'; script-src 'self'"]
      }
    });
  });

  // 5. 拦截外部跳转
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });

  // 6. 关闭时清理：从集合移除 + 删除临时文件
  win.on('closed', () => {
    pinWindows.delete(pinId);
    unlink(filepath).catch(() => {});
  });

  // 7. 默认启用鼠标穿透
  win.setIgnoreMouseEvents(true, { forward: true });

  // 8. 注册到集合
  pinWindows.set(pinId, { win, filepath });

  return pinId;
}

// 获取所有活跃钉图数量
function getPinCount(): number {
  return pinWindows.size;
}

// 关闭所有钉图
function closeAllPins(): void {
  pinWindows.forEach(({ win }) => win.close());
  pinWindows.clear();
}

// IPC: 关闭指定钉图
ipcMain.handle('pin:close', (_event, pinId: string) => {
  const entry = pinWindows.get(pinId);
  if (entry) entry.win.close();
});

// IPC: 关闭所有钉图
ipcMain.handle('pin:close-all', () => {
  closeAllPins();
});
```

**② 钉图窗口 HTML 模板**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: transparent; overflow: hidden; user-select: none; -webkit-app-region: drag; }
.pin-container { position: relative; width: 100vw; height: 100vh; }
.pin-image { width: 100%; height: 100%; object-fit: contain; pointer-events: none; -webkit-user-drag: none; }
.pin-toolbar {
    position: absolute; top: 8px; right: 8px; display: none; gap: 4px;
    background: rgba(30,41,59,0.9); padding: 6px; border-radius: 8px;
    -webkit-app-region: no-drag; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.pin-container:hover .pin-toolbar { display: flex; }
.pin-btn {
    width: 32px; height: 32px; border: none; background: transparent;
    color: #fff; font-size: 16px; cursor: pointer; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
}
.pin-btn:hover { background: rgba(255,255,255,0.15); }
.pin-btn.close { color: #ef4444; }
.pin-shadow {
    position: absolute; inset: -20px; pointer-events: none;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
    border-radius: 4px;
}
.resize-handle {
    position: absolute; width: 12px; height: 12px;
    background: #3b82f6; border: 2px solid #fff; border-radius: 50%;
    -webkit-app-region: no-drag; z-index: 10;
}
.resize-handle.se { right: -6px; bottom: -6px; cursor: se-resize; }
</style>
</head>
<body>
<div class="pin-container" id="container">
    <div class="pin-shadow"></div>
    <img class="pin-image" id="pinImg" />
    <div class="pin-toolbar">
        <button class="pin-btn" id="btnCopy" title="复制">📋</button>
        <button class="pin-btn" id="btnSave" title="保存">💾</button>
        <button class="pin-btn" id="btnZoomIn" title="放大">+</button>
        <button class="pin-btn" id="btnZoomOut" title="缩小">−</button>
        <button class="pin-btn" id="btnReset" title="1:1">1:1</button>
        <button class="pin-btn close" id="btnClose" title="关闭">✕</button>
    </div>
    <div class="resize-handle se" id="resizeSE"></div>
</div>
<script src="pin-interaction.js"></script>
</body>
</html>
```

**③ 钉图交互逻辑**

```javascript
// pin-interaction.js
let scale = 1
const img = document.getElementById('pinImg')
const container = document.getElementById('container')
const pinId = new URLSearchParams(location.search).get('pinId')  // 每个钉图唯一标识

window.electronAPI.onLoadImage((base64) => { img.src = base64 })

document.getElementById('btnZoomIn').onclick = () => { scale *= 1.2; applyScale() }
document.getElementById('btnZoomOut').onclick = () => { scale /= 1.2; applyScale() }
document.getElementById('btnReset').onclick = () => { scale = 1; applyScale() }
function applyScale() { img.style.transform = `scale(${scale})`; img.style.transformOrigin = 'top left' }

container.addEventListener('wheel', (e) => {
    e.preventDefault()
    scale *= e.deltaY < 0 ? 1.1 : 0.9
    applyScale()
}, { passive: false })

document.getElementById('btnSave').onclick = () => window.electronAPI.savePinImage(img.src)
document.getElementById('btnCopy').onclick = () => window.electronAPI.copyPinImage(img.src)
document.getElementById('btnClose').onclick = () => window.electronAPI.closePinWindow(pinId)

// 右下角拖拽缩放
const resizeSE = document.getElementById('resizeSE')
let isResizing = false
resizeSE.addEventListener('mousedown', (e) => { isResizing = true; e.preventDefault() })
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return
    window.electronAPI.resizePinWindow(pinId, e.movementX, e.movementY)
})
document.addEventListener('mouseup', () => { isResizing = false })

// 双击切换鼠标穿透（每个钉图独立穿透状态）
let clickThrough = false
container.addEventListener('dblclick', () => {
    clickThrough = !clickThrough
    window.electronAPI.setIgnoreMouseEvents(pinId, clickThrough)
})
```

**④ 工具栏钉图按钮（渲染进程）**

```tsx
<button className="tool-btn" onClick={handlePin} title="钉到屏幕 (Ctrl+T)">📌</button>
```

```typescript
const handlePin = async () => {
    const { selection, shapes } = useScreenshotStore.getState()
    if (!selection) return
    const c = renderToCanvas(selection, shapes)
    const base64 = c.toDataURL('image/png')
    await window.services.pinScreenshot(base64, selection)
}
```

---

### 4.7 数据导出

| 操作 | 实现方式 |
|------|----------|
| 复制到剪贴板 | `clipboard.writeImage(nativeImage.createFromBuffer(buffer))` |
| 保存为文件 | `dialog.showSaveDialog()` + `fs.writeFile()`，默认文件名 `screenshot_YYYYMMDD_HHmmss.png` |
| 钉在桌面 | 创建新 `BrowserWindow`，传递 base64 图片数据 |

---

### 4.8 P1 功能实现方案（简述）

**① OCR 文字提取**
- 调用系统 OCR API（Windows: `Windows.Media.Ocr`，macOS: `Vision` 框架）
- 或集成 Tesseract.js（纯 JS，约 20MB 语言包，按需加载）
- Preload 增加 `extractText(imageBase64)` API，识别后自动复制到剪贴板

**② 长截图/滚动截图**
- 框选区域后进入滚动模式
- 监听鼠标滚轮，自动滚动内容并逐帧拼接
- Canvas 逐步拼接，主进程配合模拟滚动事件

**③ GIF 录制**
- 使用 `MediaRecorder` API 录制指定区域
- 框选区域后点击"GIF"开始录制，显示录制计时和停止按钮
- 完成后使用 `gif.js` 或 `ffmpeg.wasm` 编码为 GIF
- 建议第一版先做 WebM 录制

---

## 5. UI 设计规范

### 5.1 色彩系统

| 角色 | 颜色值 | 用途 |
|------|--------|------|
| 主色 (Brand Blue) | `#3b82f6` | 按钮激活态、选中高亮、品牌色 |
| 辅色 (Cyan) | `#06b6d4` | 链接、次要强调 |
| 深色背景 | `#1e293b` | 工具栏背景、弹窗背景 |
| 浅色背景 | `#f8fafc` | 卡片背景、设置面板 |
| 成功 | `#10b981` | 保存/复制完成提示 |
| 警告 | `#f59e0b` | 确认操作提示 |
| 危险 | `#ef4444` | 取消/删除/关闭 |

### 5.2 字体

- **界面字体**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **代码/数据**: `JetBrains Mono`、`Fira Code` 等宽字体
- **字号层级**: 标题 14px/700、正文 13px/400、辅助 11px/400

### 5.3 尺寸与圆角

| 元素 | 尺寸 | 圆角 |
|------|------|------|
| 工具栏 | 高度 44px | 10px |
| 按钮 (icon) | 32×32px | 8px |
| 卡片/弹窗 | 自适应 | 12px |
| 颜色选择器色块 | 14×14px | 圆形 (50%) |

### 5.4 阴影

| 层级 | 阴影值 |
|------|--------|
| 卡片 | `0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)` |
| 工具栏 | `0 4px 20px rgba(0,0,0,0.15)` |
| 弹窗 | `0 10px 40px rgba(0,0,0,0.1)` |

---

## 6. 性能优化方案

### 6.1 分层 Canvas 架构

采用**三层 Canvas 合成**，避免单一 Canvas 在 4K 屏下退化为纯位图拷贝：

```
┌────────────────────────────────────────────┐
│            previewCanvas (顶层)             │  ← 鼠标轨迹 / 当前操作图形
│   ┌──────────────────────────────────┐     │
│   │     shapesCanvas (中层)          │     │  ← 已确认的 shapes 标注
│   │   ┌──────────────────────────┐   │     │
│   │   │  backgroundCanvas (底层) │   │     │  │  ← 屏幕截图底图（低频更新）
│   │   └──────────────────────────┘   │     │
│   └──────────────────────────────────┘     │
└────────────────────────────────────────────┘
```

```typescript
class CanvasLayerManager {
  private background = document.createElement('canvas');
  private shapes     = document.createElement('canvas');
  private preview    = document.createElement('canvas');

  constructor(container: HTMLElement) {
    [this.background, this.shapes, this.preview].forEach(c => {
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.pointerEvents = 'none';
      container.appendChild(c);
    });
  }

  updateBackground(video: HTMLVideoElement, w: number, h: number) {
    this.background.width = w; this.background.height = h;
    this.background.getContext('2d')!.drawImage(video, 0, 0, w, h);
  }

  repaintShapes(shapes: Shape[], dirtyRect?: Rect) {
    const ctx = this.shapes.getContext('2d')!;
    if (dirtyRect) {
      ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
      shapes.forEach(s => { if (intersects(s.bounds, dirtyRect)) drawShape(ctx, s); });
    } else {
      this.shapes.width = this.shapes.width;
      shapes.forEach(s => drawShape(ctx, s));
    }
  }

  drawPreview(shape: Shape | null) {
    const ctx = this.preview.getContext('2d')!;
    this.preview.width = this.preview.width;
    if (shape) drawShape(ctx, shape);
  }
}
```

### 6.2 性能指标

| 指标 | 目标值 |
|------|--------|
| Canvas 渲染帧率 | 60fps（4K 屏画笔轨迹 ≥ 55fps） |
| 截图窗口唤起延迟 | < 50ms（老用户 P99 < 80ms） |
| 峰值内存占用 | < 100MB |
| 内存泄漏（50 次连续操作） | < 30MB 增长 |

### 6.3 压测基线

| 场景 | 测试条件 | FPS (P50) | FPS (P99) | 内存峰值 |
|------|---------|-----------|-----------|----------|
| 1080P 单屏 | 画笔 100 笔 | 60 | 58 | 45MB |
| 4K 单屏 | 画笔 100 笔 | 60 | 56 | 82MB |
| 4K 单屏 | 画笔 + 矩形 + 文字 200 个 shape | 58 | 52 | 95MB |
| 双屏 4K (DPR 1+2) | 跨屏框选 | 55 | 49 | 145MB |
| 8K 单屏 | 画笔 100 笔 | 50 | 42 | 180MB |

### 6.4 内存管理

完整的 cleanup 函数（所有资源释放）：

```typescript
function cleanup() {
  // 视频流
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
    videoRef.current.load();
  }

  // Canvas 缓冲区
  if (canvasRef.current) {
    canvasRef.current.width = 0;
    canvasRef.current.height = 0;
  }
  offscreenCanvasRef.current = null;

  // Zustand 状态
  useScreenshotStore.getState().reset();

  // IPC 监听器
  ipcRenderer.removeAllListeners('screenshot:done');
  ipcRenderer.removeAllListeners('screenshot:error');

  // 全局键盘/鼠标监听
  document.removeEventListener('keydown', globalShortcutsHandler);
  document.removeEventListener('mousemove', mouseTracker);
  document.removeEventListener('mouseup', mouseTracker);

  // 定时器
  clearTimeout(mosaicDebounceTimer);
  clearTimeout(sizeTooltipTimer);
  if (dragRafId) cancelAnimationFrame(dragRafId);

  // 浮动 DOM
  floatingTextareaRef.current?.remove();
  colorPickerPopoverRef.current?.remove();

  // Zustand 订阅
  unsubscribeShapes();
}
```

### 6.5 高分屏与多屏适配

```typescript
// 主进程暴露真实 display 信息
ipcMain.handle('get-displays', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
    workArea: d.workArea,
    scaleFactor: d.scaleFactor,
    rotation: d.rotation,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }));
});

// 渲染进程坐标转换
function getDisplayAtPoint(x: number, y: number): Display {
  return displays.find(d =>
    x >= d.bounds.x && x < d.bounds.x + d.bounds.width &&
    y >= d.bounds.y && y < d.bounds.y + d.bounds.height
  ) ?? primaryDisplay;
}

function getCurrentDisplayDPR(): number {
  return getDisplayAtPoint(mouseX, mouseY).scaleFactor;
}

// DPR >= 2 时启用 0.75x 缩略图缓存（牺牲 5% 清晰度换 50% 内存）
const dpr = getCurrentDisplayDPR();
const cacheScale = dpr >= 2 ? 0.75 : 1.0;
backgroundCanvas.width  = screen.width * dpr * cacheScale;
backgroundCanvas.height = screen.height * dpr * cacheScale;
```

### 6.6 启动优化

| 优化点 | 策略 |
|--------|------|
| 条件性预热 | 仅当用户过去 7 天触发 ≥ 3 次截图时才预热 desktopCapturer |
| 预热时机 | 延迟到主进程空闲时（`browser-window-created` 后 5 秒） |
| 懒加载 | 工具栏图标按需加载，首屏只渲染核心工具 |
| 防抖 | 选区尺寸提示使用 16ms 防抖 |
| Web Worker | 马赛克等复杂计算移至 Worker |
| 虚拟化 | shapes > 100 时启用虚拟化渲染 |

### 6.7 失败兜底

```typescript
async function startCapture() {
  try {
    const sourceId = await ipcRenderer.invoke('capture-screen');
    if (!sourceId) throw new Error('No screen source available');
  } catch (err) {
    showErrorToast({
      title: '无法获取屏幕源',
      message: err.message,
      actions: [
        { label: '打开系统偏好', onClick: openSystemPrivacySettings },
        { label: '查看帮助文档', onClick: () => openUrl('https://docs.ztools.cn/zsnip/permission') }
      ],
      duration: 0  // 不自动消失
    });
  }
}
```

---

## 7. 交互细节与快捷键

### 7.1 选区交互

| 操作 | 行为 | 组合键 |
|------|------|--------|
| 基础框选 | 按下鼠标 → 拖拽 → 释放，形成矩形选区 | — |
| 比例锁定 | 强制选区为正方形（1:1） | `Shift` + 拖拽 |
| 中心扩展 | 以鼠标按下点为中心向四周扩展 | `Alt` + 拖拽 |
| 微调移动 | 以 1px 步进微调选区位置 | `↑↓←→` |
| 加速微调 | 以 10px 步进微调 | `Shift` + `↑↓←→` |
| 跨屏选区 | 选区跨多屏时按 display 边界分段裁剪后合并 | — |

### 7.2 快捷键完整列表

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| `Ctrl + Alt + A`（默认） | 唤起截图 | 全局（冲突时自动回退） |
| `Esc` | 取消截图 / 关闭钉图 | 截图模式 / 钉图窗口 |
| `Enter` | 确认并复制 | 截图模式 |
| `Ctrl + S` | 保存到文件 | 截图模式 |
| `Ctrl + Z` | 撤销 | 截图模式 |
| `Ctrl + Shift + Z` | 重做 | 截图模式 |
| `Ctrl + T` | 钉图 | 截图模式 |
| `↑↓←→` | 微调选区（1px） | 截图模式 |
| `Shift + ↑↓←→` | 微调选区（10px） | 截图模式 |
| `?` | 弹出快捷键帮助 | 截图模式 |
| `zs.capture`（命令面板） | 唤起截图 | ZTOOLS 主搜索框 |

### 7.3 热键冲突检测与回退

```typescript
const HOTKEY_CANDIDATES = [
  'CommandOrControl+Alt+A',
  'CommandOrControl+Alt+Z',
  'CommandOrControl+Shift+A',
  'F1',
];

async function registerScreenshotHotkey() {
  for (const hotkey of HOTKEY_CANDIDATES) {
    if (globalShortcut.isRegistered(hotkey)) continue;
    const ok = globalShortcut.register(hotkey, () => {
      mainWindow.webContents.send('trigger-screenshot');
    });
    if (ok) {
      mainWindow.webContents.send('hotkey-registered', hotkey);
      return { hotkey, success: true };
    }
  }
  // 所有候选都失败，弹窗引导
  dialog.showMessageBox({
    type: 'warning',
    title: '快捷键冲突',
    message: 'ZSnip 无法注册全局快捷键（可能与其他软件冲突）',
    detail: '您仍可通过 ZTOOLS 主搜索框输入 "zs.capture" 触发截图。',
    buttons: ['打开系统快捷键设置', '稍后再说'],
  });
  return { hotkey: '', success: false };
}
```

### 7.4 钉图窗口交互

1. **多次钉图**: 每次点击"钉图"创建一个新的独立钉图窗口，可同时存在多个，互不影响
2. **新钉图偏移**: 每个新钉图窗口右下偏移 20px，方便区分
3. **双击切换穿透**: 双击钉图窗口切换"鼠标穿透"模式，每个钉图独立穿透状态
4. **滚轮缩放**: 悬停滚轮缩放，Ctrl+滚轮更精细，每个钉图独立缩放比例
5. **右键菜单**: 复制、保存、置顶、关闭、透明度调节、关闭所有钉图
6. **"完成"按钮**: 完成 = 复制并关闭；退出 = 直接关闭不保存
7. **钉图后不自动关闭截图窗口**: 截图窗口保持打开，用户可继续截取并钉更多图

---

## 8. 撤销/重做系统

### 8.1 自研 Immutable History Helper

不引入 immer（节省 12KB gzipped），自研增量 diff 历史栈：

```typescript
type HistoryEntry = {
  added: Map<string, Shape>;
  modified: Map<string, Partial<Shape>>;
  removed: Set<string>;
  baseSnapshot?: Shape[];  // 每 50 步保存一次全量基准
};

class HistoryStack {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private shapes: Map<string, Shape> = new Map();
  private baseSnapshot: Shape[] = [];
  private stepSinceSnapshot = 0;

  applyChange(change: HistoryEntry) {
    change.added.forEach((s, id) => this.shapes.set(id, s));
    change.modified.forEach((patch, id) => Object.assign(this.shapes.get(id)!, patch));
    change.removed.forEach(id => this.shapes.delete(id));
    this.undoStack.push(change);
    this.redoStack = [];
    if (++this.stepSinceSnapshot >= 50) {
      this.baseSnapshot = Array.from(this.shapes.values());
      this.stepSinceSnapshot = 0;
    }
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const entry = this.undoStack.pop()!;
    this._revert(entry);
    this.redoStack.push(entry);
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const entry = this.redoStack.pop()!;
    entry.added.forEach((s, id) => this.shapes.set(id, s));
    entry.modified.forEach((patch, id) => Object.assign(this.shapes.get(id)!, patch));
    entry.removed.forEach(id => this.shapes.delete(id));
    this.undoStack.push(entry);
    return true;
  }

  private _revert(entry: HistoryEntry) {
    entry.removed.forEach(id => {
      const found = this.baseSnapshot.find(s => s.id === id);
      if (found) this.shapes.set(id, found);
    });
    entry.added.forEach((_, id) => this.shapes.delete(id));
    entry.modified.forEach((patch, id) => {
      const cur = this.shapes.get(id);
      if (cur) Object.keys(patch).forEach(k => delete (cur as any)[k]);
    });
  }
}
```

**性能预期**:

| 方案 | 1000 strokes 占用 | undo 单次耗时 |
|------|-------------------|---------------|
| cloneDeep（全量深拷贝） | 12MB | 85ms |
| diff（增量存储） | 380KB | 8ms |
| 收益 | 节省 97% 内存 | 快 10x |

---

## 9. 推荐开源库

| 库名 | 用途 | 说明 |
|------|------|------|
| **js-web-screen-shot** | 核心截图引擎参考 | 原生 JS 库，内置框选、画笔、矩形、文字、马赛克、撤销重做，可直接参考其 Canvas 绘制逻辑 |
| **zustand** | 状态管理 | 轻量级，无需 Provider，支持中间件 |
| **electron-store** | 配置持久化 | 自动处理读写与默认值 |
| **react-color** | 颜色选择器 | 专业的 React 颜色选择组件 |

---

## 10. 文件创建清单

| 文件 | 类型 | 内容 |
| :--- | :--- | :--- |
| `src/types.ts` | **新增** | Shape 类型定义、ToolType、ScreenshotConfig |
| `src/store.ts` | **新增** | Zustand 状态管理 |
| `src/Screenshot/index.tsx` | **新增** | 截图主组件：遮罩层、框选、尺寸提示、手柄、键盘事件 |
| `src/Screenshot/index.css` | **新增** | 遮罩层、选区、手柄、尺寸提示样式 |
| `src/Screenshot/Toolbar.tsx` | **新增** | 工具栏组件：工具切换、属性控制、操作按钮、动态定位 |
| `src/Screenshot/Toolbar.css` | **新增** | 工具栏样式、内嵌样式、按钮样式 |
| `src/Screenshot/annotations.ts` | **新增** | Canvas 标注绘制引擎 |
| `src/Screenshot/PinWindow.tsx` | **新增** | 钉图触发逻辑（渲染进程侧） |
| `main/screenCapture.ts` | **新增** | 主进程截图 IPC handler |
| `main/pinManager.ts` | **新增** | 主进程钉图多窗口管理器（创建/追踪/销毁） |
| `main/hotkey.ts` | **新增** | 全局热键注册与冲突回退 |
| `public/preload/services.js` | **新增** | Preload 桥接脚本 |
| `public/pin.html` | **新增** | 钉图窗口页面 |
| `public/preload/pin-preload.js` | **新增** | 钉图窗口 preload 脚本 |

---

## 11. 开发优先级与里程碑

| 里程碑 | 内容 | 预计工作量 |
| :--- | :--- | :--- |
| **M1 (P0)** | 截图引擎 + 遮罩层 + 框选 + 蓝色边框 + 左上角尺寸提示 + 工具栏（底部居右） | 2-3 天 |
| **M2 (P0)** | 标注系统（矩形/圆形/箭头/直线/画笔/文字/马赛克）+ 虚线 + 颜色/线宽 + 撤销重做 | 2-3 天 |
| **M3 (P0)** | 复制/保存/退出 + 工具栏内嵌 + 智能窗口识别 | 1-2 天 |
| **M4 (P0)** | 钉图完整功能（窗口创建、缩放、保存、关闭、阴影、穿透） | 1-2 天 |
| **M5 (P1)** | 选区调整手柄 + OCR 文字提取 | 1-2 天 |
| **M6 (P2)** | 长截图 + GIF 录制 + 首次引导 + 热键冲突回退完善 | 2-3 天 |

---

## 12. 开发 Checklist

### 基础截图
- [ ] 全屏遮罩窗口创建与销毁
- [ ] `desktopCapturer` 获取屏幕流并渲染到 Canvas
- [ ] 鼠标框选选区（含 Shift/Alt 辅助键）
- [ ] 方向键微调选区（1px / 10px）
- [ ] 智能窗口识别点击选中
- [ ] 蓝色选区边框 + 蚂蚁线动画 + 无障碍降级
- [ ] 尺寸提示（左上角，空间不足时内嵌）

### 工具栏
- [ ] 工具栏基础布局（工具区 / 属性区 / 操作区）
- [ ] 动态定位（底部 → 顶部翻转 → 内嵌）
- [ ] 工具按钮顺序：矩形 圆 文字 画笔 箭头 线条 马赛克
- [ ] 虚线切换按钮
- [ ] 颜色选择器 + 线宽调节
- [ ] 撤销/重做按钮

### 标注系统
- [ ] 矩形标注（含虚线支持）
- [ ] 圆形标注（含虚线支持）
- [ ] 箭头标注（含虚线支持）
- [ ] 直线工具（含虚线支持）
- [ ] 画笔自由绘制
- [ ] 文字输入（textarea 悬浮方案）
- [ ] 马赛克（真正的像素化模糊）
- [ ] 数据驱动渲染 + 分层 Canvas
- [ ] 自研 diff 历史栈（撤销/重做）

### 数据导出
- [ ] 复制到剪贴板（Enter）
- [ ] 保存为 PNG/JPG（Ctrl+S）
- [ ] 钉图窗口（创建、置顶、穿透、拖拽、缩放、关闭、阴影）
- [ ] 钉图安全加固（本地文件 + CSP）

### 快捷键与交互
- [ ] 全局热键注册（含候选回退）
- [ ] Esc 取消，Enter 完成
- [ ] Ctrl+Z / Ctrl+Shift+Z 撤销重做
- [ ] 钉图双击穿透
- [ ] 首次使用引导（渐进式披露）

### 性能
- [ ] 三层 Canvas 架构
- [ ] 高清屏 DPR 适配 + 多屏坐标映射
- [ ] 完整 cleanup（视频流、Canvas、IPC、定时器、DOM、订阅）
- [ ] 脏矩形局部重绘
- [ ] 条件性预热
- [ ] 失败兜底 Toast

---

## 参考来源

1. ZTOOLS 官网 — https://www.ztools.cn/
2. Electron desktopCapturer 文档 — https://www.electronjs.org/docs/latest/api/desktop-capturer
