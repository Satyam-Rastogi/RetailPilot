import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const getPages = (): (number | '...')[] => {
    const pages: (number | '...')[] = []
    const range = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1].filter(p => p >= 1 && p <= totalPages))
    const sorted = Array.from(range).sort((a, b) => a - b)

    for (let i = 0; i < sorted.length; i++) {
      pages.push(sorted[i])
      if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) pages.push('...')
    }
    return pages
  }

  return (
    <div className={cn('flex items-center justify-between px-4 pt-4 pb-3 border-t border-line mt-4', className)}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted hidden sm:block">
        {startItem}–{endItem} of {totalItems}
      </span>
      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted sm:hidden">
        {currentPage} / {totalPages}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 border border-line hover:border-accent hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed brutal-focus outline-none hidden sm:flex"
          aria-label="First page"
        >
          <ChevronLeft className="w-3 h-3" />
          <ChevronLeft className="w-3 h-3 -ml-1.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 border border-line hover:border-accent hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed brutal-focus outline-none"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-ink-muted font-mono text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={cn(
                'min-w-[2rem] h-8 px-2 font-mono text-sm font-bold border transition-colors brutal-focus outline-none',
                p === currentPage
                  ? 'bg-ink text-surface border-ink'
                  : 'border-line hover:border-accent hover:text-accent'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 border border-line hover:border-accent hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed brutal-focus outline-none"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 border border-line hover:border-accent hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed brutal-focus outline-none hidden sm:flex"
          aria-label="Last page"
        >
          <ChevronRight className="w-3 h-3" />
          <ChevronRight className="w-3 h-3 -ml-1.5" />
        </button>
      </div>
    </div>
  )
}
