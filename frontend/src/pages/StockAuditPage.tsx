import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowUpRight, ArrowDownRight, Search, X, RefreshCw } from 'lucide-react'
import { stockAuditService } from '../services/api'
import type { StockAuditEntry, PaginatedResponse } from '../types/api'
import Pagination from '../components/Pagination'
import { cn } from '../lib/utils'

const PAGE_SIZE = 20

type EntryType = 'sale' | 'return' | 'void' | 'edit' | 'manual'
type Direction = 'in' | 'out'

// Derive display type from reason string (mirrors backend ilike patterns)
function getEntryType(reason?: string): EntryType {
  if (!reason) return 'manual'
  const r = reason.toLowerCase()
  if (r.startsWith('sold')) return 'sale'
  if (r.startsWith('return')) return 'return'
  if (r.includes('voided')) return 'void'
  if (r.startsWith('qty') || r.startsWith('item added') || r.startsWith('item removed')) return 'edit'
  return 'manual'
}

const TYPE_META: Record<EntryType, { label: string; dot: string; dotBorder: string }> = {
  sale:   { label: 'Sale',   dot: 'bg-danger',   dotBorder: 'border-danger'         },
  return: { label: 'Return', dot: 'bg-accent',   dotBorder: 'border-accent'         },
  void:   { label: 'Void',   dot: 'bg-warning',  dotBorder: 'border-warning'        },
  edit:   { label: 'Edit',   dot: 'bg-ink',      dotBorder: 'border-surface'        },
  manual: { label: 'Manual', dot: 'bg-ink-light', dotBorder: 'border-ink-light'     },
}

const TYPE_BADGE: Record<EntryType, string> = {
  sale:   'bg-danger text-on-status border-danger',
  return: 'bg-accent text-on-accent border-accent',
  void:   'bg-warning/20 text-warning border-warning',
  edit:   'bg-surface text-ink border-ink',
  manual: 'bg-ink text-surface border-ink',
}

const ALL_TYPES: EntryType[] = ['sale', 'return', 'manual', 'edit', 'void']

function StockAuditPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive filter state from URL
  const page       = parseInt(searchParams.get('page') ?? '1')
  const itemIdFilter = searchParams.get('item_id') ? parseInt(searchParams.get('item_id')!) : undefined
  const typeFilter   = (searchParams.get('type') as EntryType) || undefined
  const dirFilter    = (searchParams.get('dir')  as Direction)  || undefined

  // Local buffer for the search input (committed on Enter / "Go")
  const [search, setSearch] = useState(searchParams.get('item_id') ?? '')

  const { data: auditLog, isLoading, isFetching } = useQuery<PaginatedResponse<StockAuditEntry>>({
    queryKey: ['stock-audit', itemIdFilter, typeFilter, dirFilter, page],
    queryFn: () => stockAuditService.list({
      page,
      page_size: PAGE_SIZE,
      item_id: itemIdFilter,
      entry_type: typeFilter,
      delta_direction: dirFilter,
    }),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k); else next.set(k, v)
      }
      return next
    })
  }

  const handleSearchCommit = () => {
    const t = search.trim()
    updateParams({ item_id: /^\d+$/.test(t) ? t : null, page: '1' })
  }

  const handleClear = () => {
    setSearch('')
    updateParams({ item_id: null, page: '1' })
  }

  const toggleType = (t: EntryType) =>
    updateParams({ type: typeFilter === t ? null : t, page: '1' })

  const toggleDir = (d: Direction) =>
    updateParams({ dir: dirFilter === d ? null : d, page: '1' })

  const setPage = (p: number) => updateParams({ page: String(p) })

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
              ? `${auditLog.total_items} entries — sales, returns & adjustments`
              : 'Full stock movement history'}
          </p>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 md:w-[380px] shrink-0">
          {/* Search + refresh */}
          <div className="flex gap-2 items-stretch">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by item ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchCommit()}
                className="w-full pl-9 pr-4 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            {search ? (
              <button onClick={handleClear} className="px-3 brutal-border hover:border-danger hover:text-danger transition-colors brutal-focus">
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSearchCommit} className="px-4 brutal-border font-mono text-xs uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
                Go
              </button>
            )}
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['stock-audit'] })}
              className={cn(
                'px-3 brutal-border transition-colors brutal-focus',
                isFetching ? 'text-accent border-accent' : 'hover:border-accent hover:text-accent'
              )}
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </div>

          {/* Direction pills — Stock In / Stock Out */}
          <div className="flex gap-1.5">
            {(['in', 'out'] as Direction[]).map(d => {
              const active = dirFilter === d
              return (
                <button
                  key={d}
                  onClick={() => toggleDir(d)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus',
                    active
                      ? d === 'in'
                        ? 'bg-ink text-surface border-ink'
                        : 'bg-danger text-on-status border-danger'
                      : 'bg-surface border-line hover:border-accent hover:text-accent'
                  )}
                >
                  {d === 'in'
                    ? <><ArrowUpRight className="w-3 h-3" /> Stock In</>
                    : <><ArrowDownRight className="w-3 h-3" /> Stock Out</>
                  }
                </button>
              )
            })}
            {/* Clear all filters */}
            {(typeFilter || dirFilter || itemIdFilter) && (
              <button
                onClick={() => { setSearch(''); updateParams({ type: null, dir: null, item_id: null, page: '1' }) }}
                className="px-3 py-1 border border-line font-mono text-[10px] uppercase tracking-widest hover:border-danger hover:text-danger transition-colors brutal-focus ml-auto"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Type pills — server-side filtered */}
          <div className="flex gap-1.5 flex-wrap">
            {ALL_TYPES.map(t => {
              const meta = TYPE_META[t]
              const active = typeFilter === t
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn(
                    'px-2.5 py-1 border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus flex items-center gap-1.5',
                    active
                      ? 'bg-ink text-surface border-ink'
                      : 'bg-surface border-line hover:border-accent hover:text-accent'
                  )}
                >
                  {/* Dot with explicit border so it's always visible */}
                  <span className={cn(
                    'inline-block w-2 h-2 border',
                    meta.dot,
                    meta.dotBorder,
                  )} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Timeline */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading audit log...</p>
        </div>
      ) : entries.length > 0 ? (
        <>
          <div className="relative">
            {/* Vertical line — center = left-3 = 12px, center of the 24px node */}
            <div className="absolute left-3 top-4 bottom-4 w-[2px] bg-gradient-to-b from-accent/80 via-ink/20 to-transparent pointer-events-none" />

            <div className="space-y-3">
              {entries.map((entry, i) => {
                const isPositive = entry.delta > 0
                const type = getEntryType(entry.reason)
                const badgeCls = TYPE_BADGE[type]
                const meta = TYPE_META[type]

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.2 }}
                    className="relative pl-12 group/entry"
                  >
                    {/* Node — on the line, vertically centered to its card */}
                    <div className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 z-10',
                      'w-6 h-6 border border-ink flex items-center justify-center',
                      'transition-transform duration-200 group-hover/entry:scale-110',
                      isPositive ? 'bg-paper' : 'bg-danger',
                    )}>
                      {isPositive
                        ? <ArrowUpRight className="w-3 h-3 text-ink" />
                        : <ArrowDownRight className="w-3 h-3 text-on-status" />
                      }
                    </div>

                    {/* Card */}
                    <div className="brutal-border bg-surface p-5 hover:bg-ink hover:text-surface transition-colors cursor-default group/card">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex items-start gap-2.5">
                          {/* Type badge */}
                          <span className={cn(
                            'shrink-0 mt-0.5 px-2 py-0.5 border font-mono text-[9px] uppercase tracking-widest flex items-center gap-1',
                            badgeCls,
                          )}>
                            <span className={cn('inline-block w-1.5 h-1.5 border', meta.dot, meta.dotBorder)} />
                            {meta.label}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display font-bold text-lg leading-tight truncate">
                              {entry.item_name || `Item #${entry.item_id}`}
                              {entry.variant_value && (
                                <span className="ml-2 font-mono text-sm font-normal text-accent">— {entry.variant_value}</span>
                              )}
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light group-hover/card:text-surface/60 mt-0.5">
                              ID {entry.item_id}{entry.variant_id ? ` · Variant #${entry.variant_id}` : ''} · {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
                            </p>
                          </div>
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
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-light group-hover/card:text-surface/60">
                            Stock After:
                          </span>
                          <span className="font-mono font-bold text-sm border border-line px-2 py-0.5 group-hover/card:border-surface/30">
                            {entry.delta_after}
                          </span>
                        </div>
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
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-2">No entries found</p>
          <p className="font-mono text-xs text-ink-light">
            {typeFilter || dirFilter
              ? 'No entries match the selected filters.'
              : 'Stock movements from sales, returns and adjustments will appear here.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default StockAuditPage
