import React, { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronDown, ChevronUp, RotateCcw, MessageCircle, Printer, Check, Clock, X, AlertTriangle } from 'lucide-react'
import { invoiceService, ledgerService, companyProfileService } from '../services/api'
import type { InvoiceAllocationDetail, CompanyProfile } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'
import { amountInWords, isInterStateTx, stateFromGSTIN } from '../lib/printUtils'

interface InvoiceLineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  discount_amount: number
  discount_type: string
  total: number
  quantity_returned: number
  gst_rate?: number
  hsn_sac_code?: string
}

interface ReturnLineItem {
  item_id: number
  item_name: string
  quantity_returned: number
  amount: number
  reason: string | null
  reason_category: string | null
}

interface ReturnRecord {
  id: number
  return_date: string
  total_credit: number
  is_partial: boolean
  notes: string | null
  items_returned_count: number
  total_items_in_invoice: number
  line_items: ReturnLineItem[]
}

interface InvoiceDetail {
  id: number
  invoice_number: string
  invoice_date: string
  due_date?: string
  customer_id: number
  customer_name: string
  customer_type: string
  customer_gstin?: string
  customer_address?: string
  customer_phone?: string
  discount_type: string
  discount_amount: number
  tax_rate: number
  sub_total: number
  total_tax_amount: number
  grand_total: number
  amount_paid: number
  payment_status: string
  po_number?: string
  notes: string
  line_items: InvoiceLineItem[]
  returns: ReturnRecord[]
}

const REASON_LABELS: Record<string, string> = {
  damaged_goods: 'Damaged Goods',
  was_not_able_to_pay: 'Unable to Pay',
  was_not_able_to_sell: 'Unable to Sell',
  found_a_better_deal: 'Better Deal',
  quality_issue: 'Quality Issue',
  wrong_item_delivered: 'Wrong Item',
  other: 'Other',
}

