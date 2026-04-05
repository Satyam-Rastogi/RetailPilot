import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Users } from 'lucide-react'
import { reportService } from '../services/api'
import type { RevenueReportResponse } from '../types/api'
import { cn } from '../lib/utils'

const PERIOD_OPTIONS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: '24M', months: 24 },
]

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtCompact(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return fmt(n)
}

// Defers chart render until the container has non-zero dimensions (Recharts bug workaround)
function ChartContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.clientWidth > 0 && el.clientHeight > 0) { setReady(true); return }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setReady(true); observer.disconnect()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={cn('w-full h-full', className)}>{ready && children}</div>
}

function KpiTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('brutal-border p-4', accent ? 'bg-ink text-surface' : 'bg-paper')}>
      <div className={cn('text-[10px] font-mono uppercase tracking-widest mb-1', accent ? 'text-surface/60' : 'text-ink-light')}>{label}</div>
      <div className="font-mono font-bold text-xl">{value}</div>
      {sub && <div className={cn('text-[10px] font-mono mt-0.5', accent ? 'text-surface/50' : 'text-ink-light')}>{sub}</div>}
    </div>
  )
}

// Custom tooltip for stacked bar chart
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const retail = payload.find((p: any) => p.dataKey === 'retail')?.value ?? 0
  const wholesale = payload.find((p: any) => p.dataKey === 'wholesale')?.value ?? 0
  const total = retail + wholesale
  return (
    <div className="bg-paper border border-line p-3 text-xs font-mono shadow-sm min-w-[160px]">
      <div className="text-ink-light uppercase tracking-widest mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-accent">Retail</span>
          <span className="font-bold">{fmt(retail)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-success">Wholesale</span>
          <span className="font-bold">{fmt(wholesale)}</span>
        </div>
        <div className="flex justify-between gap-6 border-t border-line pt-1 mt-1">
          <span className="text-ink-light">Total</span>
          <span className="font-bold">{fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}

export default function RevenueAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const months = parseInt(searchParams.get('months') ?? '12')
  const setMonths = (m: number) => setSearchParams({ months: String(m) }, { replace: true })

  const { data, isLoading, isError, refetch } = useQuery<RevenueReportResponse>({
    queryKey: ['revenue', months],
    queryFn: () => reportService.getRevenue(months),
    staleTime: 60_000,
  })

  const summary = data?.summary
  const monthList = data?.months ?? []
  const topCustomers = data?.top_customers ?? []

  const maxCustomerTotal = topCustomers[0]?.total ?? 1

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tighter flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-accent" />
            Revenue Analytics
          </h1>
          <p className="text-xs font-mono text-ink-light uppercase tracking-widest mt-0.5">
            Retail vs wholesale split · monthly trend · top customers
          </p>
        </div>
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.months}
              onClick={() => setMonths(opt.months)}
              className={cn(
                'px-4 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus',
                months === opt.months ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider flex items-center justify-between">
          <span>Failed to load revenue data</span>
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-20">Loading…</div>
      )}

      {data && summary && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiTile
              label={`Total Revenue (${data.period_months}M)`}
              value={fmtCompact(summary.grand_total)}
              sub={`${summary.invoice_count} invoices`}
              accent
            />
            <KpiTile
              label="Retail"
              value={fmtCompact(summary.retail_total)}
              sub={`${summary.retail_pct}% of total`}
            />
            <KpiTile
              label="Wholesale"
              value={fmtCompact(summary.wholesale_total)}
              sub={`${summary.wholesale_pct}% of total`}
            />
            <KpiTile
              label="Top Customer"
              value={topCustomers[0] ? fmtCompact(topCustomers[0].total) : '—'}
              sub={topCustomers[0]?.customer_name ?? 'No data'}
            />
          </div>

          {/* Stacked bar chart */}
          <div className="brutal-border overflow-hidden">
            <div className="bg-ink text-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest font-bold flex items-center justify-between">
              <span>Monthly Revenue — Retail vs Wholesale</span>
              <div className="flex items-center gap-4 text-surface/70">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 inline-block" style={{ background: 'var(--theme-accent)' }} />
                  Retail
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 inline-block" style={{ background: 'var(--theme-success)' }} />
                  Wholesale
                </span>
              </div>
            </div>
            <div className="h-72 p-4">
              <ChartContainer>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthList}
                    margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-line-subtle)" />
                    <XAxis
                      dataKey="month_label"
                      stroke="var(--theme-ink-light)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={months > 12 ? 30 : 20}
                      fontFamily="JetBrains Mono, monospace"
                    />
                    <YAxis
                      stroke="var(--theme-ink-light)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtCompact}
                      tickMargin={8}
                      fontFamily="JetBrains Mono, monospace"
                    />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--theme-line-subtle)' }} />
                    <Bar dataKey="retail" stackId="a" fill="var(--theme-accent)" radius={[0, 0, 0, 0]} maxBarSize={48} animationDuration={800} />
                    <Bar dataKey="wholesale" stackId="a" fill="var(--theme-success)" radius={[2, 2, 0, 0]} maxBarSize={48} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </div>

          {/* Retail/Wholesale split bar */}
          {summary.grand_total > 0 && (
            <div className="brutal-border p-4 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Revenue Split</div>
              <div className="flex h-6 w-full overflow-hidden border border-line">
                <div
                  className="h-full bg-accent transition-all duration-700 flex items-center justify-center"
                  style={{ width: `${summary.retail_pct}%` }}
                >
                  {summary.retail_pct >= 10 && (
                    <span className="text-[9px] font-mono font-bold text-surface">{summary.retail_pct}%</span>
                  )}
                </div>
                <div
                  className="h-full flex-1 bg-success transition-all duration-700 flex items-center justify-center"
                >
                  {summary.wholesale_pct >= 10 && (
                    <span className="text-[9px] font-mono font-bold text-surface">{summary.wholesale_pct}%</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs font-mono text-ink-light">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-accent inline-block" />
                  Retail — {fmt(summary.retail_total)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-success inline-block" />
                  Wholesale — {fmt(summary.wholesale_total)}
                </span>
              </div>
            </div>
          )}

          {/* Top customers table */}
          {topCustomers.length > 0 && (
            <div className="brutal-border overflow-hidden">
              <div className="bg-ink text-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Top Customers — Last {data.period_months} Months
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface">
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light w-6">#</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light">Customer</th>
                    <th className="px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink-light">Type</th>
                    <th className="px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink-light">Invoices</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Revenue</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light w-40 hidden sm:table-cell">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, idx) => {
                    const pct = summary.grand_total > 0 ? (c.total / summary.grand_total) * 100 : 0
                    const barWidth = maxCustomerTotal > 0 ? (c.total / maxCustomerTotal) * 100 : 0
                    return (
                      <tr key={c.customer_id} className="border-b border-line last:border-0 hover:bg-surface transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ink-light">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-medium text-xs">{c.customer_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border',
                            c.customer_type === 'Wholesale'
                              ? 'border-accent text-accent'
                              : 'border-line text-ink-light',
                          )}>
                            {c.customer_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-ink-light text-xs">{c.invoice_count}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-xs">{fmt(c.total)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-surface border border-line overflow-hidden">
                              <div
                                className="h-full bg-accent transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-ink-light w-8 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {topCustomers.length === 0 && (
            <div className="brutal-border px-4 py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-light">
              No invoice data for this period
            </div>
          )}
        </>
      )}
    </div>
  )
}
