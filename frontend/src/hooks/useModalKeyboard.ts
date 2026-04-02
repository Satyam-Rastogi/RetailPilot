import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Adds keyboard accessibility to a modal:
 *  - Escape  → calls onClose
 *  - Tab / Shift+Tab → traps focus inside containerRef
 *  - On open → auto-focuses the first focusable element
 *
 * Pass `open = false` to deactivate (e.g. when a nested modal is on top).
 */
export function useModalKeyboard(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Tab / Shift+Tab focus trap
  useEffect(() => {
    if (!open) return
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return
      const nodes = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      )
      if (!nodes.length) { e.preventDefault(); return }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onTab)
    return () => document.removeEventListener('keydown', onTab)
  }, [open, containerRef])

  // Auto-focus first focusable element when modal opens
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      el?.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [open, containerRef])
}
