import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowUpRight, ArrowDownRight, Search, X } from 'lucide-react'
import { stockAuditService } from '../services/api'
import type { StockAuditEntry, PaginatedResponse } from '../types/api'
import Pagination from '../components/Pagination'
import { cn } from '../lib/utils'

const PAGE_SIZE = 20

function StockAuditPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [itemIdFilter, setItemIdFilter] = useState('')

  useEffect(() => { setPage(1) }, [itemIdFilter])

  // Debounce search → item name filter isn't supported by backend, so we filter by item_id
  // Search accepts either item name (client-side) or item ID
  const { data: auditLog, isLoading } = useQuery<PaginatedResponse<StockAuditEntry>>({
    queryKey: ['stock-audit', itemIdFilter, page],
    queryFn: () => stockAuditService.list({
      page,
      page_size: PAGE_SIZE,
      item_id: itemIdFilter ? parseInt(itemIdFilter) : undefined,
    }),
  })

  const handleSearchCommit = () => {
    const trimmed = search.trim()
    if (/^\d+$/.test(trimmed)) {
      setItemIdFilter(trimmed)
    } else {
      setItemIdFilter('')
    }
  }

  const handleClear = () => {
    setSearch('')
    setItemIdFilter('')
  }

  const entries = auditLog?.data ?? []

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-display font-bold tracking-tighter uppercase leading-none"
          >
            Stock
            <br />
            Audit
          </motion.h1>
          <p className="font-mono text-sm text-ink-light mt-3 uppercase tracking-widest">
            {auditLog
              ? `${auditLog.total_items} entries — full stock movement history`
              : 'History of all stock adjustments'}
          </p>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </div>

        {/* Search */}
        <div className="flex gap-2 items-stretch md:w-[320px] shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by item ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchCommit()}
              className="w-full pl-9 pr-4 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          {search ? (
            <button
              onClick={handleClear}
              className="px-3 brutal-border hover:border-danger hover:text-danger transition-colors brutal-focus"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSearchCommit}
              className="px-4 brutal-border font-mono text-xs uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
            >
              Go
            </button>
          )}
        </div>
      </header>

      {/* Timeline */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading audit log...</p>
        </div>
      ) : entries.length > 0 ? (
        <>
          <div className="relative pt-6 pb-12">
            {/* Vertical gradient line */}
            <div className="absolute left-[27px] top-10 bottom-0 w-[2px] bg-gradient-to-b from-accent/80 via-ink/20 to-transparent z-0 pointer-events-none" />

            <div className="space-y-4">
              {entries.map((entry, i) => {
                const isPositive = entry.delta > 0
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className="relative flex gap-5 group/entry"
                  >
                    {/* Node */}
                    <div className={cn(
                      'relative z-10 w-6 h-6 shrink-0 border border-ink flex items-center justify-center transition-transform duration-200 group-hover/entry:scale-110',
                      isPositive ? 'bg-paper' : 'bg-danger',
                    )}>
                      {isPositive
                        ? <ArrowUpRight className="w-3 h-3 text-ink" />
                        : <ArrowDownRight className="w-3 h-3 text-on-status" />
                      }
                    </div>

                    {/* Card — uses its own group/card so hover effects only fire when hovering the card itself */}
                    <div className="flex-1 brutal-border bg-surface p-6 hover:bg-ink hover:text-surface transition-colors cursor-default min-w-0 group/card">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-display font-bold text-lg leading-tight truncate">
                            {entry.item_name || `Item #${entry.item_id}`}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light group-hover/card:text-surface/60 mt-0.5">
                            ID {entry.item_id} · {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>

                        {/* Delta badge */}
                        <div className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 border font-mono text-sm font-bold shrink-0 self-start',
                          isPositive
                            ? 'border-ink bg-paper text-ink group-hover/card:border-surface/40 group-hover/card:bg-surface/10 group-hover/card:text-surface'
                            : 'border-danger bg-danger text-on-status group-hover/card:border-surface/40 group-hover/card:bg-surface/20 group-hover/card:text-surface',
                        )}>
                          {isPositive
                            ? <ArrowUpRight className="w-3.5 h-3.5" />
                            : <ArrowDownRight className="w-3.5 h-3.5" />
                          }
                          {isPositive ? '+' : ''}{entry.delta}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        {/* Stock after */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-light group-hover/card:text-surface/60">
                            Stock After:
                          </span>
                          <span className="font-mono font-bold text-sm border border-line px-2 py-0.5 group-hover/card:border-surface/30">
                            {entry.delta_after}
                          </span>
                        </div>

                        {/* Reason */}
                        {entry.reason && (
                          <span className="font-mono text-sm text-ink-light group-hover/card:text-surface/70 truncate">
                            {entry.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {auditLog && auditLog.total_pages > 1 && (
            <Pagination
              currentPage={auditLog.current_page}
              totalPages={auditLog.total_pages}
              totalItems={auditLog.total_items}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      ) : (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-2">No audit entries found</p>
          <p className="font-mono text-xs text-ink-light">Stock changes will appear here once adjustments are made</p>
        </div>
      )}
    </div>
  )
}

export default StockAuditPage
