import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { wholesaleLedgerService } from '../services/api'

export interface WholesaleLedgerSummary {
  customer_id: number
  customer_name: string
  customer_type: string
  total_invoiced: number
  total_paid: number
  total_unpaid: number
  last_activity: string | null
  invoice_count: number
  payment_count: number
}

const inputClass = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'
const labelClass = 'block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5'

export default function LedgerListPage() {
  const navigate = useNavigate()

  // Date filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Customer name search (client-side)
  const [search, setSearch] = useState('')

  // Amount filter
  const [amountMode, setAmountMode] = useState<'any' | 'gt' | 'lt' | 'range'>('any')
  const [amountValue, setAmountValue] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')

  const { data: ledgers, isLoading, error } = useQuery<WholesaleLedgerSummary[]>({
    queryKey: ['wholesaleLedgers', dateFrom, dateTo],
    queryFn: () => wholesaleLedgerService.getWholesaleLedgers(dateFrom || undefined, dateTo || undefined),
  })

  const filtered = useMemo(() => {
    if (!ledgers) return []
    let rows = ledgers

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(l => l.customer_name.toLowerCase().includes(q))
    }

    if (amountMode === 'gt' && amountValue !== '') {
      const v = parseFloat(amountValue)
      if (!isNaN(v)) rows = rows.filter(l => l.total_unpaid > v)
    } else if (amountMode === 'lt' && amountValue !== '') {
      const v = parseFloat(amountValue)
      if (!isNaN(v)) rows = rows.filter(l => l.total_unpaid < v)
    } else if (amountMode === 'range') {
      const mn = parseFloat(amountMin)
      const mx = parseFloat(amountMax)
      if (!isNaN(mn)) rows = rows.filter(l => l.total_unpaid >= mn)
      if (!isNaN(mx)) rows = rows.filter(l => l.total_unpaid <= mx)
    }

    return rows
  }, [ledgers, search, amountMode, amountValue, amountMin, amountMax])

  const summary = useMemo(() => ({
    count: filtered.length,
    invoiced: filtered.reduce((s, l) => s + l.total_invoiced, 0),
    paid: filtered.reduce((s, l) => s + l.total_paid, 0),
    unpaid: filtered.reduce((s, l) => s + l.total_unpaid, 0),
  }), [filtered])

  const handleClear = () => {
    setDateFrom(''); setDateTo('')
    setSearch('')
    setAmountMode('any'); setAmountValue(''); setAmountMin(''); setAmountMax('')
  }

  const hasFilters = dateFrom || dateTo || search || amountMode !== 'any'

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
          <h1 className="type-heading">Ledgers</h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">
            Wholesale customer balances &amp; activity
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="brutal-border bg-surface p-5 mb-6" role="search" aria-label="Ledger filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Customer Search */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="ledger-search" className={labelClass}>Search Customer</label>
            <input
              id="ledger-search"
              name="ledger-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer name…"
              className={inputClass}
              aria-label="Search customers by name"
            />
          </div>

          {/* Date From */}
          <div>
            <label htmlFor="date-from" className={labelClass}>Date From</label>
            <input
              id="date-from"
              name="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputClass}
              aria-label="Filter from date"
            />
          </div>

          {/* Date To */}
          <div>
            <label htmlFor="date-to" className={labelClass}>Date To</label>
            <input
              id="date-to"
              name="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputClass}
              aria-label="Filter to date"
            />
          </div>
        </div>

        {/* Amount Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="amount-mode" className={labelClass}>Unpaid Amount</label>
            <select
              id="amount-mode"
              name="amount-mode"
              value={amountMode}
              onChange={(e) => setAmountMode(e.target.value as typeof amountMode)}
              className={inputClass}
              aria-label="Amount filter type"
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
                name="amount-value"
                type="number"
                min="0"
                step="0.01"
                value={amountValue}
                onChange={(e) => setAmountValue(e.target.value)}
                placeholder="0.00"
                className={inputClass}
                aria-label={amountMode === 'gt' ? 'Minimum unpaid amount' : 'Maximum unpaid amount'}
              />
            </div>
          ) : amountMode === 'range' ? (
            <>
              <div>
                <label htmlFor="amount-min" className={labelClass}>Min (₹)</label>
                <input
                  id="amount-min"
                  name="amount-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                  aria-label="Minimum unpaid amount"
                />
              </div>
              <div>
                <label htmlFor="amount-max" className={labelClass}>Max (₹)</label>
                <input
                  id="amount-max"
                  name="amount-max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                  aria-label="Maximum unpaid amount"
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
              aria-label="Clear all filters"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading ledgers...</p>
        </div>
      ) : error ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-danger mb-2">Error Loading Ledgers</p>
          <p className="font-mono text-xs text-ink-light mb-6">
            {(error as Error).message || 'Failed to load ledger data'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            Retry
          </button>
        </div>
      ) : !ledgers || ledgers.length === 0 ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-2">No Wholesale Ledgers Found</p>
          <p className="font-mono text-xs text-ink-light mb-6">
            No wholesale customers available. Please create a customer first.
          </p>
          <button
            onClick={() => navigate('/customers')}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            Go to Customers
          </button>
        </div>
      ) : (
        <>
          {/* Summary Stats — below filters, above table */}
          <div className="brutal-border bg-surface mb-6" aria-label="Ledger summary statistics">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-line">
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Customers</div>
                <div className="font-display font-bold text-2xl text-ink">{summary.count}</div>
              </div>
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Invoiced</div>
                <div className="font-mono font-bold text-xl text-ink">
                  {summary.invoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Paid</div>
                <div className="font-mono font-bold text-xl text-success">
                  {summary.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Unpaid</div>
                <div className="font-mono font-bold text-xl text-danger">
                  {summary.unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="brutal-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest">Wholesale Ledger Summary</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">
                {filtered.length} {filtered.length !== (ledgers?.length ?? 0) ? `of ${ledgers?.length}` : ''} customers
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-mono text-sm uppercase tracking-widest text-ink-light">No customers match your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full" aria-label="Wholesale customer ledger">
                  <thead>
                    <tr className="bg-surface text-ink-light">
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Customer</th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Type</th>
                      <th scope="col" className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Total Invoiced</th>
                      <th scope="col" className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Total Paid</th>
                      <th scope="col" className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Total Unpaid</th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Last Activity</th>
                      <th scope="col" className="px-4 py-3 text-center text-[10px] font-mono uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((ledger) => (
                      <tr
                        key={ledger.customer_id}
                        className="hover:bg-paper transition-colors cursor-pointer"
                        onClick={() => navigate(`/customers/${ledger.customer_id}/ledger`)}
                        aria-label={`View ledger for ${ledger.customer_name}`}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-bold text-ink">
                          {ledger.customer_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 brutal-border font-mono text-[10px] uppercase tracking-widest text-ink-light">
                            {ledger.customer_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-ink">
                          {ledger.total_invoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-success font-mono font-bold text-sm">
                            {ledger.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={ledger.total_unpaid > 0 ? 'text-danger font-mono font-bold text-sm' : 'text-success font-mono font-bold text-sm'}>
                            {ledger.total_unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-ink-light">
                          {ledger.last_activity ? new Date(ledger.last_activity).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/customers/${ledger.customer_id}/ledger`) }}
                            className="px-4 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
                            aria-label={`View ledger for ${ledger.customer_name}`}
                          >
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    ))}
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
