# ZSnap 截图插件 PRD（v1.0 · 开发版）

> 文档代号 `ZSnap-PRD-v1.0` ｜ 适用范围：ZTools 2.6.2+ / uTools 兼容层
> 评审方式：3 人团队（我=架构师+实施改稿 / 千问=技术架构师 / 豆包=产品经理+前端 UX），已合并 33 条风险
> 配套源文档：`zsnap-ztools-plugin.md`（14 章 + 13.5 团队评审章节）
> 文档定位：开发照着做；任何与本 PRD 冲突的源文档内容以本文件为准

---

## 0. 阅读路径

- 第 1 章 给所有读者（产品 / 前端 / 后端 / QA）
- 第 2–5 章 给后端 + 全栈
- 第 6–9 章 给前端 + 标注
- 第 10–13 章 给 QA + 发布
- 第 14 章 全部读者

---

## 1. 需求背景与产品定位

### 1.1 一句话定义

为 ZTools 打造一个**截图 + 标注 + 钉图 + 取色 + GIF 录屏 + OCR 翻译链**的本地一体化工具，主张**「按下快捷键即完成」**的零干扰工作流。

### 1.2 目标用户

| 画像 | 核心场景 | 关键诉求 |
|------|----------|----------|
| 开发者 | 截代码、报错、翻译英文文档 | 快速标注 + 一键 OCR 翻译 |
| 设计师 / 产品 | 截参考图、给 UI 打反馈 | 钉图置顶 + 标注 + 取色 |
| 运营 / 自媒体 | 截素材、做 Gif 动图 | 截图 + GIF 录屏 + 自动复制 |
| 学生 / 研究 | 截论文、表格、英文文献 | 截图 + 翻译链 + 钉图对照 |

### 1.3 竞品基线

| 竞品 | 优势 | ZSnap 差异化 |
|------|------|--------------|
| Snipaste | 钉图体验好 | ZTools 生态 + OCR 翻译链 + GIF 录屏 |
| PixPin | 标注工具丰富 | ZTools cmds 集成 + 隐私优先（不上传原图） |
| ShareX | 功能最全 | 体积小（< 5MB）、不依赖第三方 SaaS |
| uTools 截图插件 | 与 uTools 集成 | 兼容 ZTools + macOS 原生支持 + GIF 编码 |

### 1.4 v1.0 范围声明（Scope）

**In Scope**

- 区域 / 窗口 / 多屏拼接截图
- 标注编辑器（12 种工具 + 重做栈）
- 钉图（8 手柄 / 旋转 / 透明度 / 批量管理）
- 取色器（多格式 + 暂停逻辑）
- GIF 录屏（≤ 60s / 0.75 倍率 / ESC 强制停止）
- OCR + 翻译链式跳转
- 临时缓存加密 + 自动清理
- macOS 屏幕录制 / 辅助权限引导
- Win32 / macOS 双平台

**Out of Scope（v1.0 不做）**

- 录屏（视频） / 视频编辑
- 自定义 GIF 帧率 / 画质滑块（v1.1+）
- 历史截图 / 截图历史回看（v1.2+）
- 跨屏 DPR 统一（v1.2+）
- Linux Wayland 平台
- 团队协作 / 云同步

### 1.5 成功指标（v1.0 灰度期）

| 指标 | 目标 |
|------|------|
| 安装→首次使用完成 | ≤ 30s |
| 截图→保存到剪贴板 | ≤ 200ms（选区抬起 → 复制完成） |
| GIF 录屏→MP4 编码（GIF 输出） | ≤ 5s（60s 视频 0.75 倍率） |
| 钉图首启内存 | ≤ 50MB / 张（1080p 截图） |
| 7 日崩溃率 | ≤ 0.5% |
| 用户满意度（内置 5 星评分） | ≥ 4.3 / 5 |

---

## 2. 角色、术语与目录结构

### 2.1 关键术语

| 术语 | 定义 |
|------|------|
| **ZTools 宿主** | 插件运行环境，提供 `utools.*` API |
| **cmds** | ZTools 主输入框的特征指令（如 `zsnap-capture`） |
| **preload** | 渲染进程与主进程的安全桥接（`window.zsnap`） |
| **IPC** | 主进程 ↔ 渲染进程消息通道（命名 `service:action`） |
| **DPR** | device pixel ratio，物理像素与 CSS 像素比 |
| **持久化键** | 全部走 `utools.dbStorage`，单 key ≤ 1MB |
| **临时缓存** | 加密后存 `temp/zsnap-cache/`，7 天清理 |
| **原图坐标 / CSS 像素 / 物理像素** | 见源文档 6.3 节统一规范 |

### 2.2 仓库目录结构

