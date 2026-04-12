import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { customerService } from '../services/api'
import type { CustomerOutstanding } from '../types/api'
import { EmptyState } from '../components/EmptyState'
import { SkeletonListPage } from '../components/Skeleton'
import { EmptyWalletSVG } from '../components/illustrations/EmptyStateIllustrations'

type SortField = 'name' | 'outstanding' | 'overdue' | 'oldest_unpaid'
type SortDir = 'asc' | 'desc'

const inputClass = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'
const labelClass = 'block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5'

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 opacity-30">↕</span>
  return <span className="ml-1">{dir === 'desc' ? '↓' : '↑'}</span>
}

interface SortThProps {
  field: SortField
  label: string
  align?: string
  activeSortField: SortField
  activeSortDir: SortDir
  onSort: (field: SortField) => void
}

function SortTh({ field, label, align = 'right', activeSortField, activeSortDir, onSort }: SortThProps) {
  const active = activeSortField === field
  return (
    <th
      scope="col"
      onClick={() => onSort(field)}
      className={`px-4 py-3 text-${align} text-[10px] font-mono uppercase tracking-widest cursor-pointer select-none hover:text-accent transition-colors ${active ? 'text-accent' : ''}`}
    >
      {label}<SortIcon active={active} dir={activeSortDir} />
    </th>
  )
}

