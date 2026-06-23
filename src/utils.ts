// ZSnip 截图插件 - 工具函数

let _uid = 0
export function uid(): string { return 's' + (++_uid).toString(36) + Date.now().toString(36) }

export function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)) }

export function getShapeBounds(s: { bounds: { x: number; y: number; width: number; height: number } }) { return s.bounds }