```text
zsnap/
├─ plugin.json                  # ZTools 元数据
├─ preload.js                   # 安全桥接，暴露 window.zsnap
├─ logo.png                     # 插件图标 256×256
├─ src/
│  ├─ services/                 # 9 个核心服务
│  │  ├─ capture.js             # 截图能力
│  │  ├─ editor.js              # 标注编辑器
│  │  ├─ pin.js                 # 钉图（含系统事件监听）
│  │  ├─ color.js               # 取色器（含 rAF 节流）
│  │  ├─ gif.js                 # GIF 录屏（含 ESC 拦截 + 看门狗）
│  │  ├─ ocr.js                 # OCR 跳转 + 离线降级
│  │  ├─ translate.js           # 翻译链 + 节流
│  │  ├─ detect.js              # 能力探测（权限 / API / 平台）
│  │  └─ fileio.js              # 跨平台 path + 加密 IO
│  └─ pages/                    # 11 个独立页面
│     ├─ editor.html
│     ├─ color.html
│     ├─ gif-recorder.html
│     ├─ pin-manager.html
│     ├─ settings.html
│     └─ ...
└─ assets/                      # 图标、Cursor、马赛克纹理
```

---

## 3. plugin.json 元数据

```json
{
  "main": "index.html",
  "logo": "logo.png",
  "preload": "preload.js",
  "platform": ["win32", "darwin"],
  "cmds": [
    { "type": "over", "label": "区域截图", "code": "zsnap-capture",
      "cmds": ["zsnap-capture", "截图", "snapshot"] },
    { "type": "over", "label": "取色器", "code": "zsnap-color",
      "cmds": ["zsnap-color", "取色", "color-picker"] },
    { "type": "over", "label": "GIF 录屏", "code": "zsnap-gif",
      "cmds": ["zsnap-gif", "录屏", "gif"] },
    { "type": "over", "label": "OCR 文字识别", "code": "zsnap-ocr",
      "cmds": ["zsnap-ocr", "ocr", "文字识别"] },
    { "type": "over", "label": "截图翻译", "code": "zsnap-ocr-translate",
      "cmds": ["zsnap-ocr-translate", "翻译", "translate"] }
  ],
  "description": "截图 + 标注 + 钉图 + 取色 + GIF 录屏 + OCR 翻译，本地优先不外发原图。",
  "author": "ZSnap Team",
  "version": "1.0.0"
}
```

> **实施注意**：
> - `platform: ["win32", "darwin"]` 必须保留，Linux Wayland 不在 v1.0 支持
> - 每个 `cmds` 同时声明备用关键词，匹配按 ZTools 主程序顺序
> - 备用快捷键（`Ctrl+Alt+Z` 等）通过 cmds 自动调度，**插件代码内不再注册 globalShortcut**

---

## 4. preload 桥接规范

### 4.1 暴露的 `window.zsnap` 命名空间

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zsnap', {
  capture: {
    enter:        (cb) => ipcRenderer.invoke('capture:enter', cb),
    region:       () => ipcRenderer.invoke('capture:region'),
    window:       () => ipcRenderer.invoke('capture:window'),
    fullscreen:   () => ipcRenderer.invoke('capture:fullscreen'),
  },
  pin: {
    show:         (dataURL, opts) => ipcRenderer.invoke('pin:show', { dataURL, opts }),
    move:         (winId, dx, dy) => ipcRenderer.send('pin:move', { winId, dx, dy }),
    resize:       (winId, handle, dx, dy) => ipcRenderer.send('pin:resize', { winId, handle, dx, dy }),
    resizeEnd:    (winId) => ipcRenderer.send('pin:resize:end', { winId }),
    opacity:      (winId, opacity) => ipcRenderer.send('pin:opacity', { winId, opacity }),
    close:        (winId) => ipcRenderer.send('pin:close', { winId }),
    list:         () => ipcRenderer.invoke('pin:list'),
    batchMinimize:() => ipcRenderer.invoke('pin:batch-minimize'),
    batchRestore: () => ipcRenderer.invoke('pin:batch-restore'),
    purge:        () => ipcRenderer.invoke('pin:purge'),
  },
  gif: {
    start:        () => ipcRenderer.invoke('gif:start'),
    stop:         () => ipcRenderer.invoke('gif:stop'),
    onHeartbeat:  (cb) => ipcRenderer.on('gif:heartbeat', () => cb()),
    onForceStop:  (cb) => ipcRenderer.on('gif:force-stop', (_, p) => cb(p)),
  },
  ocr: {
    captureAndOcr:  (mode) => ipcRenderer.invoke('ocr:capture', mode),
  },
  detect: {
    screenRecordOk:  () => ipcRenderer.invoke('detect:screen-record'),
    ocrPlugin:       () => ipcRenderer.invoke('detect:ocr-plugin'),
    desktopCapture:  () => ipcRenderer.invoke('detect:desktop-capture'),
    macAlwaysOnTop:  () => ipcRenderer.invoke('detect:mac-always-on-top'),
  },
  storage: {
    get:    (key) => ipcRenderer.invoke('storage:get', key),
    set:    (key, val) => ipcRenderer.invoke('storage:set', { key, val }),
    remove: (key) => ipcRenderer.invoke('storage:remove', key),
  },
  sys: {
    platform: process.platform,
    version:  '1.0.0',
  },
});
```

### 4.2 安全约束

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`（preload 用 `electron.contextBridge`）
- preload.js 禁止 `require('fs')`、`require('path')` 等模块，所有 IO 走主进程 IPC
- CSP：`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`

---

## 5. 服务层 9 大模块契约

### 5.1 `capture`（截图）

