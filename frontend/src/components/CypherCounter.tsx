import { useEffect, useRef, useState } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?'

interface CypherCounterProps {
  value: number
  formatter: (val: number) => string
  className?: string
  duration?: number
}

export function CypherCounter({ value, formatter, className = '', duration = 1400 }: CypherCounterProps) {
  const target = formatter(value)
  const [display, setDisplay] = useState(() => target.replace(/[^ ,.]/g, CHARS[0]))
  const targetRef = useRef(target)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { targetRef.current = target }, [target])

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }

    const t = targetRef.current
    const totalFrames = Math.max(1, Math.floor(duration / 40))
    let frame = 0

    intervalRef.current = setInterval(() => {
      frame += 1
      const progress = frame / totalFrames
      const revealedCount = Math.floor(progress * t.length)

      let result = ''
      for (let i = 0; i < t.length; i++) {
        if (i < revealedCount) {
          result += t[i]
        } else if ([' ', ',', '.', '-'].includes(t[i])) {
          result += t[i]
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)]
        }
      }

      setDisplay(result)

      if (frame >= totalFrames) {
        setDisplay(t)
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      }
    }, 40)

    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

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