export default function LedgerListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const search         = searchParams.get('q')       ?? ''
  const customerType   = searchParams.get('ctype')   ?? ''
  const showZeroBalance = searchParams.get('zero')   === '1'
  const amountMode     = (searchParams.get('amt')    ?? 'any') as 'any' | 'gt' | 'lt' | 'range'
  const amountValue    = searchParams.get('amt_val') ?? ''
  const amountMin      = searchParams.get('amt_min') ?? ''
  const amountMax      = searchParams.get('amt_max') ?? ''
  const sortField      = (searchParams.get('sort')   ?? 'outstanding') as SortField
  const sortDir        = (searchParams.get('dir')    ?? 'desc') as SortDir

  const up = (updates: Record<string, string | null>) =>
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) v === null ? n.delete(k) : n.set(k, v)
      return n
    }, { replace: true })

  const setSearch         = (v: string)  => up({ q: v || null })
  const setCustomerType   = (v: string)  => up({ ctype: v || null })
  const setShowZeroBalance = (v: boolean) => up({ zero: v ? '1' : null })
  const setAmountMode     = (v: typeof amountMode) => up({ amt: v !== 'any' ? v : null, amt_val: null, amt_min: null, amt_max: null })
  const setAmountValue    = (v: string)  => up({ amt_val: v || null })
  const setAmountMin      = (v: string)  => up({ amt_min: v || null })
  const setAmountMax      = (v: string)  => up({ amt_max: v || null })

  const { data: customers, isLoading, error, refetch } = useQuery<CustomerOutstanding[]>({
    queryKey: ['customersOutstanding', showZeroBalance, customerType],
    queryFn: () => customerService.getOutstanding({
      include_zero_balance: showZeroBalance,
      customer_type: customerType || undefined,
    }),
  })

  function handleSort(field: SortField) {
    if (sortField === field) {
      up({ dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      up({ sort: field, dir: 'desc' })
    }
  }

  const filtered = useMemo(() => {
    if (!customers) return []
    let rows = customers

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(c => c.name.toLowerCase().includes(q))
    }

    if (amountMode === 'gt' && amountValue !== '') {
      const v = parseFloat(amountValue)
      if (!isNaN(v)) rows = rows.filter(c => c.total_outstanding > v)
    } else if (amountMode === 'lt' && amountValue !== '') {
      const v = parseFloat(amountValue)
      if (!isNaN(v)) rows = rows.filter(c => c.total_outstanding < v)
    } else if (amountMode === 'range') {
      const mn = parseFloat(amountMin)
      const mx = parseFloat(amountMax)
      if (!isNaN(mn)) rows = rows.filter(c => c.total_outstanding >= mn)
      if (!isNaN(mx)) rows = rows.filter(c => c.total_outstanding <= mx)
    }

    return rows
  }, [customers, search, amountMode, amountValue, amountMin, amountMax])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'outstanding') cmp = a.total_outstanding - b.total_outstanding
      else if (sortField === 'overdue') cmp = a.overdue_amount - b.overdue_amount
      else if (sortField === 'oldest_unpaid') {
        const dateA = a.oldest_unpaid_date ? new Date(a.oldest_unpaid_date).getTime() : Infinity
        const dateB = b.oldest_unpaid_date ? new Date(b.oldest_unpaid_date).getTime() : Infinity
        cmp = dateA - dateB
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return arr
  }, [filtered, sortField, sortDir])

  const summary = useMemo(() => ({
    count: sorted.length,
    totalOutstanding: sorted.reduce((s, c) => s + c.total_outstanding, 0),
    totalOverdue: sorted.reduce((s, c) => s + c.overdue_amount, 0),
    overdueCustomers: sorted.filter(c => c.overdue_amount > 0).length,
  }), [sorted])

  const hasFilters = search || customerType || amountMode !== 'any'

  function handleClear() {
    up({ q: null, ctype: null, amt: null, amt_val: null, amt_min: null, amt_max: null })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate('/customers')}
            aria-label="Back to Customers"
            className="font-mono text-xs uppercase tracking-widest text-ink-light hover:text-accent transition-colors mb-3 block"
          >
            &larr; Back to Customers
          </button>
          <h1 className="type-heading">Receivables</h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">
            Outstanding balances &amp; overdue invoices
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="brutal-border bg-surface p-5 mb-6" role="search" aria-label="Receivables filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Customer Search */}
          <div className="sm:col-span-2">
            <label htmlFor="ledger-search" className={labelClass}>Search Customer</label>
            <input
              id="ledger-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer name…"
              className={inputClass}
            />
          </div>

          {/* Customer Type */}
          <div>
            <label htmlFor="customer-type" className={labelClass}>Customer Type</label>
            <select
              id="customer-type"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className={inputClass}
            >
              <option value="">All Types</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
            </select>
          </div>

          {/* Zero Balance Toggle */}
          <div className="flex flex-col justify-end">
            <label className={labelClass}>&nbsp;</label>
            <button
              onClick={() => setShowZeroBalance(!showZeroBalance)}
              className={`w-full px-3 py-2.5 brutal-border font-mono text-xs uppercase tracking-widest transition-colors brutal-focus ${showZeroBalance ? 'bg-accent text-on-accent border-accent' : 'hover:border-accent hover:text-accent'}`}
              aria-pressed={showZeroBalance}
            >
              {showZeroBalance ? 'Hide Settled' : 'Show Settled'}
            </button>
          </div>
        </div>

        {/* Amount Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="amount-mode" className={labelClass}>Outstanding Amount</label>
            <select
              id="amount-mode"
              value={amountMode}
              onChange={(e) => setAmountMode(e.target.value as typeof amountMode)}
              className={inputClass}
            >
              <option value="any">Any amount</option>
              <option value="gt">Greater than</option>
              <option value="lt">Less than</option>
              <option value="range">Range</option>
            </select>
          </div>

          {amountMode === 'gt' || amountMode === 'lt' ? (
            <div>
              <label htmlFor="amount-value" className={labelClass}>
                {amountMode === 'gt' ? 'Greater than (₹)' : 'Less than (₹)'}
              </label>
              <input
                id="amount-value"
                type="number"
                min="0"
                step="0.01"
                value={amountValue}
                onChange={(e) => setAmountValue(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          ) : amountMode === 'range' ? (
            <>
              <div>
                <label htmlFor="amount-min" className={labelClass}>Min (₹)</label>
                <input
                  id="amount-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="amount-max" className={labelClass}>Max (₹)</label>
                <input
                  id="amount-max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            </>
          ) : null}

          <div className={amountMode === 'range' ? 'sm:col-span-2 lg:col-span-1' : ''}>
            <label className={labelClass}>&nbsp;</label>
            <button
              onClick={handleClear}
              disabled={!hasFilters}
              className="w-full px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonListPage rows={6} />
      ) : error ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-danger mb-2">Error Loading Receivables</p>
          <p className="font-mono text-xs text-ink-light mb-6">
            {(error as Error).message || 'Failed to load receivables data'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            Retry
          </button>
        </div>
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          illustration={<EmptyWalletSVG />}
          title={showZeroBalance ? 'No Customers Found' : 'No Outstanding Balances'}
          description={showZeroBalance
            ? 'No customers match the current filters'
            : 'All customers are settled — the books are clear'}
          ctaLabel={!showZeroBalance ? 'Show All Customers' : undefined}
          onCta={!showZeroBalance ? () => setShowZeroBalance(true) : undefined}
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="brutal-border bg-surface mb-6" aria-label="Receivables summary">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-line">
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Customers</div>
                <div className="font-display font-bold text-2xl text-ink">{summary.count}</div>
              </div>
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Outstanding</div>
                <div className="font-mono font-bold text-xl text-warning">
                  ₹{summary.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Overdue</div>
                <div className={`font-mono font-bold text-xl ${summary.totalOverdue > 0 ? 'text-danger' : 'text-ink-light'}`}>
                  ₹{summary.totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Overdue Customers</div>
                <div className={`font-display font-bold text-2xl ${summary.overdueCustomers > 0 ? 'text-danger' : 'text-ink-light'}`}>
                  {summary.overdueCustomers}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="brutal-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest">Outstanding Receivables</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">
                {sorted.length} {sorted.length !== (customers?.length ?? 0) ? `of ${customers?.length}` : ''} customers
              </span>
            </div>

            {sorted.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-mono text-sm uppercase tracking-widest text-ink-light">No customers match your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full" aria-label="Customer outstanding receivables">
                  <thead>
                    <tr className="bg-surface text-ink-light">
                      <SortTh field="name" label="Customer" align="left" activeSortField={sortField} activeSortDir={sortDir} onSort={handleSort} />
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Type</th>
                      <SortTh field="outstanding" label="Outstanding" activeSortField={sortField} activeSortDir={sortDir} onSort={handleSort} />
                      <SortTh field="overdue" label="Overdue" activeSortField={sortField} activeSortDir={sortDir} onSort={handleSort} />
                      <th scope="col" className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Invoices</th>
                      <SortTh field="oldest_unpaid" label="Oldest Unpaid" activeSortField={sortField} activeSortDir={sortDir} onSort={handleSort} />
                      <th scope="col" className="px-4 py-3 text-center text-[10px] font-mono uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sorted.map((customer) => {
                      const isOverdue = customer.overdue_amount > 0
                      const hasBalance = customer.total_outstanding > 0
                      return (
                        <tr
                          key={customer.id}
                          className="hover:bg-paper transition-colors cursor-pointer"
                          onClick={() => navigate(`/customers/${customer.id}/ledger`)}
                          aria-label={`View ledger for ${customer.name}`}
                        >
                          <td className="px-4 py-3 font-mono text-sm font-bold text-ink">
                            {customer.name}
                            {isOverdue && (
                              <span className="ml-2 px-1.5 py-0.5 bg-danger text-on-accent font-mono text-[9px] uppercase tracking-widest">
                                Overdue
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 brutal-border font-mono text-[10px] uppercase tracking-widest text-ink-light">
                              {customer.customer_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                            <span className={hasBalance ? 'text-warning' : 'text-ink-light'}>
                              ₹{customer.total_outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                            <span className={isOverdue ? 'text-danger' : 'text-ink-light'}>
                              {isOverdue
                                ? `₹${customer.overdue_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-ink-light">
                            {customer.unpaid_invoice_count > 0
                              ? `${customer.unpaid_invoice_count} unpaid`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-light">
                            {customer.oldest_unpaid_date ? daysAgo(customer.oldest_unpaid_date) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/customers/${customer.id}/ledger`) }}
                              className="px-4 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
                            >
                              View Ledger
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