| 接口 | 入参 | 出参 | 失败处理 |
|------|------|------|----------|
| `enter(cb)` | 回调 `dataURL` | 触发 `utools.screenCapture` | 回调 null → `outPlugin()` |
| `region()` | — | `dataURL` | 200ms 防抖后单次回调（4.2.1） |
| `window()` | 窗口 ID（可选） | `dataURL` | 失败降级 region |
| `fullscreen()` | — | `dataURL` | 沙箱无 API → 多屏拼接降级（4.1.2） |

**关键算法**：`debouncedScreenCapture(cb, 200)` + 1.5s 兜底。

**降级决策树**（必须实现）：

```text
desktopCaptureSources 存在?
├── true  → getUserMedia → dataURL
├── false → 多屏拼接降级 + 通知
└── throw → 错误引导（macOS 屏幕录制权限）
```

**macOS 权限前置**（4.1.1）：`ensureScreenRecordPermission()` 在每次 `enter` 前调用，失败时弹引导弹窗。

**敏感区检测**（4.1.3）：窗口标题含 "登录/支付/密码/验证码/login/pay/bank" 时显示「一键模糊敏感区」按钮。

### 5.2 `editor`（标注）

| 工具 | 键 | 备注 |
|------|----|------|
| 矩形 | R | 默认 |
| 椭圆 | O | |
| 直线 | L | |
| 箭头 | A | |
| 序号 | N | 自增 |
| 铅笔 | P | Bezier 平滑 |
| 荧光笔 | H | alpha 0.4 |
| 文字 | T | 双击进入编辑 |
| 马赛克 | M | 9×9 像素块 |
| 模糊 | B | `filter: blur(12px)` |
| 橡皮 | E | 半径 20px |
| 取色 | I | 切换到 color 服务 |

**渲染分层**（6.4）：Layer 0 原图 / Layer 1 已提交 / Layer 2 实时绘制 / Layer 3 UI。每层独立 Canvas 实例（6.4.1），互不共享 ctx 状态。

**画布约束**（6.4.2）：`MAX_CANVAS_PIXELS = 60_000_000`，`MAX_DIMENSION = 8192`，超出自动等比缩放并提示。

**撤销 / 重做栈**（6.5 + 6.5.4）：

| 模式 | 栈深度 | 单条大小 |
|------|--------|----------|
| 简单模式 | 100 | ≤ 10 KB |
| 高性能模式 | 50 | ≤ 5 KB |

**快捷键硬绑定**（6.2.1）：keydown 监听，`presetOverride` 支持 VSCode / Photoshop 风格。

### 5.3 `pin`（钉图）

| IPC | payload | 主进程行为 |
|-----|---------|------------|
| `pin:move` | `{winId, dx, dy}` | 边界 clamp |
| `pin:resize` | `{winId, handle, dx, dy}` | 最小 30×30（D-5）+ 等比 clamp |
| `pin:resize:start/end` | `{winId}` | 状态切换 |
| `pin:opacity` | `{winId, opacity}` | 0.1–1.0 |
| `pin:close` | `{winId}` | `win.destroy()` |
| `pin:save-snapshot` | `{reason}` | 系统事件触发，3s 兜底 hide |
| `pin:batch-minimize/restore` | `{winIds}` | 主面板批量 |

**持久化**：

```text
zsnap.pins.index    → Array<{id, bounds, opacity, createdAt}>
zsnap.pins.data.{id} → dataURL
```

**系统事件**（5.7）：监听 `powerMonitor.lock-screen / suspend / screen.display-removed` → `saveAllPinSnapshots(reason)` → renderer 序列化 → 主进程 hide；解锁时 `restoreAllPinSnapshots`。

**macOS 辅助权限**（5.6）：`systemPreferences.isTrustedAccessibilityClient(true)`，未授权弹引导。

**批量管理**（5.8）：主面板「📌 钉图收纳」提供「全部最小化 / 全部还原 / 一键清空」三按钮，最小化保留内存缓存。

### 5.4 `color`（取色器）

**启动流程**：`startPickPolling()` → rAF tick，每帧 `pickAtCursor()`。

**全屏暂停**（7.4.2）：`isFrontFullscreen()` 检测到全屏前台应用时 `paused = true`，状态切换为「⏸ 已暂停」，退出全屏自动恢复。

**格式切换**（7.4.1）：

| 格式 | 示例 | 函数 |
|------|------|------|
| HEX | `#FF7849` | `formatHEX` |
| RGB | `rgb(255,120,73)` | `formatRGB` |
| HSL | `hsl(16, 100%, 64%)` | `formatHSL` |
| HSLA | `hsla(16, 100%, 64%, 1.0)` | `formatHSLA` |

切换通过 `format-tabs` 按钮组，复制走 `safeWriteText`（降级到剪贴板失败时弹提示）。

### 5.5 `gif`（GIF 录屏）

**关键控制流**：

```text
start → state.status = 'recording'
     → register ESC capture phase
     → requestAnimationFrame loop
     → encoder.addFrame(0.75×scale, 15fps)
     → watchDog(60s)
     → user ESC / stop / timeout
     → encoder.finish()
     → state.status = 'done'
     → saveGif()
```

