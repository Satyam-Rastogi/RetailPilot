import { useSearchParams } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { ledgerService, companyProfileService } from '../services/api'
import type { CustomerLedger, CompanyProfile } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { format, subDays, startOfMonth } from 'date-fns'
import { amountInWords } from '../lib/printUtils'

const today = format(new Date(), 'yyyy-MM-dd')
const firstOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')

const statusColor: Record<string, string> = {
  Paid: '#16a34a',
  'Partially Paid': '#d97706',
  Unpaid: '#dc2626',
}

export default function CustomerStatementPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const { formatCurrency } = useSettings()

  const [searchParams, setSearchParams] = useSearchParams()
  const dateFrom = searchParams.get('from') ?? firstOfMonth
  const dateTo   = searchParams.get('to')   ?? today
  const setDateFrom = (v: string) => setSearchParams(p => { const n = new URLSearchParams(p); v ? n.set('from', v) : n.delete('from'); return n }, { replace: true })
  const setDateTo   = (v: string) => setSearchParams(p => { const n = new URLSearchParams(p); v ? n.set('to', v)   : n.delete('to');   return n }, { replace: true })

  const { data: ledger, isLoading, isError, refetch } = useQuery<CustomerLedger>({
    queryKey: ['customerStatement', customerId, dateFrom, dateTo],
    queryFn: () => ledgerService.getCustomerLedger(Number(customerId), dateFrom || undefined, dateTo || undefined),
    enabled: !!customerId,
  })

  const { data: companyProfile } = useQuery<CompanyProfile>({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileService.get(),
  })

  const quickRanges = [
    { label: 'This Month', from: firstOfMonth, to: today },
    { label: 'Last 30d', from: format(subDays(new Date(), 30), 'yyyy-MM-dd'), to: today },
    { label: 'Last 90d', from: format(subDays(new Date(), 90), 'yyyy-MM-dd'), to: today },
    { label: 'All Time', from: '', to: '' },
  ]

  // Build a unified timeline sorted by date
  type Entry =
    | { kind: 'invoice'; date: string; number: string; total: number; paid: number; status: string }
    | { kind: 'payment'; date: string; amount: number; method: string | null; ref: string | null }

  const timeline: Entry[] = []
  if (ledger) {
    for (const inv of ledger.invoices) {
      timeline.push({ kind: 'invoice', date: inv.invoice_date, number: inv.invoice_number, total: inv.grand_total, paid: inv.amount_paid, status: inv.payment_status })
    }
    for (const pay of ledger.payments) {
      if (pay.payment_method === 'credit_note') continue
      timeline.push({ kind: 'payment', date: pay.date, amount: pay.amount, method: pay.payment_method, ref: pay.reference_number })
    }
    timeline.sort((a, b) => a.date.localeCompare(b.date))
  }

  const printDate = format(new Date(), 'dd MMM yyyy')
  const amtWordsBalance = ledger ? amountInWords(ledger.total_unpaid) : ''

  return (
    <>
      {/* ── Print layout ──────────────────────────────────────────── */}
      <div className="hidden print:block" style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: '#fff', fontSize: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: 1.2 }}>{companyProfile?.shop_name || 'RetailPilot'}</div>
            {companyProfile?.shop_address && <div style={{ color: '#555', marginTop: '3px' }}>{companyProfile.shop_address}</div>}
            {companyProfile?.shop_phone && <div style={{ color: '#555', marginTop: '1px' }}>Ph: {companyProfile.shop_phone}</div>}
            {companyProfile?.shop_gstin && <div style={{ color: '#555', marginTop: '1px' }}>GSTIN: {companyProfile.shop_gstin}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#d97706', letterSpacing: '-0.5px' }}>STATEMENT</div>
            <div style={{ color: '#555', marginTop: '4px' }}>Printed: {printDate}</div>
            {(dateFrom || dateTo) && (
              <div style={{ color: '#555', marginTop: '1px' }}>
                Period: {dateFrom ? format(new Date(dateFrom), 'dd MMM yyyy') : 'Start'} – {dateTo ? format(new Date(dateTo), 'dd MMM yyyy') : 'Today'}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: '3px', background: '#d97706', margin: '8px 0 12px' }} />

        {/* Customer */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Statement For</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{ledger?.customer_name}</div>
        </div>

        {/* Summary boxes */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Invoiced', value: formatCurrency(ledger?.total_invoiced ?? 0), color: '#111' },
            { label: 'Total Paid', value: formatCurrency(ledger?.total_paid ?? 0), color: '#16a34a' },
            { label: 'Balance Due', value: formatCurrency(ledger?.total_unpaid ?? 0), color: '#dc2626' },
          ].map(box => (
            <div key={box.label} style={{ flex: 1, border: '1px solid #ddd', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{box.label}</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: box.color }}>{box.value}</div>
            </div>
          ))}
        </div>

        {/* Timeline table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#666', fontWeight: 'bold' }}>Date</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#666', fontWeight: 'bold' }}>Description</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#666', fontWeight: 'bold' }}>Invoice</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#666', fontWeight: 'bold' }}>Payment</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#666', fontWeight: 'bold' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((entry, i) => (
              entry.kind === 'invoice' ? (
                <tr key={`inv-${i}`} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px', color: '#555' }}>{format(new Date(entry.date), 'dd MMM yy')}</td>
                  <td style={{ padding: '6px 8px', fontWeight: '600' }}>Invoice {entry.number}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(entry.total)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a' }}>{entry.paid > 0 ? formatCurrency(entry.paid) : '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: statusColor[entry.status] ?? '#555', fontWeight: '600', fontSize: '10px' }}>{entry.status.toUpperCase()}</td>
                </tr>
              ) : (
                <tr key={`pay-${i}`} style={{ borderBottom: '1px solid #eee', background: '#f9fff9' }}>
                  <td style={{ padding: '6px 8px', color: '#555' }}>{format(new Date(entry.date), 'dd MMM yy')}</td>
                  <td style={{ padding: '6px 8px', color: '#16a34a' }}>
                    Payment received{entry.method ? ` via ${entry.method}` : ''}{entry.ref ? ` (Ref: ${entry.ref})` : ''}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#888' }}>—</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a', fontWeight: '600' }}>{formatCurrency(entry.amount)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a', fontSize: '10px', fontWeight: '600' }}>RECEIVED</td>
                </tr>
              )
            ))}
          </tbody>
        </table>

        {/* Balance due line */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <div style={{ border: '2px solid #d97706', padding: '10px 16px', minWidth: '220px', textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Balance Due</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: (ledger?.total_unpaid ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>
              {formatCurrency(ledger?.total_unpaid ?? 0)}
            </div>
            {(ledger?.total_unpaid ?? 0) > 0 && (
              <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', fontStyle: 'italic' }}>{amtWordsBalance}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ddd', marginTop: '20px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {companyProfile?.upi_id && <div>UPI: {companyProfile.upi_id}</div>}
            {companyProfile?.receiver_bank_name && <div>Bank: {companyProfile.receiver_bank_name} · A/C: {companyProfile.receiver_account_number} · IFSC: {companyProfile.receiver_ifsc_code}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '32px' }}>Authorised Signatory</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: '4px', minWidth: '140px', fontSize: '11px', color: '#555' }}>
              {companyProfile?.shop_name || 'Shop'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Screen layout ────────────────────────────────────────── */}
      <div className="space-y-6 pb-12 print:hidden">
        {/* Header */}
        <header className="border-b border-line pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-ink-light hover:text-accent transition-colors mb-4"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">Customer Statement</h1>
              {ledger && <p className="font-mono text-sm text-ink-light mt-1">{ledger.customer_name}</p>}
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 border border-zinc-400 dark:border-zinc-600 font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface hover:border-ink transition-all brutal-focus"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
          </div>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </header>

        {/* Date range controls */}
        <div className="flex flex-wrap items-center gap-2">
          {quickRanges.map(r => (
            <button
              key={r.label}
              onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
              className={`px-3 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus ${
                dateFrom === r.from && dateTo === r.to ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface'
              }`}
            >
              {r.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={dateFrom} max={dateTo || today} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent" />
            <span className="font-mono text-xs text-ink-light">to</span>
            <input type="date" value={dateTo} min={dateFrom} max={today} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent" />
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider flex justify-between">
            <span>Failed to load statement</span>
            <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-12">Loading…</div>
        )}

        {ledger && (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Invoiced', value: formatCurrency(ledger.total_invoiced), cls: '' },
                { label: 'Total Paid', value: formatCurrency(ledger.total_paid), cls: 'text-success' },
                { label: 'Balance Due', value: formatCurrency(ledger.total_unpaid), cls: ledger.total_unpaid > 0 ? 'text-danger' : 'text-success' },
              ].map(t => (
                <div key={t.label} className="brutal-border bg-paper p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">{t.label}</div>
                  <div className={`font-mono font-bold text-xl ${t.cls}`}>{t.value}</div>
                </div>
              ))}
            </div>

            {/* Timeline table */}
            <div className="brutal-border overflow-hidden">
              <div className="bg-ink text-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest font-bold">
                Account Activity
              </div>
              {timeline.length === 0 ? (
                <p className="px-4 py-8 text-center font-mono text-xs text-ink-light uppercase tracking-widest">No transactions in this period</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light">Date</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink-light">Description</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Invoice</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Payment</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((entry, i) => (
                      entry.kind === 'invoice' ? (
                        <tr key={`inv-${i}`} className="border-b border-line last:border-0 hover:bg-surface transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-ink-light whitespace-nowrap">{format(new Date(entry.date), 'dd MMM yy')}</td>
                          <td className="px-4 py-3 font-mono text-xs font-medium">Invoice {entry.number}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(entry.total)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-success">{entry.paid > 0 ? formatCurrency(entry.paid) : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border ${
                              entry.status === 'Paid' ? 'border-success text-success' :
                              entry.status === 'Partially Paid' ? 'border-warning text-warning' :
                              'border-danger text-danger'
                            }`}>{entry.status}</span>
                          </td>
                        </tr>
                      ) : (
                        <tr key={`pay-${i}`} className="border-b border-line last:border-0 bg-success/5 hover:bg-success/10 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-ink-light whitespace-nowrap">{format(new Date(entry.date), 'dd MMM yy')}</td>
                          <td className="px-4 py-3 font-mono text-xs text-success">
                            Payment{entry.method ? ` · ${entry.method}` : ''}{entry.ref ? ` (${entry.ref})` : ''}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-ink-light">—</td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-success">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-success text-success">Received</span>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Balance due summary */}
            {ledger.total_unpaid > 0 && (
              <div className="flex justify-end">
                <div className="brutal-border p-4 min-w-[260px] text-right">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Balance Due</div>
                  <div className="font-mono font-bold text-2xl text-danger">{formatCurrency(ledger.total_unpaid)}</div>
                  <div className="text-[10px] font-mono text-ink-light mt-1 italic">{amtWordsBalance}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
