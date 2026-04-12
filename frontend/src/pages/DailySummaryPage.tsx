import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/api'
import type { DailySummaryResponse } from '../types/api'
import { format, subDays } from 'date-fns'
import { ReceiptPrinterSVG } from '../components/illustrations/HeaderIllustrations'
import { DatePicker } from '../components/DatePicker'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  unspecified: 'Unspecified',
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="brutal-border bg-paper p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">{label}</div>
      <div className="font-mono font-bold text-xl">{value}</div>
      {sub && <div className="text-[10px] font-mono text-ink-light mt-0.5">{sub}</div>}
    </div>
  )
}

export default function DailySummaryPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [searchParams, setSearchParams] = useSearchParams()
  const date = searchParams.get('date') ?? today
  const setDate = (d: string) => setSearchParams({ date: d }, { replace: true })

  const { data, isLoading, isError, error, refetch } = useQuery<DailySummaryResponse>({
    queryKey: ['dailySummary', date],
    queryFn: () => reportService.getDailySummary(date),
  })

  const quickDates = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: '2 days ago', value: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-line pb-5 relative overflow-hidden">
        {/* Illustration — sits behind content */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none select-none">
          <ReceiptPrinterSVG className="w-72 h-36 text-ink opacity-35 dark:opacity-50" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">Daily Summary</h1>
            <p className="text-xs font-mono text-ink-light uppercase tracking-widest mt-0.5">
              Sales and collections by payment method
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {quickDates.map(q => (
              <button key={q.value} onClick={() => setDate(q.value)}
                className={`px-3 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus ${
                  date === q.value ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface'
                }`}>
                {q.label}
              </button>
            ))}
            <DatePicker value={date} onChange={setDate} max={today} />
          </div>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider flex items-center justify-between">
          <span>{(error as any)?.response?.data?.detail || 'Failed to load summary'}</span>
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* KPI tiles */}
      {isLoading && (
        <div className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-12">Loading…</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiTile
              label="Invoices Created"
              value={String(data.invoice_count)}
              sub="sales for the day"
            />
            <KpiTile
              label="Total Sales"
              value={`₹${data.total_sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              sub="invoice grand totals"
            />
            <KpiTile
              label="Payments Received"
              value={String(data.payment_count)}
              sub="cash + UPI + card + cheque"
            />
            <KpiTile
              label="Total Collected"
              value={`₹${data.total_collected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              sub="actual money received"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Collections by payment method */}
            <div className="brutal-border overflow-hidden">
              <div className="bg-ink text-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest font-bold">
                Collections by Payment Method
              </div>
              {data.by_payment_method.length === 0 ? (
                <p className="px-4 py-6 text-center font-mono text-xs text-ink-light uppercase tracking-widest">No payments recorded</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light">Method</th>
                      <th className="px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink-light">Count</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Amount</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_payment_method.map(row => (
                      <tr key={row.method} className="border-b border-line last:border-0 hover:bg-surface transition-colors">
                        <td className="px-4 py-3 font-mono font-medium uppercase text-xs tracking-wider">
                          {METHOD_LABELS[row.method] ?? row.method}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-ink-light">{row.count}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          ₹{row.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-light text-xs">
                          {data.total_collected > 0 ? `${Math.round((row.total / data.total_collected) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {data.by_payment_method.length > 1 && (
                      <tr className="border-t-2 border-ink bg-ink/5 font-bold">
                        <td className="px-4 py-3 font-mono text-xs uppercase tracking-widest">Total</td>
                        <td className="px-4 py-3 text-center font-mono">{data.payment_count}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{data.total_collected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-light text-xs">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sales by customer type */}
            <div className="brutal-border overflow-hidden">
              <div className="bg-ink text-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest font-bold">
                Sales by Customer Type
              </div>
              {data.by_customer_type.length === 0 ? (
                <p className="px-4 py-6 text-center font-mono text-xs text-ink-light uppercase tracking-widest">No invoices for this day</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light">Type</th>
                      <th className="px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink-light">Invoices</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Total Sales</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_customer_type.map(row => (
                      <tr key={row.customer_type} className="border-b border-line last:border-0 hover:bg-surface transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border ${
                            row.customer_type === 'Wholesale' ? 'border-accent text-accent' : 'border-line text-ink-light'
                          }`}>
                            {row.customer_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-ink-light">{row.count}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          ₹{row.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-light text-xs">
                          {data.total_sales > 0 ? `${Math.round((row.total / data.total_sales) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {data.by_customer_type.length > 1 && (
                      <tr className="border-t-2 border-ink bg-ink/5 font-bold">
                        <td className="px-4 py-3 font-mono text-xs uppercase tracking-widest">Total</td>
                        <td className="px-4 py-3 text-center font-mono">{data.invoice_count}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{data.total_sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-light text-xs">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