**ESC 强制停止**（11.4.5）：`keydown` 监听 + `{capture: true}`，避免被业务监听器吞掉。

**主进程看门狗**：

- 每 5s `gif:heartbeat` 广播
- 15s 未响应 → `gif:force-stop` 广播 → renderer 强制 finish
- 单次录制总时长 ≤ 60s 硬上限

**沙箱兼容**（11.4.6）：`ensureRecorderApi()` 探测 `utools.desktopCaptureSources` 存在性。

**编码库**：gifenc 5KB，Web Worker 跑编码，主线程 rAF 抽帧。

**降级**：不支持的 ZTools 版本 → 弹版本升级引导。

### 5.6 `ocr`（OCR 跳转）

**完整流程**：

```text
captureAndOcr(mode)
├── detect.ocrPlugin() === false
│   ├── navigator.onLine === false + cache hit  → offlineOcr()
│   ├── navigator.onLine === false + cache miss → 'no-offline-cache-and-offline'
│   └── navigator.onLine === true + cache miss  → 'install-ocr-plugin'
├── ensureScreenRecordPermission() = false     → showMacPermissionDialog()
├── withTimeoutAndRetry(() => utools.redirect(['OCR 文字识别', 'OCR 识别'],
│       { type: 'img', payload: dataURL }),
│       { timeoutMs: 3000, retries: 1 })
└── ok === false → handleRedirectFailed()
```

**离线降级**（12.8.2）：首次联网时**静默下载** tesseract.js + chi_sim 到 `caches('zsnap-tesseract-v1')`；断网时用本地 worker。

**隐私**（12.8.3）：OCR 跳转用 `type: 'img'`，翻译链式跳转改 `type: 'text'`，**永不传原图到翻译插件**。

**超时控制**（12.8.4）：`withTimeoutAndRetry` 统一 3s 超时 + 重试 1 次（间隔 500ms / 1000ms）。

### 5.7 `translate`（翻译链）

**节流器**（12.8.5）：

```javascript
class TranslateThrottle {
  constructor({ maxConcurrent = 2, windowMs = 1000, maxBurst = 5 })
  // 1s 窗口内最多 5 次，并发 ≤ 2
}
```

**用户提示**：被节流时 `utools.showNotification('⚠️ 翻译请求过于频繁，请 1s 后重试')`。

**失败回退**：`translate-rate-limited` → 仅 OCR；翻译插件未装 → 引导安装。

### 5.8 `detect`（能力探测）

| 接口 | 探测目标 | 返回 |
|------|----------|------|
| `screenRecord()` | macOS 屏幕录制权限 | `boolean` |
| `ocrPlugin()` | 官方 OCR 插件 | `boolean` |
| `desktopCapture()` | `utools.desktopCaptureSources` | `boolean` |
| `macAlwaysOnTop()` | macOS 辅助权限 | `boolean` |

**热键冲突**（8.3.1）：`detectLocalHotkeyConflicts()` Windows 读注册表 + 启动项扫描，命中 `KNOWN_HOTKEYS` 表时弹窗。

**备用快捷键表**（8.3.2）：

| 主功能 | 主键（cmds） | 备用 1 | 备用 2 |
|--------|--------------|--------|--------|
| 区域截图 | `zsnap-capture` | `Ctrl+Alt+Z` | `Alt+Shift+S` |
| 取色 | `zsnap-color` | `Ctrl+Alt+C` | `Alt+Shift+C` |
| GIF | `zsnap-gif` | `Ctrl+Alt+G` | `Alt+Shift+G` |
| OCR | `zsnap-ocr` | `Ctrl+Alt+O` | `Alt+Shift+O` |
| 翻译 | `zsnap-ocr-translate` | `Ctrl+Alt+T` | `Alt+Shift+T` |

### 5.9 `fileio`（文件 IO + 加密）

**跨平台 path**（E-5）：全部 `path.join`，禁止硬编码 `\\` 或 `/`。

**临时缓存**（9.4.1）：

```text
{utools.getPath('temp')}/zsnap-cache/
├── screenshots/  # 截图临时缓存
├── ocr-text/     # OCR 文本
├── gif-temp/     # GIF 编码中转
└── pins/         # 钉图序列化
```

**加密**：AES-256-CBC，密钥派生 `crypto.scryptSync(nativeId, 'zsnap-salt-v1', 32)`，前 16 字节存 IV。

**生命周期**：

- `utools.onPluginEnter` → `cleanExpiredCache(7)`
- `utools.onPluginOut` → `purgeAllCache()`
- `app.on('will-quit')` → `purgeAllCache()`

**用户入口**：主面板「偏好 → 🗑 立即清空缓存」按钮。

---

## 6. 数据与持久化

### 6.1 持久化键清单

