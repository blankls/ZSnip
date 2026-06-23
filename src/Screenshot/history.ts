// ZSnip 截图插件 - 增量 diff 撤销/重做

import type { AnyShape } from '../types'

interface DiffOp { type: 'add'; shape: AnyShape }

export class HistoryStack {
  private shapes: AnyShape[] = []
  private undoStack: DiffOp[] = []
  private redoStack: DiffOp[] = []

  recordAdd(shape: AnyShape) {
    this.shapes.push(shape)
    this.undoStack.push({ type: 'add', shape })
    this.redoStack = []
  }

  undo(): AnyShape[] | null {
    const op = this.undoStack.pop()
    if (!op) return null
    if (op.type === 'add') {
      this.shapes = this.shapes.filter(s => s.id !== op.shape.id)
    }
    this.redoStack.push(op)
    return [...this.shapes]
  }

  redo(): AnyShape[] | null {
    const op = this.redoStack.pop()
    if (!op) return null
    if (op.type === 'add') {
      this.shapes.push(op.shape)
    }
    this.undoStack.push(op)
    return [...this.shapes]
  }

  getAllShapes(): AnyShape[] { return [...this.shapes] }
  get canUndo() { return this.undoStack.length > 0 }
  get canRedo() { return this.redoStack.length > 0 }
  reset() { this.shapes = []; this.undoStack = []; this.redoStack = [] }
}