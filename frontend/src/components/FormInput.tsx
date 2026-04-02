import React from 'react'
import { cn } from '@/lib/utils'

interface LabelProps {
  htmlFor: string
  children: React.ReactNode
  required?: boolean
  className?: string
}

export function FormLabel({ htmlFor, children, required, className }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-1.5', className)}>
      {children}
      {required && <span className="text-danger ml-1">*</span>}
    </label>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  id: string
}

export function FormInput({ label, error, id, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <FormLabel htmlFor={id}>{label}</FormLabel>}
      <input
        id={id}
        className={cn(
          'w-full px-3 py-2.5 border-2 border-line bg-surface text-ink font-mono text-sm',
          'focus:border-accent focus:outline-none transition-colors placeholder:text-ink-muted',
          error && 'border-danger focus:border-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-[10px] font-mono text-danger uppercase tracking-wider">{error}</span>}
    </div>
  )
}

type SearchInputProps = React.InputHTMLAttributes<HTMLInputElement> & { id: string }

export function SearchInput({ id, className, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted font-mono text-xs pointer-events-none">//</span>
      <input
        id={id}
        type="search"
        className="w-full pl-8 pr-3 py-2.5 border-2 border-line bg-surface text-ink font-mono text-sm focus:border-accent focus:outline-none transition-colors placeholder:text-ink-muted"
        {...props}
      />
    </div>
  )
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string
  error?: string
  id: string
  options: { value: string; label: string }[]
  className?: string
}

export function FormSelect({ label, error, id, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <FormLabel htmlFor={id}>{label}</FormLabel>}
      <select
        id={id}
        className={cn(
          'w-full px-3 py-2.5 border-2 border-line bg-surface text-ink font-mono text-sm appearance-none',
          'focus:border-accent focus:outline-none transition-colors cursor-pointer',
          error && 'border-danger',
          className
        )}
        {...props}
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <span className="text-[10px] font-mono text-danger uppercase tracking-wider">{error}</span>}
    </div>
  )
}