| Key | 类型 | 用途 | 写入时机 |
|-----|------|------|----------|
| `zsnap.config` | Object | 用户配置 | 设置页修改 |
| `zsnap.pins.index` | Array | 钉图索引 | 钉图创建 / 销毁 |
| `zsnap.pins.data.{id}` | String | 钉图 dataURL | 钉图创建 |
| `zsnap.cache.lastClean` | Number | 上次清理时间戳 | 清理完成 |
| `zsnap.editor.preset` | String | 编辑器预设 | 修改预设 |
| `zsnap.color.format` | String | 默认颜色格式 | 切换格式 |
| `zsnap.shortcut.preset` | String | 快捷键预设 | 修改预设 |
| `zsnap.privacy.consent` | Boolean | 隐私协议已确认 | 首次启动 |
| `zsnap.telemetry.enabled` | Boolean | 埋点开关 | 修改设置 |
| `zsnap.ocr.offlineCache` | Number | 离线 OCR 缓存时间戳 | 下载完成 |

### 6.2 用户配置（`zsnap.config`）

```typescript
interface ZSnapConfig {
  saveDir: string;            // 默认 Pictures
  defaultAction: 'edit' | 'copy' | 'save' | 'pin' | 'gif' | 'ocr' | 'ocr-translate';
  autoCopy: boolean;          // C-1 独立开关
  filenamePattern: string;    // 默认 'zsnap_{timestamp}'
  editorPreset: 'default' | 'vscode' | 'photoshop';
  shortcutPreset: 'default' | 'vscode' | 'photoshop';
  colorFormat: 'hex' | 'rgb' | 'hsl' | 'hsla';
  gifFps: 10 | 12 | 15;       // v1.0 锁定 15
  gifScale: 0.5 | 0.75 | 1.0; // v1.0 锁定 0.75
  maxRecordSeconds: 30 | 60;  // v1.0 锁定 60
  redactSensitive: boolean;   // F-1 敏感区自动模糊
  ocrEngine: 'redirect' | 'offline';
  telemetryEnabled: boolean;
  privacyConsent: boolean;
}
```

### 6.3 隐私 / 缓存策略

- **原图不上传**：截图默认本地加密缓存
- **OCR 隐私**：跳转传图只到官方离线插件；翻译只传文本（F-2）
- **临时缓存**：AES-256 加密 + 7 天清理 + 退出清空（F-3 / D-4）
- **埋点**：默认关闭，开启时仅上报**功能使用计数**（无内容）

---

## 7. 用户流程与功能原型

### 7.1 核心用户流：截图 → 标注 → 钉图 → OCR

```text
1. 用户按 Ctrl+Alt+Z（或主输入框输入"截图"）
   ↓
2. ZTools 唤起插件 → hideMainWindow
   ↓
3. utools.screenCapture + 200ms 防抖
   ↓
4. 系统截图 UI 出现 → 选区 → 释放
   ↓
5. 截图完成 → defaultAction 判断
   ├── 'edit'           → 打开标注编辑器
   ├── 'copy'           → 剪贴板 + 通知
   ├── 'save'           → 保存到 Pictures
   ├── 'pin'            → 钉图
   ├── 'gif'            → GIF 录屏
   ├── 'ocr'            → 跳 OCR
   └── 'ocr-translate'  → 跳 OCR → 翻译
   ↓
6. 标注完成后：
   ├── 复制 / 保存 / 钉图 / OCR 翻译
   └── 全部走 safeWriteXXX 降级路径
```

### 7.2 异常流程：权限拒绝

```text
macOS 首次截图
├── getUserMedia 试错
├── NotAllowedError
└── 弹引导弹窗
    ├── [打开系统设置] → utools.shellOpenExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    └── [稍后再试]   → outPlugin()
```

### 7.3 异常流程：录屏卡死

```text
GIF 录制中（用户感觉卡了）
├── 按 ESC → 立即 stopRecord({ force: true, reason: 'user-esc' })
│   ├── 解绑 ESC 监听
│   ├── stream.getTracks().stop()
│   ├── worker.postMessage({ type: 'cancel' })
│   ├── encoder.finish()
│   └── 3s 超时兜底
└── 主进程看门狗（无 ESC 时）
    ├── 每 5s heartbeat
    ├── 15s 无响应 → force-stop 广播
    └── 60s 总时长硬上限
```

### 7.4 原型速查（接口契约，不画图）

| 页面 | 关键元素 | 数据流 |
|------|----------|--------|
| `editor.html` | 12 工具按钮 / 画布 / 重做栈 | `editor.setTool()` / `editor.undo()` |
| `color.html` | 放大镜 / 4 格式 tab / 复制 | `color.pickAt(x,y)` / `color.copy()` |
| `gif-recorder.html` | 录制按钮 / 时长 / ESC 提示 | `gif.start()` / `gif.stop()` |
| `pin-manager.html` | 缩略图列表 / 批量按钮 | `pin.list()` / `pin.batchRestore([])` |
| `settings.html` | 12 个开关 / 6 个下拉 | `storage.set('zsnap.config', ...)` |

---

## 8. 命令与 IPC 全表

### 8.1 渲染 → 主（invoke 模式，返回值）

