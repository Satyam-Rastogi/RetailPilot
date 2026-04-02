export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastEntry {
  id: number
  type: ToastType
  message: string
}

type ToastHandler = (type: ToastType, message: string) => void

let _handler: ToastHandler | null = null

export function _setToastHandler(h: ToastHandler) {
  _handler = h
}

function emit(type: ToastType, message: string) {
  _handler?.(type, message)
}

export const toast = {
  success: (msg: string) => emit('success', msg),
  error: (msg: string) => emit('error', msg),
  warning: (msg: string) => emit('warning', msg),
  info: (msg: string) => emit('info', msg),
}
