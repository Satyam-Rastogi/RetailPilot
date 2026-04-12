import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/api'
import type { PnLResponse } from '../types/api'
import { format, startOfMonth, subMonths } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { DateRangePicker } from '../components/DatePicker'

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const pct = (n: number) => `${n.toFixed(1)}%`

// Indian FY starts April 1
function currentFyStart(): string {
  const today = new Date()
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  return `${year}-04-01`
}

const today = format(new Date(), 'yyyy-MM-dd')

const QUICK_RANGES = [
  { label: 'This FY',   from: currentFyStart(), to: today },
  { label: 'Last 6M',  from: format(startOfMonth(subMonths(new Date(), 6)), 'yyyy-MM-dd'), to: today },
  { label: 'Last 12M', from: format(subMonths(new Date(), 12), 'yyyy-MM-dd'), to: today },
]

function marginColor(pct: number): string {
  if (pct >= 30) return 'text-green-600 dark:text-green-400'
  if (pct >= 15) return 'text-warning'
  if (pct > 0)   return 'text-danger'
  return 'text-danger font-bold'
}

export default function PnLPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const fromDate = searchParams.get('from') ?? currentFyStart()
  const toDate   = searchParams.get('to')   ?? today

  const setRange = (from: string, to: string) =>
    setSearchParams({ from, to }, { replace: true })

  const { data, isLoading, isError, error, refetch } = useQuery<PnLResponse>({
    queryKey: ['pnl', fromDate, toDate],
    queryFn: () => reportService.getPnl({ from_date: fromDate, to_date: toDate }),
  })

  const activeQuick = QUICK_RANGES.find(q => q.from === fromDate && q.to === toDate)

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="border-b border-line pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">P&amp;L Statement</h1>
            <p className="text-xs font-mono text-ink-light uppercase tracking-widest mt-0.5">
              Gross profit · Revenue − estimated COGS
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {QUICK_RANGES.map(q => (
              <button
                key={q.label}
                onClick={() => setRange(q.from, q.to)}
                className={`px-3 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus ${
                  activeQuick?.label === q.label ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface'
                }`}
              >
                {q.label}
              </button>
            ))}
            <DateRangePicker
              from={fromDate} to={toDate} max={today}
              onChange={r => setRange(r.from, r.to)}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider flex items-center justify-between">
          <span>{(error as any)?.response?.data?.detail || 'Failed to load P&L statement'}</span>
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* COGS incomplete warning */}
      {data && data.summary.items_without_cost > 0 && (
        <div className="px-4 py-3 border border-warning text-warning font-mono text-xs uppercase tracking-wider flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {data.summary.items_without_cost} line item{data.summary.items_without_cost !== 1 ? 's' : ''} had no purchase price — COGS is understated.
            Set purchase prices on your items for accurate gross profit.
          </span>
        </div>
      )}

      {/* KPI tiles */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="brutal-border bg-paper p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Revenue</div>
            <div className="font-mono font-bold text-xl">{fmt(data.summary.revenue)}</div>
            <div className="text-[10px] font-mono text-ink-light mt-0.5">gross billed</div>
          </div>
          <div className="brutal-border bg-paper p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Est. COGS</div>
            <div className="font-mono font-bold text-xl">{fmt(data.summary.cogs)}</div>
            <div className="text-[10px] font-mono text-ink-light mt-0.5">cost of goods sold</div>
          </div>
          <div className="brutal-border bg-paper p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Gross Profit</div>
            <div className={`font-mono font-bold text-xl ${data.summary.gross_profit >= 0 ? '' : 'text-danger'}`}>
              {fmt(data.summary.gross_profit)}
            </div>
            <div className="text-[10px] font-mono text-ink-light mt-0.5">revenue − COGS</div>
          </div>
          <div className="brutal-border bg-ink text-surface p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-surface/60 mb-1">Gross Margin</div>
            <div className="font-mono font-bold text-xl">{pct(data.summary.gross_margin_pct)}</div>
            <div className="text-[10px] font-mono text-surface/60 mt-0.5">profit / revenue</div>
          </div>
        </div>
      )}

      {/* Monthly breakdown table */}
      <div className="brutal-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink text-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest">Month</th>
              <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-widest">Invoices</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Revenue</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Est. COGS</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Gross Profit</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Margin</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
                  Loading…
                </td>
              </tr>
            )}
            {data && data.months.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
                  No invoices in this date range
                </td>
              </tr>
            )}
            {data?.months.map((row, i) => (
              <tr
                key={row.month}
                className={`border-b border-line transition-colors hover:bg-ink hover:text-surface group ${i % 2 === 0 ? 'bg-paper' : 'bg-surface'}`}
              >
                <td className="px-4 py-3 font-mono font-medium">{row.month_label}</td>
                <td className="px-4 py-3 text-center font-mono text-ink-light group-hover:text-surface/70">{row.invoice_count}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(row.revenue)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-light group-hover:text-surface/70">{fmt(row.cogs)}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold group-hover:text-surface ${row.gross_profit < 0 ? 'text-danger' : ''}`}>
                  {fmt(row.gross_profit)}
                </td>
                <td className={`px-4 py-3 text-right font-mono text-sm group-hover:text-surface ${marginColor(row.gross_margin_pct)}`}>
                  {pct(row.gross_margin_pct)}
                </td>
              </tr>
            ))}

            {/* Totals row */}
            {data && data.months.length > 1 && (
              <tr className="border-t-2 border-ink bg-ink/5 font-bold">
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-widest" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(data.summary.revenue)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-light">{fmt(data.summary.cogs)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(data.summary.gross_profit)}</td>
                <td className={`px-4 py-3 text-right font-mono ${marginColor(data.summary.gross_margin_pct)}`}>
                  {pct(data.summary.gross_margin_pct)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <p className="text-[10px] font-mono text-ink-light uppercase tracking-widest">
          Period: {data.from_date} → {data.to_date} · COGS based on item purchase prices · expenses not included
        </p>
      )}
    </div>
  )
}