// API returns enum values: "paid" | "partial" | "unpaid"
const statusStyles: Record<string, React.CSSProperties> = {
  paid:    { color: 'var(--color-success)', borderColor: 'var(--color-success)' },
  partial: { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' },
  unpaid:  { color: 'var(--color-danger)',  borderColor: 'var(--color-danger)'  },
}

const statusIcon: Record<string, React.ReactNode> = {
  paid:    <Check className="w-3 h-3" />,
  partial: <Clock className="w-3 h-3" />,
  unpaid:  <X className="w-3 h-3" />,
}

const statusLabel: Record<string, string> = {
  paid:    'Paid',
  partial: 'Partial',
  unpaid:  'Unpaid',
}

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const { formatCurrency } = useSettings()
  const [showAllocations, setShowAllocations] = useState(false)
  const [showReturns, setShowReturns] = useState(false)
  const [showOriginalBill, setShowOriginalBill] = useState(false)
  const [printTemplate, setPrintTemplate] = useState<'gst' | 'receipt'>('gst')

  const { data: invoice, isLoading, error } = useQuery<InvoiceDetail>({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoiceService.getDetail(Number(invoiceId)),
    enabled: !!invoiceId,
  })

  const { data: allocations, isLoading: isLoadingAllocations } = useQuery<InvoiceAllocationDetail[]>({
    queryKey: ['invoiceAllocations', invoiceId],
    queryFn: () => ledgerService.getInvoiceAllocations(Number(invoiceId)),
    enabled: !!invoiceId && showAllocations,
  })

  const { data: companyProfile } = useQuery<CompanyProfile>({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileService.get(),
  })

  if (isLoading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="space-y-8 pb-12">
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-danger mb-2">
            {error ? 'Error Loading Invoice' : 'Invoice Not Found'}
          </p>
          {error && (
            <p className="font-mono text-xs text-ink-light mb-6">
              {(error as Error).message || 'Failed to load invoice details'}
            </p>
          )}
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const unpaid = invoice.grand_total - invoice.amount_paid

  const handleWhatsAppShare = () => {
    const dateStr = new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    const itemLines = invoice.line_items
      .map(li => `  • ${li.item_name} × ${li.quantity} = ${formatCurrency(li.total)}`)
      .join('\n')
    const shopName = companyProfile?.shop_name || 'Our Store'
    const taxLines: string[] = []
    if (hasPerItemRates) {
      perRateTaxEntries.forEach(([rate, { tax }]) => {
        if (Number(rate) > 0) {
          taxLines.push(`CGST (${(Number(rate) / 2).toFixed(1)}%): ${formatCurrency(tax / 2)}`)
          taxLines.push(`SGST (${(Number(rate) / 2).toFixed(1)}%): ${formatCurrency(tax / 2)}`)
        }
      })
    } else if ((invoice.tax_rate ?? 0) > 0) {
      const taxHalf = invoice.total_tax_amount / 2
      taxLines.push(`CGST (${((invoice.tax_rate ?? 0) / 2).toFixed(1)}%): ${formatCurrency(taxHalf)}`)
      taxLines.push(`SGST (${((invoice.tax_rate ?? 0) / 2).toFixed(1)}%): ${formatCurrency(taxHalf)}`)
    }

    const lines = [
      `*INVOICE: ${invoice.invoice_number}*`,
      `From: ${shopName}`,
      `To: ${invoice.customer_name}`,
      `Date: ${dateStr}`,
      ``,
      `*Items:*`,
      itemLines,
      ``,
      `Sub Total: ${formatCurrency(invoice.sub_total)}`,
      invoice.discount_amount > 0 ? `Discount: -${formatCurrency(invoice.discount_amount)}` : null,
      ...taxLines,
      `*Grand Total: ${formatCurrency(invoice.grand_total)}*`,
      invoice.amount_paid > 0 ? `Paid: ${formatCurrency(invoice.amount_paid)}` : null,
      unpaid > 0
        ? `*Outstanding: ${formatCurrency(unpaid)}*`
        : `*Status: PAID*`,
    ].filter(line => line !== null).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank')
  }

  const upiQrUrl = companyProfile?.upi_id && unpaid > 0
    ? `https://chart.googleapis.com/chart?chs=160x160&cht=qr&chl=${encodeURIComponent(
        `upi://pay?pa=${companyProfile.upi_id}&pn=${encodeURIComponent(companyProfile.shop_name)}&am=${unpaid.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.invoice_number)}`
      )}`
    : null

  // ── Print helpers ──────────────────────────────────────────────────────────
  const doPrint = useCallback((template: 'gst' | 'receipt') => {
    setPrintTemplate(template)
    // Let React re-render the template before printing
    setTimeout(() => window.print(), 80)
  }, [])

  // IGST vs CGST+SGST determination
  const interState = isInterStateTx(companyProfile?.shop_gstin, invoice.customer_gstin)
  const buyerState = stateFromGSTIN(invoice.customer_gstin)
  const amtWords = amountInWords(invoice.grand_total)

  // Warning: routing is uncertain when GSTINs are missing (only relevant for GST invoices)
  const isRetailCustomer = invoice.customer_type === 'Retail' || invoice.customer_name === 'Walk-in Customer'
  const igstWarning = !companyProfile?.shop_gstin
    ? 'Shop GSTIN is not set in Company Profile — tax type defaulted to Intra-State (CGST+SGST). Add your GSTIN to enable correct IGST routing for inter-state sales.'
    : !isRetailCustomer && !invoice.customer_gstin
    ? 'Customer GSTIN is not recorded — tax type defaulted to Intra-State (CGST+SGST). Add the customer\'s GSTIN to determine correct inter/intra-state routing.'
    : null

  const printDateStr = new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const printStatusColor = invoice.payment_status === 'paid' ? '#16a34a' : invoice.payment_status === 'partial' ? '#d97706' : '#dc2626'
  const totalReturnsCredit = invoice.returns?.reduce((s, r) => s + r.total_credit, 0) ?? 0
  const netAfterReturns = invoice.grand_total - totalReturnsCredit
  const hasBankDetails = companyProfile?.receiver_bank_name || companyProfile?.receiver_account_number

  // Compute per-rate CGST/SGST breakdown from line items
  const hasPerItemRates = invoice.line_items.some(li => li.gst_rate != null)
  const perRateTax: Record<number, { taxable: number; tax: number; hsn: string[] }> = {}
  if (hasPerItemRates) {
    const discountRatio = invoice.sub_total > 0 ? (invoice.discount_amount ?? 0) / invoice.sub_total : 0
    for (const li of invoice.line_items) {
      const lineTaxable = li.total * (1 - discountRatio)
      const rate = li.gst_rate ?? 0
      const lineTax = lineTaxable * (rate / 100)
      if (!perRateTax[rate]) perRateTax[rate] = { taxable: 0, tax: 0, hsn: [] }
      perRateTax[rate].taxable += lineTaxable
      perRateTax[rate].tax += lineTax
      if (li.hsn_sac_code && !perRateTax[rate].hsn.includes(li.hsn_sac_code)) {
        perRateTax[rate].hsn.push(li.hsn_sac_code)
      }
    }
  }
  const perRateTaxEntries = Object.entries(perRateTax).sort(([a], [b]) => Number(a) - Number(b))
  return (
    <>
    {/* ── GST Tax Invoice print template ───────────────────────── */}
    <div className={printTemplate === 'gst' ? 'hidden print:block' : 'hidden'} style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: '#fff', padding: '0' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#111', lineHeight: 1.2 }}>{companyProfile?.shop_name || 'RetailPilot'}</div>
          {companyProfile?.shop_address && <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>{companyProfile.shop_address}</div>}
          {companyProfile?.shop_phone && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Phone: {companyProfile.shop_phone}</div>}
          {companyProfile?.shop_gstin && <div style={{ fontSize: '12px', color: '#111', fontWeight: 'bold', marginTop: '2px' }}>GSTIN: {companyProfile.shop_gstin}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#888', textTransform: 'uppercase', marginBottom: '2px' }}>Tax Invoice</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d97706', letterSpacing: '-0.5px', lineHeight: 1 }}>INVOICE</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111', marginTop: '6px' }}>{invoice.invoice_number}</div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Date: {printDateStr}</div>
          {invoice.due_date && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Due: {new Date(invoice.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
          {invoice.po_number && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>PO: {invoice.po_number}</div>}
        </div>
      </div>

      {/* Orange divider */}
      <div style={{ height: '3px', background: '#d97706', margin: '10px 0 14px' }} />

      {/* Bill To + Status + Place of Supply */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Bill To</div>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#111' }}>{invoice.customer_name}</div>
          <div style={{ fontSize: '12px', color: '#d97706', marginTop: '2px' }}>{invoice.customer_type}</div>
          {invoice.customer_address && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{invoice.customer_address}</div>}
          {invoice.customer_phone && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Ph: {invoice.customer_phone}</div>}
          {invoice.customer_gstin && <div style={{ fontSize: '12px', color: '#111', fontWeight: 'bold', marginTop: '2px' }}>GSTIN: {invoice.customer_gstin}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {buyerState && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Place of Supply</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#111' }}>{buyerState}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Tax Type</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: interState ? '#2563eb' : '#111' }}>
              {interState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}
            </div>
          </div>
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Status</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: printStatusColor }}>{statusLabel[invoice.payment_status]?.toUpperCase() ?? invoice.payment_status.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* Line items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', width: '32px' }}>#</th>
            <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', width: '60px' }}>Qty</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px' }}>Unit Price</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px' }}>Discount</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.map((li, idx) => (
            <tr key={li.item_id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '9px 4px', fontSize: '13px', color: '#d97706', fontWeight: 'bold' }}>{idx + 1}</td>
              <td style={{ padding: '9px 4px', fontSize: '13px', color: '#111' }}>
                {li.item_name}
                {li.hsn_sac_code && <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>HSN: {li.hsn_sac_code}</div>}
              </td>
              <td style={{ padding: '9px 4px', textAlign: 'right', fontSize: '13px', color: '#111' }}>{li.quantity}</td>
              <td style={{ padding: '9px 4px', textAlign: 'right', fontSize: '13px', color: '#111' }}>{formatCurrency(li.price)}</td>
              <td style={{ padding: '9px 4px', textAlign: 'right', fontSize: '13px', color: '#111' }}>
                {(li.discount_amount ?? 0) > 0 ? `-${formatCurrency(li.discount_amount ?? 0)}` : '-'}
              </td>
              <td style={{ padding: '9px 4px', textAlign: 'right', fontSize: '13px', color: '#111', fontWeight: '600' }}>{formatCurrency(li.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals box */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <div style={{ width: '260px', border: '1px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
            <span style={{ color: '#555' }}>Subtotal</span>
            <span style={{ color: '#111' }}>{formatCurrency(invoice.sub_total)}</span>
          </div>
          {invoice.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#555' }}>Discount ({invoice.discount_type ?? 'amount'})</span>
              <span style={{ color: '#111' }}>-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          {hasPerItemRates ? perRateTaxEntries.map(([rate, { tax }]) => Number(rate) > 0 ? (
            <React.Fragment key={rate}>
              {interState ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#555' }}>IGST ({Number(rate).toFixed(1)}%)</span>
                  <span style={{ color: '#111' }}>{formatCurrency(tax)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                    <span style={{ color: '#555' }}>CGST ({(Number(rate) / 2).toFixed(1)}%)</span>
                    <span style={{ color: '#111' }}>{formatCurrency(tax / 2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                    <span style={{ color: '#555' }}>SGST ({(Number(rate) / 2).toFixed(1)}%)</span>
                    <span style={{ color: '#111' }}>{formatCurrency(tax / 2)}</span>
                  </div>
                </>
              )}
            </React.Fragment>
          ) : null) : (invoice.tax_rate ?? 0) > 0 && (
            interState ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                <span style={{ color: '#555' }}>IGST ({(invoice.tax_rate ?? 0).toFixed(1)}%)</span>
                <span style={{ color: '#111' }}>{formatCurrency(invoice.total_tax_amount)}</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#555' }}>CGST ({((invoice.tax_rate ?? 0) / 2).toFixed(1)}%)</span>
                  <span style={{ color: '#111' }}>{formatCurrency(invoice.total_tax_amount / 2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#555' }}>SGST ({((invoice.tax_rate ?? 0) / 2).toFixed(1)}%)</span>
                  <span style={{ color: '#111' }}>{formatCurrency(invoice.total_tax_amount / 2)}</span>
                </div>
              </>
            )
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>
            <span style={{ color: '#111' }}>Grand Total</span>
            <span style={{ color: '#d97706' }}>{formatCurrency(invoice.grand_total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: totalReturnsCredit > 0 ? '1px solid #eee' : 'none' }}>
            <span style={{ color: '#555' }}>Amount Paid</span>
            <span style={{ color: '#111' }}>{formatCurrency(invoice.amount_paid ?? 0)}</span>
          </div>
          {totalReturnsCredit > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', borderBottom: '1px solid #eee' }}>
                <span style={{ color: '#555' }}>Returns Credit</span>
                <span style={{ color: '#d97706' }}>-{formatCurrency(totalReturnsCredit)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: '14px', fontWeight: 'bold' }}>
                <span style={{ color: '#111' }}>Net After Returns</span>
                <span style={{ color: netAfterReturns <= 0 ? '#16a34a' : '#d97706' }}>
                  {netAfterReturns <= 0 ? 'Fully Credited' : formatCurrency(netAfterReturns)}
                </span>
              </div>
            </>
          )}
          {unpaid > 0 && totalReturnsCredit === 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '13px', fontWeight: 'bold', borderTop: '1px solid #eee' }}>
              <span style={{ color: '#555' }}>Outstanding</span>
              <span style={{ color: '#dc2626' }}>{formatCurrency(unpaid)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Amount in Words */}
      <div style={{ borderLeft: '3px solid #d97706', paddingLeft: '12px', marginBottom: '16px', background: '#fffbf0', padding: '8px 12px' }}>
        <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount in Words: </span>
        <span style={{ fontSize: '12px', color: '#111', fontWeight: '600' }}>{amtWords}</span>
      </div>

      {/* HSN-wise Tax Summary (print only, only if per-item rates exist) */}
      {hasPerItemRates && perRateTaxEntries.some(([r]) => Number(r) > 0) && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '6px' }}>
            GST Tax Summary
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', color: '#666' }}>HSN/SAC</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', color: '#666' }}>GST %</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', color: '#666' }}>Taxable Amt</th>
                {interState ? (
                  <th style={{ padding: '5px 8px', textAlign: 'right', color: '#2563eb' }}>IGST</th>
                ) : (
                  <>
                    <th style={{ padding: '5px 8px', textAlign: 'right', color: '#666' }}>CGST</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right', color: '#666' }}>SGST</th>
                  </>
                )}
                <th style={{ padding: '5px 8px', textAlign: 'right', color: '#666' }}>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {perRateTaxEntries.filter(([r]) => Number(r) > 0).map(([rate, { taxable, tax, hsn }]) => (
                <tr key={rate} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '5px 8px', color: '#444' }}>{hsn.length > 0 ? hsn.join(', ') : '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#444' }}>{rate}%</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#444' }}>{formatCurrency(taxable)}</td>
                  {interState ? (
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#2563eb', fontWeight: 'bold' }}>{formatCurrency(tax)}</td>
                  ) : (
                    <>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#444' }}>{formatCurrency(tax / 2)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#444' }}>{formatCurrency(tax / 2)}</td>
                    </>
                  )}
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', color: '#111' }}>{formatCurrency(tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div style={{ borderLeft: '3px solid #d97706', paddingLeft: '12px', marginBottom: '24px' }}>
          <span style={{ fontSize: '13px', color: '#111' }}><strong>Notes:</strong> {invoice.notes}</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '1px solid #ddd', paddingTop: '16px', marginTop: '16px' }}>
        {hasBankDetails ? (
          <div>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '8px' }}>Bank Details</div>
            {companyProfile?.receiver_bank_name && <div style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>Bank: {companyProfile.receiver_bank_name}</div>}
            {companyProfile?.receiver_account_number && <div style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>Account: {companyProfile.receiver_account_number}</div>}
            {companyProfile?.receiver_ifsc_code && <div style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>IFSC: {companyProfile.receiver_ifsc_code}</div>}
            {companyProfile?.upi_id && <div style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>UPI: {companyProfile.upi_id}</div>}
          </div>
        ) : <div />}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '40px' }}>Authorised Signatory</div>
          <div style={{ borderTop: '1px solid #999', paddingTop: '4px', minWidth: '160px' }}>
            <div style={{ fontSize: '12px', color: '#555' }}>{companyProfile?.shop_name || 'Shop'}</div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Receipt / Cash Memo print template ───────────────────── */}
    <div className={printTemplate === 'receipt' ? 'hidden print:block' : 'hidden'} style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: '#fff', padding: '0', maxWidth: '380px', margin: '0 auto' }}>
      {/* Shop name */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111' }}>{companyProfile?.shop_name || 'RetailPilot'}</div>
        {companyProfile?.shop_address && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{companyProfile.shop_address}</div>}
        {companyProfile?.shop_phone && <div style={{ fontSize: '11px', color: '#555' }}>Ph: {companyProfile.shop_phone}</div>}
        {companyProfile?.shop_gstin && <div style={{ fontSize: '11px', color: '#555' }}>GSTIN: {companyProfile.shop_gstin}</div>}
      </div>
      <div style={{ borderTop: '2px dashed #ccc', borderBottom: '2px dashed #ccc', padding: '6px 0', textAlign: 'center', margin: '8px 0' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '3px' }}>CASH MEMO / RECEIPT</div>
      </div>
      {/* Meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '8px' }}>
        <span>No: <strong style={{ color: '#111' }}>{invoice.invoice_number}</strong></span>
        <span>Date: <strong style={{ color: '#111' }}>{printDateStr}</strong></span>
      </div>
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px' }}>
        Customer: <strong style={{ color: '#111' }}>{invoice.customer_name}</strong>
        {invoice.customer_phone && ` · Ph: ${invoice.customer_phone}`}
      </div>
      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '8px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '4px 2px', textAlign: 'left', color: '#888', fontWeight: 'normal' }}>Item</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', color: '#888', fontWeight: 'normal', width: '36px' }}>Qty</th>
            <th style={{ padding: '4px 2px', textAlign: 'right', color: '#888', fontWeight: 'normal', width: '70px' }}>Rate</th>
            <th style={{ padding: '4px 2px', textAlign: 'right', color: '#888', fontWeight: 'normal', width: '72px' }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.map((li) => (
            <tr key={li.item_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '5px 2px', fontSize: '12px' }}>
                {li.item_name}
                {(li.discount_amount ?? 0) > 0 && (
                  <span style={{ fontSize: '10px', color: '#888' }}> (disc -₹{li.discount_amount})</span>
                )}
              </td>
              <td style={{ padding: '5px 2px', textAlign: 'center' }}>{li.quantity}</td>
              <td style={{ padding: '5px 2px', textAlign: 'right' }}>{formatCurrency(li.price)}</td>
              <td style={{ padding: '5px 2px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(li.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Totals */}
      <div style={{ borderTop: '1px dashed #ccc', paddingTop: '6px' }}>
        {invoice.discount_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
            <span style={{ color: '#555' }}>Discount</span><span>-{formatCurrency(invoice.discount_amount)}</span>
          </div>
        )}
        {invoice.total_tax_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
            <span style={{ color: '#555' }}>Tax</span><span>{formatCurrency(invoice.total_tax_amount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '5px', marginTop: '5px' }}>
          <span>Total</span><span style={{ color: '#d97706' }}>{formatCurrency(invoice.grand_total)}</span>
        </div>
        {invoice.amount_paid > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px', color: '#555' }}>
            <span>Paid ({invoice.payment_status})</span><span>{formatCurrency(invoice.amount_paid)}</span>
          </div>
        )}
        {unpaid > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px', color: '#dc2626', fontWeight: 'bold' }}>
            <span>Balance Due</span><span>{formatCurrency(unpaid)}</span>
          </div>
        )}
      </div>
      {/* Amount in words */}
      <div style={{ fontSize: '10px', color: '#555', marginTop: '8px', fontStyle: 'italic' }}>
        {amtWords}
      </div>
      {/* Footer */}
      <div style={{ borderTop: '2px dashed #ccc', marginTop: '12px', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#777' }}>
        {companyProfile?.upi_id && <div>Pay via UPI: {companyProfile.upi_id}</div>}
        <div style={{ marginTop: '4px' }}>Thank you for your purchase!</div>
        {invoice.notes && <div style={{ marginTop: '4px', color: '#555' }}>{invoice.notes}</div>}
      </div>
    </div>

    {/* ── Screen layout ────────────────────────────────────────── */}
    <div className="space-y-8 pb-12 print:hidden">

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
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="type-heading"
            >
              Invoice Details
            </motion.h1>
            <p className="font-mono text-sm text-ink-light mt-1">{invoice.invoice_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#25D366] text-[#25D366] font-mono text-xs uppercase tracking-widest hover:bg-[#25D366] hover:text-white transition-all brutal-focus print:hidden"
              title="Share on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button
              onClick={() => doPrint('gst')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-400 dark:border-zinc-600 font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface hover:border-ink transition-all brutal-focus print:hidden"
              title="Print GST Tax Invoice"
            >
              <Printer className="w-3.5 h-3.5" />
              GST Invoice
            </button>
            <button
              onClick={() => doPrint('receipt')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-400 dark:border-zinc-600 font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface hover:border-ink transition-all brutal-focus print:hidden"
              title="Print simple receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              Receipt
            </button>
            <span
              className="border flex items-center gap-1 px-3 py-1.5 font-mono text-xs uppercase tracking-widest font-bold"
              style={statusStyles[invoice.payment_status] ?? { color: 'var(--color-ink-light)', borderColor: 'var(--color-line)' }}
            >
              {statusIcon[invoice.payment_status]}
              {statusLabel[invoice.payment_status] ?? invoice.payment_status}
            </span>
          </div>
        </div>
        <div className="w-16 h-0.5 bg-accent mt-4" />
      </header>

      {/* IGST routing warning — screen only, not printed */}
      {igstWarning && (
        <div className="flex items-start gap-3 border border-amber-500/60 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            <span className="font-bold uppercase tracking-widest">Tax Routing Uncertain — </span>
            {igstWarning}
          </p>
        </div>
      )}

      {/* Invoice Metadata */}
      <div className="brutal-border bg-surface p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-line">
          <div className="px-4 py-4 first:pl-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Customer</div>
            <div className="font-display font-bold text-base">{invoice.customer_name}</div>
            <div className="font-mono text-xs text-ink-light">{invoice.customer_type}</div>
          </div>
          <div className="px-4 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Invoice Date</div>
            <div className="font-mono font-bold text-base">
              {new Date(invoice.invoice_date).toLocaleDateString()}
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Grand Total</div>
            <div className="font-display font-bold text-2xl text-accent">
              {formatCurrency(invoice.grand_total)}
            </div>
          </div>
          <div className="px-4 py-4 last:pr-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Amount Paid</div>
            <div className="font-display font-bold text-xl text-success">
              {formatCurrency(invoice.amount_paid)}
            </div>
            {unpaid > 0 && (
              <div className="font-mono text-xs text-warning mt-1">
                Outstanding: {formatCurrency(unpaid)}
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-line mt-4 pt-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Notes</div>
            <div className="font-mono text-sm text-ink">{invoice.notes}</div>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="brutal-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface print:bg-gray-100 print:text-gray-900">
          <span className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
            Line Items
            {invoice.returns?.length > 0 && (
              <span className={cn('font-normal print:hidden', showOriginalBill ? 'text-amber-400/80' : 'text-blue-400/80')}>
                — {showOriginalBill ? 'Original Bill' : 'Updated Bill'}
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {invoice.returns?.length > 0 && (
              <button
                onClick={() => setShowOriginalBill(!showOriginalBill)}
                className={cn(
                  'font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border transition-all brutal-focus flex items-center gap-1 print:hidden',
                  showOriginalBill
                    ? 'border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white'
                    : 'border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white'
                )}
              >
                <RotateCcw className="w-3 h-3" />
                {showOriginalBill ? 'Show Updated' : 'Show Original'}
              </button>
            )}
            <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60 print:text-gray-500">
              {invoice.line_items.length} items
            </span>
          </div>
        </div>

        {invoice.line_items.length > 0 ? (
          <>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="min-w-[700px] w-full print:min-w-0">
                <thead>
                  <tr className="bg-surface text-ink-light border-b border-line">
                    <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Item</th>
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Qty</th>
                    {!showOriginalBill && (
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-warning">Returned</th>
                    )}
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Price</th>
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Discount</th>
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoice.line_items.map((item) => {
                    const fullyReturned = !showOriginalBill && item.quantity_returned >= item.quantity
                    return (
                      <tr
                        key={item.item_id}
                        className={cn(
                          'transition-colors',
                          fullyReturned ? 'opacity-40 bg-paper' : 'hover:bg-paper',
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-bold">
                          <span className={fullyReturned ? 'line-through' : ''}>
                            {item.item_name || 'Unknown Item'}
                          </span>
                          {fullyReturned && (
                            <span className="ml-2 text-[10px] font-normal text-warning uppercase tracking-widest">[returned]</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-ink-light">{item.quantity}</td>
                        {!showOriginalBill && (
                          <td className="px-4 py-3 text-right font-mono text-sm">
                            {item.quantity_returned > 0
                              ? <span className="text-warning font-bold">-{item.quantity_returned}</span>
                              : <span className="opacity-30">—</span>
                            }
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-ink-light">
                          {item.discount_amount > 0
                            ? `${formatCurrency(item.discount_amount)} (${item.discount_type})`
                            : <span className="opacity-40">—</span>
                          }
                        </td>
                        <td className={cn('px-4 py-3 text-right font-mono text-sm font-bold', fullyReturned && 'line-through')}>
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-line p-4 bg-paper">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                {upiQrUrl && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light">Pay via UPI</div>
                    <img src={upiQrUrl} alt="UPI QR Code" className="w-28 h-28 brutal-border" />
                    <div className="font-mono text-[10px] text-ink-light">{companyProfile?.upi_id}</div>
                  </div>
                )}
                <div className={cn('w-full max-w-xs space-y-2', !upiQrUrl && 'ml-auto')}>
                  <div className="flex justify-between font-mono text-sm text-ink-light">
                    <span>Sub Total</span>
                    <span>{formatCurrency(invoice.sub_total)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-sm text-ink-light">
                    <span>Discount ({invoice.discount_type})</span>
                    <span>-{formatCurrency(invoice.discount_amount)}</span>
                  </div>
                  {hasPerItemRates ? perRateTaxEntries.map(([rate, { tax }]) => Number(rate) > 0 ? (
                    <React.Fragment key={rate}>
                      <div className="flex justify-between font-mono text-sm text-ink-light">
                        <span>CGST ({(Number(rate) / 2).toFixed(1)}%)</span>
                        <span>{formatCurrency(tax / 2)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-sm text-ink-light">
                        <span>SGST ({(Number(rate) / 2).toFixed(1)}%)</span>
                        <span>{formatCurrency(tax / 2)}</span>
                      </div>
                    </React.Fragment>
                  ) : null) : (invoice.tax_rate ?? 0) > 0 ? (
                    <>
                      <div className="flex justify-between font-mono text-sm text-ink-light">
                        <span>CGST ({((invoice.tax_rate ?? 0) / 2).toFixed(1)}%)</span>
                        <span>{formatCurrency(invoice.total_tax_amount / 2)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-sm text-ink-light">
                        <span>SGST ({((invoice.tax_rate ?? 0) / 2).toFixed(1)}%)</span>
                        <span>{formatCurrency(invoice.total_tax_amount / 2)}</span>
                      </div>
                    </>
                  ) : invoice.total_tax_amount > 0 ? (
                    <div className="flex justify-between font-mono text-sm text-ink-light">
                      <span>Tax</span>
                      <span>{formatCurrency(invoice.total_tax_amount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-line pt-2 font-mono font-bold text-base">
                    <span>Grand Total</span>
                    <span className={cn('text-xl', invoice.returns?.length > 0 && !showOriginalBill ? 'text-ink-light line-through opacity-60' : 'text-accent')}>
                      {formatCurrency(invoice.grand_total)}
                    </span>
                  </div>
                  {invoice.returns?.length > 0 && !showOriginalBill && (() => {
                    const totalReturnsCredit = invoice.returns.reduce((s, r) => s + r.total_credit, 0)
                    const netTotal = invoice.grand_total - totalReturnsCredit
                    return (
                      <>
                        <div className="flex justify-between font-mono text-sm text-warning">
                          <span className="flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Returns Credit
                          </span>
                          <span>-{formatCurrency(totalReturnsCredit)}</span>
                        </div>
                        <div className="flex justify-between border-t border-line pt-2 font-mono font-bold text-base">
                          <span>Net After Returns</span>
                          <span className={cn('text-xl', netTotal <= 0 ? 'text-success' : 'text-accent')}>
                            {netTotal <= 0 ? 'Fully Credited' : formatCurrency(netTotal)}
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-16 text-center">
            <p className="font-mono text-sm uppercase tracking-widest text-ink-light">No line items found</p>
          </div>
        )}
      </div>

      {/* Allocations */}
      <div className="brutal-border bg-surface overflow-hidden print:hidden">
        <button
          onClick={() => setShowAllocations(!showAllocations)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface hover:bg-ink/90 transition-colors brutal-focus"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest">Payment Allocations</span>
          {showAllocations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAllocations && (
          <div>
            {isLoadingAllocations ? (
              <div className="p-12 text-center">
                <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading allocations...</p>
              </div>
            ) : allocations && allocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[500px] w-full">
                  <thead>
                    <tr className="bg-surface text-ink-light border-b border-line">
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Payment Date</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Payment ID</th>
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Amount</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {allocations.map((allocation) => (
                      <tr key={allocation.id} className="hover:bg-paper transition-colors">
                        <td className="px-4 py-3 font-mono text-sm text-ink-light">
                          {new Date(allocation.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">#{allocation.payment_id}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-success">
                          {formatCurrency(allocation.allocated_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-ink-light">
                          {allocation.notes || <span className="opacity-40">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="font-mono text-sm uppercase tracking-widest text-ink-light">No allocations for this invoice</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Returns */}
      {invoice.returns?.length > 0 && (
        <div className="brutal-border bg-surface overflow-hidden print:hidden">
          <button
            onClick={() => setShowReturns(!showReturns)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-line bg-warning/10 text-ink hover:bg-warning/20 transition-colors brutal-focus"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
              <RotateCcw className="w-3 h-3 text-warning" />
              Returns ({invoice.returns.length})
            </span>
            {showReturns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showReturns && (
            <div className="divide-y divide-line">
              {invoice.returns.map((ret, idx) => (
                <div key={ret.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider">
                      Return #{idx + 1}
                    </span>
                    <span className="font-mono text-xs text-ink-light">
                      {new Date(ret.return_date).toLocaleDateString()}
                    </span>
                    <span className={cn(
                      'font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border',
                      ret.is_partial ? 'border-warning text-warning' : 'border-danger text-danger'
                    )}>
                      {ret.is_partial ? 'Partial Return' : 'Full Return'}
                    </span>
                    <span className="font-mono text-xs font-bold text-warning ml-auto">
                      Credit: {formatCurrency(ret.total_credit)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[400px] w-full text-sm">
                      <thead>
                        <tr className="text-ink-light border-b border-line">
                          <th className="pb-2 text-left text-[10px] font-mono uppercase tracking-widest">Item</th>
                          <th className="pb-2 text-right text-[10px] font-mono uppercase tracking-widest">Qty Returned</th>
                          <th className="pb-2 text-right text-[10px] font-mono uppercase tracking-widest">Credit</th>
                          <th className="pb-2 text-left text-[10px] font-mono uppercase tracking-widest pl-4">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/50">
                        {ret.line_items.map((rli) => (
                          <tr key={rli.item_id} className="hover:bg-paper transition-colors">
                            <td className="py-2 font-mono text-sm">{rli.item_name}</td>
                            <td className="py-2 text-right font-mono text-sm text-warning font-bold">×{rli.quantity_returned}</td>
                            <td className="py-2 text-right font-mono text-sm">{formatCurrency(rli.amount)}</td>
                            <td className="py-2 font-mono text-xs text-ink-light pl-4">
                              {rli.reason_category ? REASON_LABELS[rli.reason_category] ?? rli.reason_category : (rli.reason || <span className="opacity-40">—</span>)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {ret.notes && (
                    <p className="mt-2 font-mono text-xs text-ink-light border-t border-line/50 pt-2">
                      Note: {ret.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
