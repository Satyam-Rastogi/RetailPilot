import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/api'
import type { GstSummaryResponse } from '../types/api'
import { format, startOfMonth, subMonths } from 'date-fns'
import { DateRangePicker } from '../components/DatePicker'

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// Indian FY starts April 1
function currentFyStart(): string {
  const today = new Date()
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  return `${year}-04-01`
}

const today = format(new Date(), 'yyyy-MM-dd')

const QUICK_RANGES = [
  { label: 'This FY',    from: currentFyStart(), to: today },
  { label: 'This Month', from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: today },
  { label: 'Last 3M',   from: format(startOfMonth(subMonths(new Date(), 3)), 'yyyy-MM-dd'), to: today },
  { label: 'Last 12M',  from: format(subMonths(new Date(), 12), 'yyyy-MM-dd'), to: today },
]

export default function GstSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const fromDate = searchParams.get('from') ?? currentFyStart()
  const toDate   = searchParams.get('to')   ?? today

  const setRange = (from: string, to: string) =>
    setSearchParams({ from, to }, { replace: true })

  const { data, isLoading, isError, error, refetch } = useQuery<GstSummaryResponse>({
    queryKey: ['gst-summary', fromDate, toDate],
    queryFn: () => reportService.getGstSummary({ from_date: fromDate, to_date: toDate }),
  })

  const activeQuick = QUICK_RANGES.find(q => q.from === fromDate && q.to === toDate)

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="border-b border-line pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">GST Summary</h1>
            <p className="text-xs font-mono text-ink-light uppercase tracking-widest mt-0.5">
              Tax liability by rate slab · CGST + SGST (intrastate)
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
          <span>{(error as any)?.response?.data?.detail || 'Failed to load GST summary'}</span>
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* KPI tiles */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Taxable Value',  value: fmt(data.totals.taxable_value),  sub: 'pre-tax revenue' },
            { label: 'CGST',           value: fmt(data.totals.cgst),            sub: 'central GST' },
            { label: 'SGST',           value: fmt(data.totals.sgst),            sub: 'state GST' },
            { label: 'Total Tax',      value: fmt(data.totals.total_tax),       sub: 'CGST + SGST' },
            { label: 'Gross Billed',   value: fmt(data.totals.gross_billed),    sub: 'taxable + tax' },
          ].map(t => (
            <div key={t.label} className="brutal-border bg-paper p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">{t.label}</div>
              <div className="font-mono font-bold text-xl">{t.value}</div>
              <div className="text-[10px] font-mono text-ink-light mt-0.5">{t.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rate slab table */}
      <div className="brutal-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink text-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest">Rate Slab</th>
              <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-widest">Invoices</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Taxable Value</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">CGST</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">SGST</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Total Tax</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Gross Billed</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
                  Loading…
                </td>
              </tr>
            )}
            {data && data.slabs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
                  No invoices in this date range
                </td>
              </tr>
            )}
            {data?.slabs.map((slab, i) => (
              <tr
                key={slab.rate}
                className={`border-b border-line transition-colors hover:bg-ink hover:text-surface group ${i % 2 === 0 ? 'bg-paper' : 'bg-surface'}`}
              >
                <td className="px-4 py-3 font-mono font-bold text-xs">
                  {slab.rate === 0 ? (
                    <span className="text-ink-light">Exempt / 0%</span>
                  ) : (
                    <span className="px-2 py-0.5 border border-accent text-accent text-[10px] uppercase tracking-widest">
                      {slab.rate}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-mono text-ink-light">{slab.invoice_count}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(slab.taxable_value)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-light">{fmt(slab.cgst)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-light">{fmt(slab.sgst)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{fmt(slab.total_tax)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(slab.gross_billed)}</td>
              </tr>
            ))}

            {/* Totals row */}
            {data && data.slabs.length > 0 && (
              <tr className="border-t-2 border-ink bg-ink/5 font-bold">
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-widest">Total</td>
                <td className="px-4 py-3 text-center font-mono">{data.totals.invoice_count}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(data.totals.taxable_value)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-light">{fmt(data.totals.cgst)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-light">{fmt(data.totals.sgst)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(data.totals.total_tax)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(data.totals.gross_billed)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Period note */}
      {data && (
        <p className="text-[10px] font-mono text-ink-light uppercase tracking-widest">
          Period: {data.from_date} → {data.to_date} · CGST/SGST assumes intrastate supply (50/50 split of total GST)
        </p>
      )}
    </div>
  )
}
