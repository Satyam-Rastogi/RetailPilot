import { useSearchParams } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { ledgerService, companyProfileService } from '../services/api'
import type { CustomerLedger, CompanyProfile } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { format, subDays, startOfMonth, differenceInDays } from 'date-fns'
import { DateRangePicker } from '../components/DatePicker'
import { amountInWords } from '../lib/printUtils'

const today        = format(new Date(), 'yyyy-MM-dd')
const firstOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtD(d: string | Date) {
  return format(new Date(d as string), 'dd MMM yy')
}
function fmtDLong(d: string | Date) {
  return format(new Date(d as string), 'dd MMM yyyy')
}

// ── unified timeline entry ────────────────────────────────────────────────────

type Entry =
  | { kind: 'invoice'; date: string; number: string; total: number; paid: number; unpaid: number; status: string; due_date?: string }
  | { kind: 'payment'; date: string; amount: number; method: string | null; ref: string | null }

// ── page ─────────────────────────────────────────────────────────────────────

export default function CustomerStatementPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate       = useNavigate()
  const { formatCurrency } = useSettings()

  const [searchParams, setSearchParams] = useSearchParams()
  const dateFrom = searchParams.get('from') ?? ''
  const dateTo   = searchParams.get('to')   ?? ''

  // Default to "This Month" on first visit — lets "All Time" correctly clear params
  useEffect(() => {
    if (!searchParams.get('from') && !searchParams.get('to')) {
      setSearchParams({ from: firstOfMonth, to: today }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setRange = (from: string, to: string) =>
    setSearchParams(p => {
      const n = new URLSearchParams(p)
      from ? n.set('from', from) : n.delete('from')
      to   ? n.set('to',   to)   : n.delete('to')
      return n
    }, { replace: true })

  const quickRanges = [
    { label: 'This Month', from: firstOfMonth, to: today },
    { label: 'Last 30d',   from: format(subDays(new Date(), 30),  'yyyy-MM-dd'), to: today },
    { label: 'Last 90d',   from: format(subDays(new Date(), 90),  'yyyy-MM-dd'), to: today },
    { label: 'All Time',   from: '', to: '' },
  ]

  const { data: ledger, isLoading, isError, refetch } = useQuery<CustomerLedger>({
    queryKey: ['customerStatement', customerId, dateFrom, dateTo],
    queryFn: () => ledgerService.getCustomerLedger(
      Number(customerId),
      dateFrom || undefined,
      dateTo   || undefined,
    ),
    enabled: !!customerId,
  })

  const { data: company } = useQuery<CompanyProfile>({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileService.get(),
  })

  // ── build unified timeline ────────────────────────────────────────────────
  const timeline: Entry[] = []
  if (ledger) {
    for (const inv of ledger.invoices) {
      timeline.push({
        kind: 'invoice',
        date: typeof inv.invoice_date === 'string'
          ? inv.invoice_date.slice(0, 10)
          : format(new Date(inv.invoice_date), 'yyyy-MM-dd'),
        number:   inv.invoice_number,
        total:    inv.grand_total,
        paid:     inv.amount_paid,
        unpaid:   inv.unpaid,
        status:   inv.payment_status,
        due_date: inv.due_date
          ? (typeof inv.due_date === 'string'
              ? inv.due_date.slice(0, 10)
              : format(new Date(inv.due_date), 'yyyy-MM-dd'))
          : undefined,
      })
    }
    for (const pay of ledger.payments) {
      if (pay.payment_method === 'credit_note') continue
      timeline.push({
        kind:   'payment',
        date:   typeof pay.date === 'string'
          ? pay.date.slice(0, 10)
          : format(new Date(pay.date), 'yyyy-MM-dd'),
        amount: pay.amount,
        method: pay.payment_method ?? null,
        ref:    pay.reference_number ?? null,
      })
    }
    timeline.sort((a, b) => a.date.localeCompare(b.date))
  }

  // ── running balance ───────────────────────────────────────────────────────
  const openingBalance = ledger?.opening_balance ?? 0
  let runBal = openingBalance
  const rows: (Entry & { balance: number })[] = timeline.map(e => {
    if (e.kind === 'invoice') runBal += e.total
    else                      runBal -= e.amount
    return { ...e, balance: runBal }
  })
  const closingBalance = runBal   // = openingBalance + totalInvoiced - totalPaid

  // ── effective credit period: customer override → company default → 60d fallback ──
  const effectiveCreditDays = ledger?.credit_days ?? company?.default_credit_days ?? 60

  // ── outstanding invoices (unpaid > 0) ─────────────────────────────────────
  const outstanding = (ledger?.invoices ?? [])
    .filter(i => i.unpaid > 0)
    .sort((a, b) => {
      const da = typeof a.invoice_date === 'string' ? a.invoice_date : format(new Date(a.invoice_date), 'yyyy-MM-dd')
      const db_ = typeof b.invoice_date === 'string' ? b.invoice_date : format(new Date(b.invoice_date), 'yyyy-MM-dd')
      return da.localeCompare(db_)
    })

  const printDate = format(new Date(), 'dd MMM yyyy')

  // ── shared print styles ───────────────────────────────────────────────────
  const pTh: React.CSSProperties = { padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }
  const pTd: React.CSSProperties = { padding: '5px 8px', fontSize: '11px', borderBottom: '1px solid #eee' }
  const pTdR: React.CSSProperties = { ...pTd, textAlign: 'right' }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          PRINT LAYOUT
      ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block" style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: '#fff', fontSize: '12px', padding: '0' }}>

        {/* Header: company left, doc title right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.1 }}>{company?.shop_name || 'RetailPilot'}</div>
            {company?.shop_address  && <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{company.shop_address}</div>}
            {company?.shop_phone    && <div style={{ color: '#555', fontSize: '11px' }}>Ph: {company.shop_phone}</div>}
            {company?.shop_gstin    && <div style={{ color: '#555', fontSize: '11px' }}>GSTIN: {company.shop_gstin}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#d97706', letterSpacing: '-0.5px' }}>ACCOUNT STATEMENT</div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>Printed: {printDate}</div>
            {(dateFrom || dateTo) && (
              <div style={{ fontSize: '11px', color: '#555' }}>
                Period: {dateFrom ? fmtDLong(dateFrom) : 'All time'}{dateTo ? ` – ${fmtDLong(dateTo)}` : ''}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: '3px', background: '#d97706', margin: '8px 0' }} />

        {/* Customer block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Statement For</div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>{ledger?.customer_name}</div>
            {ledger?.customer_phone   && <div style={{ fontSize: '11px', color: '#555' }}>Ph: {ledger.customer_phone}</div>}
            {ledger?.customer_address && <div style={{ fontSize: '11px', color: '#555' }}>{ledger.customer_address}</div>}
            {ledger?.customer_gstin   && <div style={{ fontSize: '11px', color: '#555' }}>GSTIN: {ledger.customer_gstin}</div>}
          </div>
          {/* 3 summary boxes */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {[
              { label: 'Total Invoiced', value: formatCurrency(ledger?.total_invoiced ?? 0), color: '#111' },
              { label: 'Total Received', value: formatCurrency(ledger?.total_paid ?? 0),     color: '#16a34a' },
              { label: 'Balance Due',    value: formatCurrency(closingBalance),              color: closingBalance > 0 ? '#dc2626' : '#16a34a' },
            ].map(b => (
              <div key={b.label} style={{ border: '1px solid #ddd', padding: '8px 12px', minWidth: '110px', textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{b.label}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: b.color }}>{b.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Account statement table ── */}
        <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Account Statement</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={pTh}>Date</th>
              <th style={pTh}>Voucher</th>
              <th style={pTh}>Description</th>
              <th style={{ ...pTh, textAlign: 'right' }}>Debit (₹)</th>
              <th style={{ ...pTh, textAlign: 'right' }}>Credit (₹)</th>
              <th style={{ ...pTh, textAlign: 'right' }}>Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening balance row */}
            <tr style={{ background: '#fafafa' }}>
              <td style={pTd} colSpan={3}><em style={{ color: '#888' }}>Opening Balance</em></td>
              <td style={pTdR}>—</td>
              <td style={pTdR}>—</td>
              <td style={{ ...pTdR, fontWeight: 700 }}>{formatCurrency(openingBalance)}</td>
            </tr>
            {rows.map((e, i) =>
              e.kind === 'invoice' ? (
                <tr key={i}>
                  <td style={pTd}>{fmtD(e.date)}</td>
                  <td style={pTd}>{e.number}</td>
                  <td style={pTd}>Invoice{e.due_date ? ` · Due ${fmtD(e.due_date)}` : ''}</td>
                  <td style={{ ...pTdR, color: '#111' }}>{formatCurrency(e.total)}</td>
                  <td style={pTdR}>—</td>
                  <td style={{ ...pTdR, fontWeight: 600 }}>{formatCurrency(e.balance)}</td>
                </tr>
              ) : (
                <tr key={i} style={{ background: '#f9fff9' }}>
                  <td style={pTd}>{fmtD(e.date)}</td>
                  <td style={{ ...pTd, color: '#888' }}>—</td>
                  <td style={{ ...pTd, color: '#16a34a' }}>
                    Payment received{e.method ? ` · ${e.method}` : ''}{e.ref ? ` (${e.ref})` : ''}
                  </td>
                  <td style={pTdR}>—</td>
                  <td style={{ ...pTdR, color: '#16a34a', fontWeight: 600 }}>{formatCurrency(e.amount)}</td>
                  <td style={{ ...pTdR, fontWeight: 600 }}>{formatCurrency(e.balance)}</td>
                </tr>
              )
            )}
            {/* Totals row */}
            <tr style={{ background: '#f0f0f0', borderTop: '2px solid #ccc' }}>
              <td style={{ ...pTd, fontWeight: 700 }} colSpan={3}>Total</td>
              <td style={{ ...pTdR, fontWeight: 700 }}>{formatCurrency(ledger?.total_invoiced ?? 0)}</td>
              <td style={{ ...pTdR, fontWeight: 700, color: '#16a34a' }}>{formatCurrency(ledger?.total_paid ?? 0)}</td>
              <td style={pTdR} />
            </tr>
          </tbody>
        </table>

        {/* Closing balance box */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <div style={{ border: '2px solid #d97706', padding: '10px 16px', minWidth: '230px', textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '3px' }}>
              {closingBalance > 0 ? 'Balance Due' : closingBalance < 0 ? 'Credit in Your Favour' : 'Account Settled'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: closingBalance > 0 ? '#dc2626' : '#16a34a' }}>
              {formatCurrency(Math.abs(closingBalance))}
            </div>
            {closingBalance !== 0 && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '3px', fontStyle: 'italic' }}>
                {amountInWords(Math.abs(closingBalance))}
              </div>
            )}
          </div>
        </div>

        {/* ── Outstanding invoices (print) ── */}
        {outstanding.length > 0 && (
          <>
            <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              Outstanding Invoices
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#fff3cd' }}>
                  <th style={pTh}>Invoice</th>
                  <th style={pTh}>Date</th>
                  <th style={pTh}>Due Date</th>
                  <th style={{ ...pTh, textAlign: 'right' }}>Invoice Amt</th>
                  <th style={{ ...pTh, textAlign: 'right' }}>Received</th>
                  <th style={{ ...pTh, textAlign: 'right' }}>Balance</th>
                  <th style={{ ...pTh, textAlign: 'right' }}>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((inv, i) => {
                  const invDateStr = typeof inv.invoice_date === 'string' ? inv.invoice_date.slice(0, 10) : format(new Date(inv.invoice_date), 'yyyy-MM-dd')
                  const dueDateStr = inv.due_date
                    ? (typeof inv.due_date === 'string' ? inv.due_date.slice(0, 10) : format(new Date(inv.due_date), 'yyyy-MM-dd'))
                    : undefined
                  // Overdue = days since invoice exceeds the effective credit period
                  const daysSince = differenceInDays(new Date(), new Date(invDateStr))
                  const overdueDays = daysSince - effectiveCreditDays
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ ...pTd, fontWeight: 600 }}>{inv.invoice_number}</td>
                      <td style={pTd}>{fmtD(invDateStr)}</td>
                      <td style={{ ...pTd, color: overdueDays > 0 ? '#dc2626' : '#555' }}>
                        {dueDateStr ? fmtD(dueDateStr) : '—'}
                      </td>
                      <td style={pTdR}>{formatCurrency(inv.grand_total)}</td>
                      <td style={{ ...pTdR, color: '#16a34a' }}>{inv.amount_paid > 0 ? formatCurrency(inv.amount_paid) : '—'}</td>
                      <td style={{ ...pTdR, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(inv.unpaid)}</td>
                      <td style={{ ...pTdR, color: overdueDays > 0 ? '#dc2626' : '#888', fontWeight: overdueDays > 0 ? 700 : 400 }}>
                        {overdueDays > 0 ? `${overdueDays}d` : overdueDays === 0 ? 'Today' : 'Not due'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Footer: bank details + signature */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: '10px', color: '#777', lineHeight: 1.7 }}>
            {company?.upi_id              && <div>UPI: {company.upi_id}</div>}
            {company?.receiver_bank_name  && (
              <div>Bank: {company.receiver_bank_name} · A/C {company.receiver_account_number} · IFSC {company.receiver_ifsc_code}</div>
            )}
            <div style={{ marginTop: '6px', fontStyle: 'italic' }}>This is a computer generated statement.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '28px' }}>Authorised Signatory</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: '4px', minWidth: '150px', fontSize: '11px', color: '#555' }}>
              {company?.shop_name || 'Shop'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SCREEN LAYOUT
      ════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6 pb-16 print:hidden">

        {/* ── Page header ── */}
        <header className="border-b border-line pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-ink-light hover:text-accent transition-colors mb-4"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">Account Statement</h1>
              {ledger && (
                <div className="mt-1 space-y-0.5">
                  <p className="font-mono text-sm font-semibold">{ledger.customer_name}</p>
                  {ledger.customer_phone   && <p className="font-mono text-xs text-ink-light">Ph: {ledger.customer_phone}</p>}
                  {ledger.customer_address && <p className="font-mono text-xs text-ink-light">{ledger.customer_address}</p>}
                  {ledger.customer_gstin   && <p className="font-mono text-xs text-ink-light">GSTIN: {ledger.customer_gstin}</p>}
                </div>
              )}
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-all brutal-focus shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Print Statement
            </button>
          </div>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </header>

        {/* ── Date range controls ── */}
        <div className="flex flex-wrap items-center gap-2">
          {quickRanges.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.from, r.to)}
              className={`px-3 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-widest transition-colors brutal-focus ${
                dateFrom === r.from && dateTo === r.to ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface'
              }`}
            >
              {r.label}
            </button>
          ))}
          <DateRangePicker
            from={dateFrom} to={dateTo} max={today}
            onChange={r => setRange(r.from, r.to)}
            className="ml-2"
          />
        </div>

        {/* ── Error / loading ── */}
        {isError && (
          <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider flex justify-between">
            <span>Failed to load statement</span>
            <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        )}
        {isLoading && (
          <div className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-16">Loading…</div>
        )}

        {ledger && (
          <>
            {/* ── KPI tiles ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="brutal-border bg-paper p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Total Invoiced</div>
                <div className="font-mono font-bold text-lg">{formatCurrency(ledger.total_invoiced)}</div>
              </div>
              <div className="brutal-border bg-paper p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Total Received</div>
                <div className="font-mono font-bold text-lg text-success">{formatCurrency(ledger.total_paid)}</div>
              </div>
              {openingBalance !== 0 && (
                <div className="brutal-border bg-paper p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Opening Balance</div>
                  <div className={`font-mono font-bold text-lg ${openingBalance > 0 ? 'text-warning' : 'text-success'}`}>
                    {formatCurrency(openingBalance)}
                  </div>
                  <div className="text-[9px] font-mono text-ink-light mt-0.5">carried forward</div>
                </div>
              )}
              <div className={`brutal-border p-4 ${closingBalance > 0 ? 'bg-danger/5' : 'bg-paper'} ${openingBalance === 0 ? 'sm:col-span-2' : ''}`}>
                <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">
                  {closingBalance > 0 ? 'Balance Due' : closingBalance < 0 ? 'Credit Balance' : 'Balance'}
                </div>
                <div className={`font-mono font-bold text-xl ${closingBalance > 0 ? 'text-danger' : closingBalance < 0 ? 'text-success' : ''}`}>
                  {formatCurrency(Math.abs(closingBalance))}
                </div>
                {closingBalance < 0 && <div className="text-[9px] font-mono text-success mt-0.5">in customer's favour</div>}
              </div>
            </div>

            {/* ── Account statement table ── */}
            <div className="brutal-border overflow-x-auto">
              <div className="bg-ink text-surface px-4 py-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Account Statement</span>
                {(dateFrom || dateTo) && (
                  <span className="font-mono text-[10px] text-surface/60">
                    {dateFrom ? fmtDLong(dateFrom) : 'All time'}{dateTo ? ` → ${fmtDLong(dateTo)}` : ''}
                  </span>
                )}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface">
                    <th className="px-4 py-2.5 text-left   font-mono text-[10px] uppercase tracking-widest text-ink-light w-24">Date</th>
                    <th className="px-4 py-2.5 text-left   font-mono text-[10px] uppercase tracking-widest text-ink-light w-28">Voucher</th>
                    <th className="px-4 py-2.5 text-left   font-mono text-[10px] uppercase tracking-widest text-ink-light">Description</th>
                    <th className="px-4 py-2.5 text-right  font-mono text-[10px] uppercase tracking-widest text-ink-light w-28">Debit</th>
                    <th className="px-4 py-2.5 text-right  font-mono text-[10px] uppercase tracking-widest text-ink-light w-28">Credit</th>
                    <th className="px-4 py-2.5 text-right  font-mono text-[10px] uppercase tracking-widest text-ink-light w-32">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="border-b border-line bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-light" colSpan={3}>
                      <em>Opening Balance{dateFrom ? ` (before ${fmtDLong(dateFrom)})` : ''}</em>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-ink-light">—</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-ink-light">—</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                      {formatCurrency(openingBalance)}
                    </td>
                  </tr>

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center font-mono text-xs text-ink-light uppercase tracking-widest">
                        No transactions in this period
                      </td>
                    </tr>
                  )}

                  {rows.map((e, i) =>
                    e.kind === 'invoice' ? (
                      <tr key={i} className="border-b border-line last:border-0 hover:bg-surface transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ink-light whitespace-nowrap">{fmtD(e.date)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{e.number}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          Invoice
                          {e.due_date && (
                            <span className="ml-2 text-ink-light">· Due {fmtD(e.due_date)}</span>
                          )}
                          {e.status !== 'Paid' && (
                            <span className={`ml-2 text-[9px] px-1.5 py-0.5 border font-mono uppercase tracking-wide ${
                              e.status === 'Partially Paid' ? 'border-warning text-warning' : 'border-danger text-danger'
                            }`}>{e.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{formatCurrency(e.total)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-ink-light">—</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold">{formatCurrency(e.balance)}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="border-b border-line last:border-0 bg-success/5 hover:bg-success/10 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ink-light whitespace-nowrap">{fmtD(e.date)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light">—</td>
                        <td className="px-4 py-3 font-mono text-xs text-success">
                          Payment received
                          {e.method && <span className="text-ink-light"> · {e.method}</span>}
                          {e.ref    && <span className="text-ink-light"> ({e.ref})</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-ink-light">—</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-success">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold">{formatCurrency(e.balance)}</td>
                      </tr>
                    )
                  )}

                  {/* Totals row */}
                  {rows.length > 0 && (
                    <tr className="border-t-2 border-ink bg-ink/5">
                      <td className="px-4 py-3 font-mono text-xs uppercase tracking-widest font-bold" colSpan={3}>Period Total</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold">{formatCurrency(ledger.total_invoiced)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-success">{formatCurrency(ledger.total_paid)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold">
                        <span className={closingBalance > 0 ? 'text-danger' : closingBalance < 0 ? 'text-success' : ''}>
                          {formatCurrency(closingBalance)}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Outstanding invoices section ── */}
            {outstanding.length > 0 && (
              <div className="brutal-border overflow-x-auto">
                <div className="bg-warning/10 border-b border-warning/30 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-warning">
                      Outstanding Invoices — {outstanding.length} unpaid
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      credit period: {effectiveCreditDays}d{ledger.credit_days ? ' (customer)' : ' (default)'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-warning font-bold">
                    Total due: {formatCurrency(outstanding.reduce((s, i) => s + i.unpaid, 0))}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      <th className="px-4 py-2.5 text-left  font-mono text-[10px] uppercase tracking-widest text-ink-light">Invoice</th>
                      <th className="px-4 py-2.5 text-left  font-mono text-[10px] uppercase tracking-widest text-ink-light">Date</th>
                      <th className="px-4 py-2.5 text-left  font-mono text-[10px] uppercase tracking-widest text-ink-light">Due Date</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Invoice Amt</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Received</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Balance</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest text-ink-light">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.map((inv, i) => {
                      const invDateStr = typeof inv.invoice_date === 'string'
                        ? inv.invoice_date.slice(0, 10)
                        : format(new Date(inv.invoice_date), 'yyyy-MM-dd')
                      const dueDateStr = inv.due_date
                        ? (typeof inv.due_date === 'string' ? inv.due_date.slice(0, 10) : format(new Date(inv.due_date), 'yyyy-MM-dd'))
                        : undefined
                      // Overdue = days since invoice exceeds the effective credit period
                      const daysSince = differenceInDays(new Date(), new Date(invDateStr))
                      const overdueDays = daysSince - effectiveCreditDays
                      const isOverdue = overdueDays > 0
                      return (
                        <tr key={i} className={`border-b border-line last:border-0 transition-colors ${isOverdue ? 'bg-danger/5 hover:bg-danger/10' : 'hover:bg-surface'}`}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.invoice_number}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-light">{fmtD(invDateStr)}</td>
                          <td className={`px-4 py-3 font-mono text-xs ${isOverdue ? 'text-danger font-semibold' : 'text-ink-light'}`}>
                            {dueDateStr ? fmtD(dueDateStr) : <span className="text-ink-light">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(inv.grand_total)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-success">
                            {inv.amount_paid > 0 ? formatCurrency(inv.amount_paid) : <span className="text-ink-light">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-danger">{formatCurrency(inv.unpaid)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {isOverdue
                              ? <span className="text-danger font-bold">{overdueDays}d overdue</span>
                              : overdueDays === 0
                              ? <span className="text-warning font-semibold">Due today</span>
                              : <span className="text-ink-light">Not due</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Balance due summary (screen) */}
            {closingBalance !== 0 && (
              <div className="flex justify-end">
                <div className="brutal-border p-4 min-w-[280px] text-right">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">
                    {closingBalance > 0 ? 'Balance Due' : 'Credit in Customer\'s Favour'}
                  </div>
                  <div className={`font-mono font-bold text-2xl ${closingBalance > 0 ? 'text-danger' : 'text-success'}`}>
                    {formatCurrency(Math.abs(closingBalance))}
                  </div>
                  <div className="text-[10px] font-mono text-ink-light mt-1 italic">
                    {amountInWords(Math.abs(closingBalance))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