| IPC | 请求 | 响应 |
|-----|------|------|
| `capture:enter` | — | `dataURL \| null` |
| `capture:region` | — | `dataURL` |
| `capture:window` | `winId?` | `dataURL` |
| `capture:fullscreen` | — | `dataURL` |
| `pin:show` | `{dataURL, opts}` | `winId` |
| `pin:list` | — | `PinInfo[]` |
| `pin:batch-minimize` | — | `number` |
| `pin:batch-restore` | — | `number` |
| `pin:purge` | — | `number` |
| `gif:start` | — | `{ok, reason?}` |
| `gif:stop` | — | `{path, duration, frames}` |
| `ocr:capture` | `mode` | `{ok, text?, source}` |
| `detect:*` | — | `boolean` |
| `storage:get` | `key` | `any` |
| `storage:set` | `{key, val}` | `{ok}` |
| `storage:remove` | `key` | `{ok}` |

### 8.2 渲染 → 主（send 模式，fire-and-forget）

`pin:move` / `pin:resize` / `pin:resize:start` / `pin:resize:end` / `pin:opacity` / `pin:close`

### 8.3 主 → 渲染（广播）

`gif:heartbeat` / `gif:force-stop` / `pin:save-snapshot` / `pin:batch-minimize` / `pin:batch-restore`

---

## 9. 错误与降级矩阵

### 9.1 系统级失败

| 失败 | 检测点 | 降级 |
|------|--------|------|
| macOS 屏幕录制权限拒绝 | `getUserMedia` throw NotAllowedError | 弹引导弹窗 + 「打开系统设置」按钮 |
| macOS 辅助权限拒绝 | `systemPreferences.isTrustedAccessibilityClient(false)` | 钉图置顶降级为普通窗口 + 弹引导 |
| `desktopCaptureSources` 不存在 | 启动时 `typeof` 检测 | 多屏拼接 + 通知 |
| 剪贴板写入失败 | `clipboard.writeImage` throw | 保存到文件 + 弹降级提示 |
| IPC 响应超时 | `withTimeoutAndRetry` 3s | 重试 1 次 → 失败弹降级 |
| Tesseract 下载失败 | `cache.addAll` 抛错 | 静默，下次再试 |
| 临时缓存写入失败 | `fs.writeFileSync` throw | 内存 dataURL 兜底 + 提示 |

### 9.2 业务级失败

| 失败 | 检测点 | 降级 |
|------|--------|------|
| OCR 插件未装 | `detect.ocrPlugin()` | 离线 OCR / 引导安装 |
| 翻译插件未装 | `utools.redirect('翻译', ...)` 返回 false | 仅 OCR + 通知 |
| 选区拖动多次回调 | 200ms 防抖 | 1.5s 兜底强制触发 |
| 钉图缩到极小 | 30×30 硬约束 | 隐藏手柄 |
| 全屏游戏前台 | `isFrontFullscreen()` | 暂停 rAF + 状态切换 |
| 钉图被锁屏释放 | `powerMonitor.lock-screen` | 持久化 + 恢复 |
| GIF 编码超时 | 3s watchdog | 强制 finish |
| GIF 录屏 60s | 主进程 timeout | force-stop 广播 |

### 9.3 用户体验级失败

| 失败 | 表现 | 应对 |
|------|------|------|
| 首次启动不知道快捷键 | 主面板「快捷键说明」卡片 | 设置页 + 命令面板帮助 |
| 截图失败无反馈 | `null` 回调 | 通知「截图已取消」 |
| OCR 长时间无响应 | spinner 持续 | 3s 超时 + 重试 + 降级 |
| 钉图误关 | 撤销栈 | `Ctrl+Shift+Z` 恢复最近一个 |

---

## 10. 性能与质量基线

### 10.1 性能基线

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 截图响应 | ≤ 200ms（按 ESC / 释放鼠标到回调） | L4 自动化测试 |
| 标注 60fps | 12 工具切换 ≤ 16ms | rAF profiler |
| 钉图 8 手柄 | 缩放反馈 ≤ 32ms | L5 IPC roundtrip |
| GIF 60s 编码 | ≤ 5s 完成 | L11 worker 计时 |
| OCR 跳转 | ≤ 3s 出结果 | L12 超时检测 |
| 翻译链 | ≤ 5s 出结果 | L12 + throttle |
| 内存占用 | 主面板 ≤ 80MB，钉图每张 ≤ 50MB | DevTools Memory |

### 10.2 兼容性矩阵

| 平台 | 最低版本 | 备注 |
|------|----------|------|
| Windows | Win10 1909+ | 必须 1903+ 才能用 `getUserMedia` |
| macOS | 11.0+ | Big Sur 起支持 `screenCapture` |
| ZTools | 2.6.2+ | `desktopCaptureSources` 必须 |
| uTools | 兼容层 | 仅运行，不保证 v1.0 全功能 |

### 10.3 代码质量

- ESLint：`@typescript-eslint/recommended` + `eslint:recommended`
- Prettier：单行 100 字符，缩进 2
- 提交：Conventional Commits，PR 必须有 issue 关联
- 单测：Vitest，覆盖率 ≥ 60%（核心 service）
- E2E：Playwright（ZTools 集成由 QA 手工）

---

## 11. 验证标准

### 11.1 功能验收（按 L1–L14 章节）

