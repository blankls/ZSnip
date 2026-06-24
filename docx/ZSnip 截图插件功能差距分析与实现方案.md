# ZSnip 截图插件功能差距分析与实现方案

## 一、现有功能状态盘点

基于对 [Screenshot/index.tsx](file:///workspace/src/Screenshot/index.tsx)、[Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx)、[annotations.ts](file:///workspace/src/Screenshot/annotations.ts) 等核心文件的分析：

| 功能模块              | 状态     | 说明                                         |
| :-------------------- | :------- | :------------------------------------------- |
| 全屏半透明黑遮罩      | ✅ 已实现 | `rgba(0,0,0,0.35)`                           |
| 智能窗口识别点击选中  | ✅ 已实现 | PowerShell/AppleScript 枚举窗口 + hover 高亮 |
| 鼠标拖拽框选          | ✅ 已实现 | 支持 Shift 正方形、Alt 中心扩展              |
| Shift/Alt 辅助键      | ✅ 已实现 |                                              |
| 键盘微调选区          | ✅ 已实现 | 方向键 1px，Shift+方向键 10px                |
| 矩形标注              | ✅ 已实现 |                                              |
| 圆形标注              | ✅ 已实现 |                                              |
| 画笔自由绘制          | ✅ 已实现 |                                              |
| 文字标注              | ✅ 已实现 | textarea 悬浮方案                            |
| 箭头标注              | ✅ 已实现 | 注：用户写的"剪头"为"箭头"笔误               |
| 马赛克                | ⚠️ 半成品 | 仅绘制网格线，无真正像素模糊                 |
| 撤销/重做             | ✅ 已实现 | 自研 diff 历史栈                             |
| 保存图片              | ✅ 已实现 |                                              |
| 复制到剪贴板（完成）  | ✅ 已实现 | Enter 快捷键                                 |
| 退出/取消             | ✅ 已实现 | Esc                                          |
| 工具栏底部定位 + 翻转 | ✅ 已实现 | 底部放不下时翻到上方                         |
| 尺寸提示（右下角）    | ✅ 已实现 |                                              |
| 颜色选择器            | ✅ 已实现 |                                              |
| 线宽调节              | ✅ 已实现 |                                              |

------

## 二、缺失/需优化功能清单

### 🔴 P0 - 核心缺失（用户明确要求）

| 序号 | 功能                         | 当前状态                             | 优先级 |
| :--- | :--------------------------- | :----------------------------------- | :----- |
| 1    | **蓝色选区边框**             | ❌ 当前是白色虚线蚂蚁线 `#ffffff`     | P0     |
| 2    | **尺寸提示双位置**           | ❌ 仅右下角，缺左上角                 | P0     |
| 3    | **空间不足时 UI 内嵌到选区** | ❌ 工具栏仅上下翻转，不会进入选区内部 | P0     |
| 4    | **直线工具**                 | ❌ 缺失（箭头是带箭头的，缺普通直线） | P0     |
| 5    | **虚线样式支持**             | ❌ 所有线条都是实线                   | P0     |
| 6    | **固定到屏幕（钉图 Pin）**   | ❌ 开发文档有设计，代码完全未实现     | P0     |
| 7    | **钉图窗口交互**             | ❌ 放大缩小、保存、关闭、阴影边缘     | P0     |

### 🟡 P1 - 重要功能

| 序号 | 功能                 | 当前状态                                   | 优先级 |
| :--- | :------------------- | :----------------------------------------- | :----- |
| 8    | **选区调整手柄**     | ❌ 选区确定后只能重新框选，无法拖拽边缘调整 | P1     |
| 9    | **真正的马赛克模糊** | ⚠️ 当前只是黑色半透明+网格线，需像素化处理  | P1     |
| 10   | **文字提取（OCR）**  | ❌ 缺失                                     | P1     |
| 11   | **长截图/滚动截图**  | ❌ 缺失                                     | P1     |
| 12   | **GIF 录制**         | ❌ 缺失                                     | P1     |

### 🟢 P2 - 体验优化

| 序号 | 功能                           | 当前状态                                      | 优先级 |
| :--- | :----------------------------- | :-------------------------------------------- | :----- |
| 13   | **"完成"按钮独立于"复制"**     | ❌ 当前"✓"直接复制，用户要求区分退出/完成/保存 | P2     |
| 14   | **工具栏按钮顺序对齐用户需求** | ❌ 顺序需调整                                  | P2     |
| 15   | **钉图默认不自动复制**         | ❌ 需支持"仅钉图不复制"选项                    | P2     |

------

## 三、具体实现方案

### 3.1 蓝色边框 + 尺寸提示双位置 + UI 自适应内嵌

#### 修改文件：[Screenshot/index.tsx](file:///workspace/src/Screenshot/index.tsx)、[Screenshot/index.css](file:///workspace/src/Screenshot/index.css)

**① 选区边框改为蓝色（常态蓝色实线，蚂蚁线改为蓝色版本）**

TypeScript



```typescript
// drawFrame 函数中修改
// 第 168-178 行改为：
ctx.strokeStyle = '#3b82f6'  // 品牌蓝
ctx.lineWidth = 2
if (isFinal && !prefersReducedMotion.matches) {
    ctx.setLineDash([4, 4])
    ctx.lineDashOffset = -(Date.now() / 50) % 8
} else {
    ctx.setLineDash([])
}
ctx.strokeRect(sel.x, sel.y, sel.width, sel.height)
```

**② 尺寸提示双位置显示（左上角 + 右下角）**

尺寸提示位置计算逻辑：

TypeScript



```typescript
// 计算尺寸提示位置
function getTooltipPositions(sel: Selection, screenW: number, screenH: number) {
    const tipW = 110, tipH = 26, margin = 8
    const positions = []
    
    // 左上角位置（首选：选区外左上角）
    let topLeftX = sel.x + margin
    let topLeftY = sel.y - tipH - margin
    let topLeftInside = false
    
    // 上方空间不足 → 放到选区内部左上角
    if (sel.y < tipH + margin * 2) {
        topLeftY = sel.y + margin
        topLeftInside = true
    }
    // 左边空间不足
    if (sel.x < margin) topLeftX = margin
    
    // 右下角位置（首选：选区外右下角）
    let bottomRightX = sel.x + sel.width - tipW - margin
    let bottomRightY = sel.y + sel.height + margin
    let bottomRightInside = false
    
    // 下方空间不足 → 放到选区内部右下角
    if (sel.y + sel.height + tipH + margin > screenH) {
        bottomRightY = sel.y + sel.height - tipH - margin
        bottomRightInside = true
    }
    // 右边空间不足
    if (sel.x + sel.width + tipW + margin > screenW) {
        bottomRightX = screenW - tipW - margin
    }
    
    return {
        topLeft: { x: topLeftX, y: topLeftY, inside: topLeftInside },
        bottomRight: { x: bottomRightX, y: bottomRightY, inside: bottomRightInside }
    }
}
```

**③ 工具栏智能内嵌逻辑**

修改 [Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx) 的 `calc` 函数：

TypeScript



```typescript
const calc = useCallback(() => {
    if (!selection || !ref.current) return
    const tw = ref.current.offsetWidth, th = ref.current.offsetHeight
    const sh = window.innerHeight, sw = window.innerWidth
    const { x: sx, y: sy, width: sw: selW, height: sh: selH } = selection
    
    let x = sx + (selW - tw) / 2, y = sy + selH + TG, flipped = false, inside = false
    
    // 1. 默认：选区下方居中
    if (y + th > sh) {
        // 2. 下方放不下 → 翻到选区上方
        y = sy - th - TG
        flipped = true
        if (y < 0) {
            // 3. 上方也放不下 → 嵌入选区内部底部
            y = sy + selH - th - TG
            inside = true
            flipped = false
        }
    }
    // 水平钳制
    if (x < 4) x = 4
    if (x + tw > sw - 4) x = sw - tw - 4
    
    // 如果选区太小容纳不了工具栏，强制钳制到屏幕内
    if (inside && selH < th + TG * 2) {
        y = Math.max(4, Math.min(sh - th - 4, y))
    }
    
    setPos({ x, y, flipped, inside })
}, [selection])
```

CSS 内嵌样式优化（内部时半透明背景）：

CSS



```css
.toolbar.inside {
    background: rgba(30, 41, 59, 0.85) !important;
    backdrop-filter: blur(8px);
}
.size-tooltip.inside {
    background: rgba(59, 130, 246, 0.9) !important;
}
```

------

### 3.2 新增工具：直线、虚线

#### 修改文件：[types.ts](file:///workspace/src/types.ts)、[annotations.ts](file:///workspace/src/Screenshot/annotations.ts)、[Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx)、[store.ts](file:///workspace/src/store.ts)、[index.tsx](file:///workspace/src/Screenshot/index.tsx)

**① 类型扩展** ([types.ts](file:///workspace/src/types.ts))

TypeScript



```typescript
// ToolType 增加 'line'
export type ToolType = 'rect' | 'circle' | 'arrow' | 'line' | 'pen' | 'text' | 'mosaic' | null

// 新增 LineShape
export interface LineShape { 
    id: string; type: 'line'
    x1: number; y1: number; x2: number; y2: number
    color: string; lineWidth: number; dashed: boolean
    bounds: Bounds 
}

// 所有形状增加 dashed 属性
export interface RectShape { ...; dashed?: boolean }
export interface CircleShape { ...; dashed?: boolean }
export interface ArrowShape { ...; dashed?: boolean }

// config 增加 lineDash
export interface ScreenshotConfig {
    ...
    lineDash: boolean  // 是否虚线模式
}
```

**② 绘制函数** ([annotations.ts](file:///workspace/src/Screenshot/annotations.ts))

TypeScript



```typescript
// 增加直线绘制
function drawLine(ctx: CanvasRenderingContext2D, s: LineShape) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.lineWidth
    if (s.dashed) ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
    ctx.stroke()
    ctx.setLineDash([])
}

// 其他形状（rect/circle/arrow）增加 dashed 支持
// 示例：矩形
function drawRect(ctx: CanvasRenderingContext2D, s: RectShape) {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.lineWidth
    if (s.dashed) ctx.setLineDash([6, 4])
    ctx.strokeRect(s.x, s.y, s.width, s.height)
    ctx.setLineDash([])
}
```

**③ 工具栏增加按钮** ([Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx))

TypeScript



```typescript
const TOOLS = [
  { type: 'rect', icon: '▢', label: '矩形' },
  { type: 'circle', icon: '○', label: '圆形' },
  { type: 'line', icon: '━', label: '直线' },  // 新增
  { type: 'arrow', icon: '→', label: '箭头' },
  { type: 'pen', icon: '✎', label: '画笔' },
  { type: 'text', icon: 'T', label: '文字' },
  { type: 'mosaic', icon: '◫', label: '马赛克' },
]

// 属性区增加虚线切换按钮
<button 
  className={`tool-btn ${config.lineDash ? 'active' : ''}`} 
  onClick={() => setConfig({ lineDash: !config.lineDash })}
  title="虚线"
>╌</button>
```

------

### 3.3 选区调整手柄（拖拽缩放）

#### 修改文件：[Screenshot/index.tsx](file:///workspace/src/Screenshot/index.tsx)、[index.css](file:///workspace/src/Screenshot/index.css)

在选区四角和四边增加 8 个拖拽手柄：

TypeScript



```typescript
// 手柄大小
const HANDLE_SIZE = 8
const HANDLES = [
    { name: 'nw', cursor: 'nw-resize' },  // 左上
    { name: 'n',  cursor: 'n-resize'  },  // 上
    { name: 'ne', cursor: 'ne-resize' },  // 右上
    { name: 'e',  cursor: 'e-resize'  },  // 右
    { name: 'se', cursor: 'se-resize' },  // 右下
    { name: 's',  cursor: 's-resize'  },  // 下
    { name: 'sw', cursor: 'sw-resize' },  // 左下
    { name: 'w',  cursor: 'w-resize'  },  // 左
]

// 计算手柄位置
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

// 拖拽手柄逻辑
const [resizing, setResizing] = useState<string | null>(null)
// 在 handleMouseDown 中检测是否点击了手柄...
```

手柄渲染：

TSX



```tsx
{selection && (phase === 'selected' || phase === 'annotating') && (
    <>
        {getHandlePositions(selection).map(h => (
            <div 
                key={h.name}
                className="selection-handle"
                style={{ left: h.x, top: h.y, width: HANDLE_SIZE, height: HANDLE_SIZE, cursor: HANDLES.find(x=>x.name===h.name)!.cursor }}
                onMouseDown={(e) => { e.stopPropagation(); setResizing(h.name) }}
            />
        ))}
    </>
)}
```

CSS：

CSS



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

------

### 3.4 真正的马赛克（像素化模糊）

#### 修改文件：[annotations.ts](file:///workspace/src/Screenshot/annotations.ts)

使用 Canvas 像素操作实现真正的马赛克：

TypeScript



```typescript
function drawMosaic(ctx: CanvasRenderingContext2D, s: MosaicShape) {
    const size = s.mosaicSize
    const cols = Math.ceil(s.width / size)
    const rows = Math.ceil(s.height / size)
    
    // 方案：从背景图取色，每个块取平均色填充
    // 注意：需要传入背景 ImageData 或离屏 canvas
    // 简化方案（性能优先）：使用 CSS 滤镜风格的块填充
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const bx = s.x + c * size
            const by = s.y + r * size
            // 从画布读取中心像素颜色（需要背景图缓存）
            const pixel = ctx.getImageData(bx + size/2, by + size/2, 1, 1).data
            ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`
            ctx.fillRect(bx, by, size, size)
        }
    }
}
```

**性能优化**：马赛克绘制移至 Web Worker，或使用预渲染的离屏 Canvas 缓存。

------

### 3.5 固定到屏幕（钉图 Pin）—— 重点功能

#### 新增文件：`src/Screenshot/PinWindow.tsx`、修改 [services.js](file:///workspace/public/preload/services.js)

**① Preload 层增加钉图 API** ([services.js](file:///workspace/public/preload/services.js))

JavaScript



```javascript
// 在 window.services 中增加：
pinScreenshot(base64, bounds) {
    if (!ztools) return { success: false }
    try {
        // 创建钉图窗口（无边框、透明、置顶）
        const pinWin = ztools.createBrowserWindow(`data:text/html;charset=utf-8,${encodeURIComponent(getPinHTML())}`, {
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: true,
            hasShadow: true,  // 阴影边缘
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            webPreferences: {
                preload: path.join(__dirname, 'pin-preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            }
        })
        
        // 通过 IPC 传递图片数据
        pinWin.webContents.on('did-finish-load', () => {
            pinWin.webContents.send('pin:load-image', base64)
        })
        
        return { success: true, windowId: pinWin.id }
    } catch (err) {
        console.error('[ZSnip] 钉图失败:', err)
        return { success: false, error: err.message }
    }
}
```

**② 钉图窗口 HTML 模板**

HTML



```html
<!-- pin.html -->
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
    background: transparent; 
    overflow: hidden; 
    user-select: none;
    -webkit-app-region: drag;  /* 整个窗口可拖拽 */
}
.pin-container {
    position: relative;
    width: 100vw;
    height: 100vh;
}
.pin-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    -webkit-user-drag: none;
}
/* 工具栏（悬停显示） */
.pin-toolbar {
    position: absolute;
    top: 8px;
    right: 8px;
    display: none;
    gap: 4px;
    background: rgba(30,41,59,0.9);
    padding: 6px;
    border-radius: 8px;
    -webkit-app-region: no-drag;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.pin-container:hover .pin-toolbar { display: flex; }
.pin-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.pin-btn:hover { background: rgba(255,255,255,0.15); }
.pin-btn.close { color: #ef4444; }
/* 边缘阴影 */
.pin-shadow {
    position: absolute;
    inset: -20px;
    pointer-events: none;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
    border-radius: 4px;
}
/* 缩放手柄 */
.resize-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border: 2px solid #fff;
    border-radius: 50%;
    -webkit-app-region: no-drag;
    z-index: 10;
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
<script>
// 钉图交互逻辑
let scale = 1
const img = document.getElementById('pinImg')
const container = document.getElementById('container')

// 接收图片
window.electronAPI.onLoadImage((base64) => {
    img.src = base64
})

// 缩放
document.getElementById('btnZoomIn').onclick = () => { scale *= 1.2; applyScale() }
document.getElementById('btnZoomOut').onclick = () => { scale /= 1.2; applyScale() }
document.getElementById('btnReset').onclick = () => { scale = 1; applyScale() }
function applyScale() {
    img.style.transform = `scale(${scale})`
    img.style.transformOrigin = 'top left'
}

// 滚轮缩放
container.addEventListener('wheel', (e) => {
    e.preventDefault()
    scale *= e.deltaY < 0 ? 1.1 : 0.9
    applyScale()
}, { passive: false })

// 保存
document.getElementById('btnSave').onclick = () => {
    window.electronAPI.savePinImage(img.src)
}

// 复制
document.getElementById('btnCopy').onclick = () => {
    window.electronAPI.copyPinImage(img.src)
}

// 关闭
document.getElementById('btnClose').onclick = () => {
    window.electronAPI.closePinWindow()
}

// 右下角拖拽缩放
const resizeSE = document.getElementById('resizeSE')
let isResizing = false
resizeSE.addEventListener('mousedown', (e) => {
    isResizing = true
    e.preventDefault()
})
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return
    // 通过 IPC 请求调整窗口大小
    window.electronAPI.resizePinWindow(e.movementX, e.movementY)
})
document.addEventListener('mouseup', () => { isResizing = false })

// 双击切换鼠标穿透
let clickThrough = false
container.addEventListener('dblclick', () => {
    clickThrough = !clickThrough
    window.electronAPI.setIgnoreMouseEvents(clickThrough)
})
</script>
</body>
</html>
```

**③ 工具栏增加钉图按钮** ([Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx))

在操作区增加"📌 钉图"按钮：

TSX



```tsx
<button className="tool-btn" onClick={handlePin} title="钉到屏幕 (Ctrl+T)">📌</button>
```

对应的处理函数：

TypeScript



```typescript
const handlePin = async () => {
    const { selection } = useScreenshotStore.getState()
    if (!selection) return
    const c = renderToCanvas(selection)
    const base64 = c.toDataURL('image/png')
    await window.services.pinScreenshot(base64, selection)
    // 钉图不自动关闭，不自动复制（用户可继续编辑或选择其他操作）
}
```

------

### 3.6 工具栏按钮顺序重排

按用户需求顺序重新排列：

Plain Text



```
矩形  圆  文字  画笔  箭头  线条  虚线  马赛克  gif  长截图  固定到屏幕  文字提取  上一步  保存图片  退出  完成
```

更新 [Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx)：

TypeScript



```typescript
// 工具顺序按用户要求
const TOOLS = [
  { type: 'rect', icon: '▢', label: '矩形' },
  { type: 'circle', icon: '○', label: '圆' },
  { type: 'text', icon: 'T', label: '文字' },
  { type: 'pen', icon: '✎', label: '画笔' },
  { type: 'arrow', icon: '→', label: '箭头' },
  { type: 'line', icon: '━', label: '线条' },
  { type: 'mosaic', icon: '◫', label: '马赛克' },
]

// 操作按钮顺序
// [虚线] [马赛克] | [GIF] [长截图] [📌钉图] [OCR] | [↩撤销] | [💾保存] [✕退出] [✓完成]
```

------

### 3.7 P1 功能实现方案（简述）

#### ① 文字提取（OCR）

- 方案：调用系统 OCR API（Windows: `Windows.Media.Ocr`，macOS: `Vision` 框架）
- 或集成 Tesseract.js（纯 JS，约 20MB 语言包，建议按需加载）
- Preload 增加 `extractText(imageBase64)` API，返回识别的文字并自动复制到剪贴板
- 工具栏增加 "A" 或 "文字提取" 按钮

#### ② 长截图/滚动截图

- 方案：用户框选区域后，点击"长截图"进入滚动模式
- 监听鼠标滚轮，自动滚动内容并逐帧拼接
- 使用 Canvas 逐步拼接 capture
- 需主进程配合模拟滚动事件

#### ③ GIF 录制

- 方案：使用 `MediaRecorder` API 录制指定区域
- 框选区域后点击"GIF"开始录制，显示录制计时和停止按钮
- 录制完成后使用 `gif.js` 或 `ffmpeg.wasm` 编码为 GIF
- 建议第一版本先做 WebM 录制，GIF 作为后续优化

------

## 四、文件修改清单

| 文件                                                         | 修改类型 | 改动内容                                                     |
| :----------------------------------------------------------- | :------- | :----------------------------------------------------------- |
| [src/types.ts](file:///workspace/src/types.ts)               | 修改     | 增加 LineShape、dashed 属性、lineDash 配置                   |
| [src/store.ts](file:///workspace/src/store.ts)               | 修改     | 状态增加 lineDash、resizing 等                               |
| [src/Screenshot/index.tsx](file:///workspace/src/Screenshot/index.tsx) | 大幅修改 | 蓝色边框、双位置尺寸提示、手柄渲染、resize 逻辑、工具创建、工具栏内嵌 |
| [src/Screenshot/Toolbar.tsx](file:///workspace/src/Screenshot/Toolbar.tsx) | 修改     | 工具按钮重排、增加直线/虚线/钉图按钮、工具栏 inside 样式     |
| [src/Screenshot/Toolbar.css](file:///workspace/src/Screenshot/Toolbar.css) | 修改     | 内嵌样式、新增按钮样式                                       |
| [src/Screenshot/annotations.ts](file:///workspace/src/Screenshot/annotations.ts) | 修改     | 增加直线绘制、虚线支持、真正马赛克、更新 drawTempShape       |
| [src/Screenshot/index.css](file:///workspace/src/Screenshot/index.css) | 修改     | 手柄样式、尺寸提示 inside 样式                               |
| [public/preload/services.js](file:///workspace/public/preload/services.js) | 修改     | 增加 pinScreenshot、OCR 等 API                               |
| `public/pin.html`                                            | **新增** | 钉图窗口页面                                                 |
| `public/preload/pin-preload.js`                              | **新增** | 钉图窗口 preload 脚本                                        |

------

## 五、开发优先级与里程碑

| 里程碑      | 内容                                                    | 预计工作量 |
| :---------- | :------------------------------------------------------ | :--------- |
| **M1 (P0)** | 蓝色边框、双位置尺寸、工具栏内嵌、直线/虚线、马赛克修复 | 1-2 天     |
| **M2 (P0)** | 钉图完整功能（窗口创建、缩放、保存、关闭、阴影）        | 1-2 天     |
| **M3 (P1)** | 选区调整手柄（8 点拖拽缩放）                            | 0.5-1 天   |
| **M4 (P1)** | OCR 文字提取、工具栏最终顺序                            | 1 天       |
| **M5 (P2)** | 长截图、GIF 录制                                        | 2-3 天     |

------

## 六、交互细节补充

1. **钉图双击切换穿透**：双击钉图窗口切换"鼠标穿透"模式（穿透时可操作后面的窗口）
2. **钉图滚轮缩放**：悬停在钉图上滚轮缩放，Ctrl+滚轮更精细
3. **钉图右键菜单**：右键弹出菜单（复制、保存、置顶、关闭、透明度调节）
4. **选区确定后首次点击空白处**：不直接退出标注，而是优先检测是否点击了手柄或工具栏
5. **"完成"按钮行为**：完成 = 复制并关闭（同当前 Enter 行为）；"退出"= 直接关闭不保存
6. **钉图不自动关闭**：点击钉图后截图窗口不自动关闭，用户可继续选择其他操作（保存/完成/继续标注）