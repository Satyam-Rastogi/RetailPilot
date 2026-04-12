import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/api'
import type { AgingReportResponse } from '../types/api'
import { OverdueDeskSVG } from '../components/illustrations/HeaderIllustrations'

const fmt = (n: number) =>
  n === 0
    ? <span className="text-ink-light/40">—</span>
    : <span>₹{n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>

const bucketHeaders = [
  { key: 'current', label: 'Current' },
  { key: 'days_1_30', label: '1–30 Days' },
  { key: 'days_31_60', label: '31–60 Days' },
  { key: 'days_61_90', label: '61–90 Days' },
  { key: 'days_over_90', label: '90+ Days' },
] as const

type BucketKey = typeof bucketHeaders[number]['key']

function bucketColor(key: BucketKey): string {
  if (key === 'current') return 'text-ink'
  if (key === 'days_1_30') return 'text-warning'
  if (key === 'days_31_60') return 'text-warning'
  if (key === 'days_61_90') return 'text-danger'
  return 'text-danger font-bold'
}

export default function AgingReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const customerType = searchParams.get('type') ?? ''
  const setCustomerType = (v: string) =>
    setSearchParams(v ? { type: v } : {}, { replace: true })

  const { data, isLoading, isError, error, refetch } = useQuery<AgingReportResponse>({
    queryKey: ['aging', customerType],
    queryFn: () => reportService.getAging(customerType ? { customer_type: customerType } : undefined),
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-line pb-5 relative overflow-hidden">
        {/* Illustration — sits behind content */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none select-none">
          <OverdueDeskSVG className="w-72 h-36 text-ink opacity-35 dark:opacity-50" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">Aging Report</h1>
            <p className="text-xs font-mono text-ink-light uppercase tracking-widest mt-0.5">
              Unpaid invoices bucketed by days overdue
            </p>
          </div>
          <select
            value={customerType}
            onChange={e => setCustomerType(e.target.value)}
            className="px-3 py-2 brutal-border bg-paper text-ink font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">All Types</option>
            <option value="Retail">Retail</option>
            <option value="Wholesale">Wholesale</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider flex items-center justify-between">
          <span>{(error as any)?.response?.data?.detail || 'Failed to load aging report'}</span>
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* Summary Buckets */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {bucketHeaders.map(({ key, label }) => (
            <div key={key} className="brutal-border bg-paper p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">{label}</div>
              <div className={`font-mono font-bold text-base ${bucketColor(key)}`}>
                ₹{data.totals[key].toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
          <div className="brutal-border bg-ink text-surface p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-surface/60 mb-1">Total</div>
            <div className="font-mono font-bold text-base">
              ₹{data.totals.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="brutal-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink text-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-widest">Type</th>
              {bucketHeaders.map(({ key, label }) => (
                <th key={key} className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">{label}</th>
              ))}
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
                  Loading…
                </td>
              </tr>
            )}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
                  No outstanding invoices
                </td>
              </tr>
            )}
            {data?.rows.map((row, i) => (
              <tr key={row.customer_id} className={`border-b border-line transition-colors hover:bg-ink hover:text-surface group ${i % 2 === 0 ? 'bg-paper' : 'bg-surface'}`}>
                <td className="px-4 py-3 font-mono font-medium">{row.customer_name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border group-hover:border-surface/40 group-hover:text-surface/70 ${row.customer_type === 'Wholesale' ? 'border-accent text-accent' : 'border-line text-ink-light'}`}>
                    {row.customer_type}
                  </span>
                </td>
                {bucketHeaders.map(({ key }) => (
                  <td key={key} className={`px-4 py-3 text-right font-mono text-sm group-hover:text-surface ${bucketColor(key)}`}>
                    {fmt(row[key])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                  ₹{row.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            {data && data.rows.length > 0 && (
              <tr className="border-t-2 border-ink bg-ink/5 font-bold">
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-widest" colSpan={2}>Total</td>
                {bucketHeaders.map(({ key }) => (
                  <td key={key} className={`px-4 py-3 text-right font-mono text-sm ${bucketColor(key)}`}>
                    {fmt(data.totals[key])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                  ₹{data.totals.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