| 章节 | 验收项 | 通过条件 |
|------|--------|----------|
| L4 截图 | 区域 / 窗口 / 全屏三种模式 | 都能生成 dataURL，权限缺失有引导 |
| L4.1.1 | macOS 权限前置 | 首次启动就弹引导，未授权不进入截图 |
| L4.1.2 | 沙箱降级 | ZTools 不支持 desktopCapture 时降级多屏拼接 |
| L4.1.3 | 敏感区模糊 | 窗口标题命中关键字时工具栏出现「一键模糊」 |
| L4.2.1 | 200ms 防抖 | 连续快速拖动 10 次仅弹 1 次编辑器 |
| L4.3.1 | autoCopy 开关 | 关闭时不污染剪贴板 |
| L4.3.2 | 剪贴板失败降级 | 弹「剪贴板写入失败」+ 打开文件夹 |
| L5.5 | 钉图 8 手柄 | 全部 8 方向可拖 |
| L5.6 | macOS 辅助权限 | 未授权时弹引导 + 降级为非置顶 |
| L5.7 | 系统事件 | 锁屏后钉图不消失，唤醒后恢复 |
| L5.8 | 批量管理 | 3 张钉图可同时最小化 / 还原 / 清空 |
| L5.9 | 最小 30×30 | 钉图不可缩到 30×30 以下 |
| L6.2.1 | 工具单键 | R/O/L/A/N/P/H/T/M/B/E/I 全部响应 |
| L6.4.1 | 画布实例 | 4 个 Canvas 互不共享 ctx |
| L6.4.2 | 6000 万像素 | 超大图自动缩放并提示 |
| L6.5.4 | 栈深上限 | 100 步后最旧被丢弃 |
| L7.4.1 | 多格式 | 4 格式切换 + 复制 |
| L7.4.2 | 全屏暂停 | 切全屏游戏后状态变 ⏸ |
| L8.3.1 | 热键冲突 | 安装时检测 Snipaste / QQ / 微信 占用 |
| L9.4.1 | 临时加密 | 缓存目录文件非明文 |
| L9.4.1 | 7 天清理 | 模拟 7 天前文件被清 |
| L9.4.1 | 退出清空 | 退出后缓存目录为空 |
| L11.4.5 | ESC 强制停止 | 录屏中按 ESC 立即停止 + 释放资源 |
| L11.4.5 | 主进程看门狗 | 注入崩溃模拟后 3s 内 finish |
| L11.4.6 | 沙箱兼容 | 探测 desktopCaptureSources 不存在时引导升级 |
| L12.8.2 | 离线降级 | 断网时仍可识别 |
| L12.8.3 | 隐私 | 翻译链只传文本 |
| L12.8.4 | 超时 | OCR 3s 无响应自动重试 + 降级 |
| L12.8.5 | 翻译节流 | 1s 内点 5 次第 6 次被节流 |

### 11.2 性能验收

| 指标 | 工具 | 通过 |
|------|------|------|
| 截图 200ms | L4 自动化 | DevTools Performance |
| 标注 60fps | L6 | rAF profiler |
| GIF 5s 编码 | L11 | console.time |
| 内存 50MB / 钉图 | L5 | DevTools Memory snapshot |

### 11.3 安全验收

| 项 | 检查方式 | 通过 |
|----|----------|------|
| CSP | 浏览器控制台 | 无 inline script 警告 |
| 临时缓存加密 | 检查缓存文件 | `file` 命令识别不出 PNG |
| OCR 翻译仅传文本 | 抓包 | payload 无 dataURL |
| preload 隔离 | 渲染进程 console | `require` 未定义 |

---

## 12. 发布与灰度

### 12.1 灰度节奏

| 阶段 | 范围 | 周期 | 通过条件 |
|------|------|------|----------|
| 内部 alpha | ZSnap 团队 + 5 名内测 | 2 周 | P0/P1 全修 |
| 封闭 beta | ZTools 社区 50 人 | 2 周 | 7 日崩溃率 ≤ 1% |
| 开放 beta | ZTools 插件市场公开 | 4 周 | 用户评分 ≥ 4.0 |
| 正式 v1.0 | 全量 | — | 7 日崩溃率 ≤ 0.5% + 评分 ≥ 4.3 |

### 12.2 灰度开关

- 关键功能通过 `utools.dbStorage.get('zsnap.beta.featureX')` 控制
- 灰度用户 10% 开启
- 灰度失败一键回滚（清空 feature flag）

### 12.3 回滚预案

- ZTools 插件市场支持版本回退到上一个稳定版
- 本地配置保留 7 天历史，自动迁移
- 临时缓存清理兜底：清空 `zsnap.pins.*` / `zsnap.config` 即可恢复出厂

---

## 13. 风险与未决

### 13.1 v1.0 已修复风险（33 条）

详见源文档 13.4 风险清单 + 13.5 团队评审综合。**所有 P0/P1 已修复**。

### 13.2 v1.0 残留风险（接受）

| 风险 | 接受理由 |
|------|----------|
| Wayland 不支持 | plugin.json 限定平台 |
| 多屏拼接有 1s 延迟 | 触发频次 < 5%，用户可降级区域截图 |
| OCR 离线首次下载 5MB | 用户首次联网静默完成 |
| GIF 60s 上限 | 满足 90% 用户需求 |

### 13.3 推迟到 v1.1+

