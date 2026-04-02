import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { _setToastHandler, type ToastEntry, type ToastType } from '../lib/toast'
import { cn } from '../lib/utils'

const AUTO_DISMISS_MS = 10000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    _setToastHandler((type: ToastType, message: string) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, type, message }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, AUTO_DISMISS_MS)
    })
  }, [])

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <>
      {children}

      {/* Stacked toast container — bottom right */}
      <div className="fixed bottom-0 right-0 p-4 md:p-6 z-[500] flex flex-col items-end pointer-events-none w-full max-w-sm">
        <div
          className="relative w-full pointer-events-auto"
          style={{ minHeight: toasts.length > 0 ? '72px' : '0' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <AnimatePresence>
            {toasts.map((t, i) => {
              const fromBottom = toasts.length - 1 - i // 0 = newest on top
              const stackOffsetY = hovered ? 0 : fromBottom * -8
              const stackScale = hovered ? 1 : 1 - fromBottom * 0.035
              const stackOpacity = hovered ? 1 : fromBottom > 2 ? 0 : 1 - fromBottom * 0.25
              const expandedY = hovered ? -(toasts.length - 1 - i) * 76 : 0

              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.95 }}
                  animate={{
                    opacity: stackOpacity,
                    y: hovered ? expandedY : stackOffsetY,
                    scale: stackScale,
                    zIndex: i + 1,
                  }}
                  exit={{ opacity: 0, scale: 0.92, y: 16, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  style={{
                    position: hovered ? 'relative' : 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '100%',
                    zIndex: i + 1,
                  }}
                  className={cn(
                    'flex items-start justify-between p-4 border-2 bg-surface text-ink',
                    'shadow-[6px_6px_0px_0px_rgba(0,0,0,0.25)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.08)]',
                    t.type === 'success' && 'border-success',
                    t.type === 'error'   && 'border-danger',
                    t.type === 'warning' && 'border-warning',
                    t.type === 'info'    && 'border-accent',
                  )}
                >
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-success" />}
                      {t.type === 'error'   && <AlertTriangle className="w-5 h-5 text-danger" />}
                      {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-warning" />}
                      {t.type === 'info'    && <Info className="w-5 h-5 text-accent" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={cn(
                        'font-display font-bold uppercase tracking-tighter text-sm leading-none',
                        t.type === 'success' && 'text-success',
                        t.type === 'error'   && 'text-danger',
                        t.type === 'warning' && 'text-warning',
                        t.type === 'info'    && 'text-accent',
                      )}>
                        {t.type}
                      </span>
                      <span className="font-mono text-xs opacity-70 mt-1 truncate">{t.message}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="ml-3 shrink-0 opacity-40 hover:opacity-100 transition-opacity outline-none brutal-focus"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Count badge — only when collapsed with multiple toasts */}
          {!hovered && toasts.length > 1 && (
            <div className="absolute -top-2 -left-2 z-[99] bg-ink text-surface font-mono font-bold text-[10px] px-2 py-0.5 border border-surface pointer-events-none">
              {toasts.length} ALERTS
            </div>
          )}
        </div>
      </div>
    </>
  )
}
