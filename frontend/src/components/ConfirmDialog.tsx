import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  dangerous?: boolean
}

export function ConfirmDialog({
  open, title = 'ARE YOU SURE?', message,
  confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL',
  onConfirm, onCancel, dangerous = true,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) { const t = setTimeout(() => confirmRef.current?.focus(), 50); return () => clearTimeout(t) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }} onClick={onCancel}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm cursor-pointer"
          />
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="confirm-title"
            initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed z-[160] bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md"
          >
            <div className="brutal-border bg-surface border-2 border-line shadow-[8px_8px_0px_0px_var(--theme-shadow)] m-4 md:m-0">
              <div className={`flex items-center gap-3 p-5 border-b border-line ${dangerous ? 'bg-danger text-on-status' : 'bg-ink text-surface'}`}>
                {dangerous && <AlertTriangle className="w-5 h-5 shrink-0" />}
                <h2 id="confirm-title" className="font-display font-bold text-lg uppercase tracking-tighter">{title}</h2>
              </div>
              <div className="p-6">
                <p className="font-mono text-sm text-ink-light uppercase tracking-wider leading-relaxed">{message}</p>
              </div>
              <div className="flex border-t border-line">
                <button onClick={onCancel} className="flex-1 py-4 font-mono font-bold uppercase tracking-widest text-sm text-ink-light hover:bg-line transition-colors brutal-focus outline-none border-r border-line">
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef} onClick={onConfirm}
                  className={`flex-1 py-4 font-mono font-bold uppercase tracking-widest text-sm transition-colors brutal-focus outline-none ${dangerous ? 'bg-danger text-on-status hover:opacity-80' : 'bg-accent text-on-accent hover:opacity-80'}`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