| 编号 | 内容 |
|------|------|
| C-4 | GIF 自定义帧率 / 画质滑块 |
| C-5 | 截图放大双线性插值 |
| C-7 | 最近 10 张截图 + 5 分钟历史 |
| E-2 | 跨屏 DPR 统一坐标 |

### 13.4 开放问题

| 问题 | 状态 | 跟进人 |
|------|------|--------|
| ZTools 是否开放 OCR 插件的离线模式公开 API | 待确认 | 后端 |
| ZTools 2.7 是否提供 `getAllWindows` API | 待跟踪 | 后端 |
| macOS 14 Sonoma 录屏是否需要重新授权 | 已知 | QA |

---

## 14. 团队评审归档

### 14.1 评审角色

| 角色 | 视角 | 已合并 |
|------|------|--------|
| 我（架构师 + 实施改稿） | 落地 / 工程 | ✅ |
| 千问 R1 | 工程深度（9 类） | ✅ |
| 千问 R2 | 隐藏风险（3 隐藏 + 2 小建议） | ✅ |
| 豆包 R1 | 产品 + 前端 UX（33 条 / 56 分 → 82 分） | ✅ |

### 14.2 本 PRD 新增（vs 源文档）

| 来源 | 新增章节 | 理由 |
|------|----------|------|
| PRD skill | 1.4 范围声明 / 1.5 成功指标 | 验收必备 |
| PRD skill | 2.1 术语表 | 跨角色沟通 |
| PRD skill | 2.2 仓库目录 | 开发第一参考 |
| PRD skill | 3 plugin.json 完整示例 | 复制即用 |
| PRD skill | 4 preload 完整桥接 | 复制即用 |
| PRD skill | 8 IPC 全表 | 联调必备 |
| PRD skill | 9 错误与降级矩阵 | 验收必备 |
| PRD skill | 10 性能与质量基线 | 验收必备 |
| PRD skill | 11 验证标准（30+ 条） | QA 必查 |
| PRD skill | 12 灰度与回滚 | 发布必读 |

### 14.3 待办 / 用户补充

- [ ] 用户手动在浏览器中**点击发送**千问 / 豆包的评审 prompt
- [ ] 如 AI 反馈有新建议，由我**追加到本 PRD 第 13 章**并**同步到源文档第 13.5 章**

---

## 附录 A：快速参考 — 关键代码片段索引

| 位置 | 用途 | 源文档章节 |
|------|------|------------|
| `preload.js` 模板 | 安全桥接 | 4.1 |
| `debouncedScreenCapture` | 200ms 防抖 | 4.2.1 |
| `safeWriteImage` | 剪贴板降级 | 4.3.2 |
| `ensureScreenRecordPermission` | macOS 权限 | 4.1.1 |
| `ensureMacAlwaysOnTop` | macOS 辅助 | 5.6 |
| `watchSystemEvents` | 系统事件防御 | 5.7 |
| `startGlobalEscGuard` | GIF ESC | 11.4.5 |
| `ensureOfflineOcrLoaded` | OCR 离线 | 12.8.2 |
| `withTimeoutAndRetry` | 超时重试 | 12.8.4 |
| `TranslateThrottle` | 翻译节流 | 12.8.5 |
| `encryptFile / decryptFile` | AES-256 | 9.4.1 |
| `clampCanvasSize` | 6000 万像素 | 6.4.2 |
| `detectLocalHotkeyConflicts` | 热键冲突 | 8.3.1 |

## 附录 B：关键决策记录（ADR 摘要）

| 决策 | 选项 | 选择 | 原因 |
|------|------|------|------|
| 钉图持久化 | IndexedDB / dbStorage / 本地文件 | dbStorage + 拆分 dataURL | 与 ZTools 生态一致，单 key 不超 1MB |
| 临时加密算法 | AES-256-GCM / AES-256-CBC | CBC | GCM 性能损耗大，CBC 5MB 截图 < 50ms |
| OCR 离线库 | Tesseract.js / PaddleOCR | Tesseract.js | 体积小（5MB），chi_sim 准确率 88% 够用 |
| GIF 编码库 | gifenc / gif.js / ccapture | gifenc | 5KB gzip，主线程不卡 |
| 标注撤销栈 | Snapshot / Delta | 两种模式自动切换 | 标注 < 50 用 snapshot，> 50 用 OffscreenCanvas delta |
| 翻译跳转 | 仅文本 / 仅图片 / 文本+元组 | 仅文本（F-2） | 隐私优先 |
| 跨平台 path | 硬编码 \\ / /  / node path | node path（E-5） | macOS 必须 |

## 附录 C：版本与变更

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1 | 2026-05 | 初始方案 |
| 0.5 | 2026-06-10 | 加入 GIF 录屏 |
| 0.8 | 2026-06-15 | 加入 OCR 联动 |
| 0.9 | 2026-06-25 | 3 人团队评审首轮 |
| 1.0-rc | 2026-06-29 | 33 条风险全部修复，转写为 PRD |
| 1.0 | 待发布 | 灰度通过 |

---

**文档结束。开发请按第 5 章服务契约、第 8 章 IPC 表、第 11 章验证标准逐项实现。**
