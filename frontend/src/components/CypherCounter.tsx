import { useEffect, useRef, useState } from 'react'

// Digits + uppercase letters — clean for currency/number scramble.
// Symbols removed: they look too "cyberpunk" for a retail app.
const SCRAMBLE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Chars that are shown as-is throughout the animation (not scrambled).
const PASS_THROUGH = new Set([' ', ',', '.', '-', '₹', '%', '+', '(', ')'])

/** Cubic ease-out: fast reveal at start, smooth landing at the end. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function scrambled(target: string): string {
  return target
    .split('')
    .map(ch => (PASS_THROUGH.has(ch) ? ch : SCRAMBLE[0]))
    .join('')
}

interface CypherCounterProps {
  value: number
  formatter: (val: number) => string
  className?: string
  /** Animation duration in ms. Default 1000. */
  duration?: number
}

export function CypherCounter({ value, formatter, className = '', duration = 1000 }: CypherCounterProps) {
  const target = formatter(value)
  // Start fully scrambled so the animation always plays when data arrives.
  const [display, setDisplay] = useState(() => scrambled(target))
  const rafRef   = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  // Track prev target so we only restart on real changes.
  const prevRef  = useRef<string>(target)

  useEffect(() => {
    const t = formatter(value)

    // Nothing changed — don't restart the scramble.
    if (t === prevRef.current && rafRef.current === null) {
      setDisplay(t)
      return
    }
    prevRef.current = t

    // Cancel any in-flight animation.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current  = null
      startRef.current = null
    }

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now

      const elapsed     = now - startRef.current
      const rawProgress = Math.min(elapsed / duration, 1)
      const progress    = easeOut(rawProgress)
      const revealed    = Math.floor(progress * t.length)

      let result = ''
      for (let i = 0; i < t.length; i++) {
        if (i < revealed || PASS_THROUGH.has(t[i])) {
          result += t[i]
        } else {
          result += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
        }
      }

      setDisplay(result)

      if (rawProgress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Guarantee the final value is pixel-perfect.
        setDisplay(t)
        rafRef.current  = null
        startRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current  = null
        startRef.current = null
      }
    }
    // formatter is a stable callback from useSettings — safe to include
  }, [value, formatter, duration])

  return (
    <span
      className={`block font-display font-bold tracking-tighter break-all leading-none ${className}`}
      style={{ fontSize: 'clamp(1.4rem, 4vw, 2.8rem)' }}
      aria-label={target}
    >
      {display}
    </span>
  )
}
