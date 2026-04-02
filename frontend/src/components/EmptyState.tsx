import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  ctaLabel?: string
  onCta?: () => void
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <div className="relative mb-8">
        <div className="w-24 h-24 border-2 border-line flex items-center justify-center bg-surface relative">
          <Icon className="w-10 h-10 text-ink-muted" strokeWidth={1.5} />
          <div className="absolute inset-0 border-2 border-line translate-x-2 translate-y-2 -z-10 bg-paper" />
        </div>
      </div>
      <h3 className="font-display font-bold text-2xl uppercase tracking-tighter text-ink mb-3">{title}</h3>
      {description && (
        <p className="font-mono text-sm text-ink-muted max-w-sm leading-relaxed mb-8 uppercase tracking-wider">{description}</p>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="brutal-border bg-accent text-on-accent px-8 py-3 font-mono font-bold uppercase tracking-widest text-sm brutal-shadow-accent-hover brutal-shadow-accent-active transition-all brutal-focus outline-none"
        >
          {ctaLabel}
        </button>
      )}
    </motion.div>
  )
}
