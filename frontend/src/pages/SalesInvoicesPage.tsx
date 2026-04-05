import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileText, Plus, X, Printer, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { invoiceService, companyProfileService } from '../services/api'
import type { Invoice, InvoiceListResponse, InvoiceLineItem, CompanyProfile, PaginatedResponse } from '../types/api'
import Pagination from '../components/Pagination'
import ReturnsPanel from './ReturnsPanel'
import { MagneticButton } from '../components/MagneticButton'
import { CreateInvoiceModal } from '../components/CreateInvoiceModal'
import { cn } from '../lib/utils'

const PAGE_SIZE = 20

interface EditLineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  discount_amount: number
  discount_type: string
}

const statusCls = (s: string) => cn(
  'px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border text-center',
  s === 'paid'    && 'bg-success text-on-status border-success',
  s === 'partial' && 'border-warning text-warning',
  s === 'unpaid'  && 'bg-danger text-on-status border-danger',
)

const inputCls = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'
const labelCls = 'block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5'

function SalesInvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    date_from:      searchParams.get('from')     ?? '',
    date_to:        searchParams.get('to')       ?? '',
    invoice_number: searchParams.get('inv')      ?? '',
    customer_name:  searchParams.get('customer') ?? '',
    payment_status: searchParams.get('status')   ?? '',
    overdue_only:   searchParams.get('overdue')  === '1',
  }
  const setFilters = (next: typeof filters) => {
    setSearchParams(p => {
      const n = new URLSearchParams(p)
      next.date_from      ? n.set('from', next.date_from)         : n.delete('from')
      next.date_to        ? n.set('to', next.date_to)             : n.delete('to')
      next.invoice_number ? n.set('inv', next.invoice_number)     : n.delete('inv')
      next.customer_name  ? n.set('customer', next.customer_name) : n.delete('customer')
      next.payment_status ? n.set('status', next.payment_status)  : n.delete('status')
      next.overdue_only   ? n.set('overdue', '1')                 : n.delete('overdue')
      n.set('page', '1')
      return n
    }, { replace: true })
  }

  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'returns' | 'edit'>('details')

  const [editFormData, setEditFormData] = useState({
    invoice_date: '',
    discount_type: 'amount',
    discount_amount: 0,
    tax_rate: 5,
    notes: '',
    line_items: [] as EditLineItem[],
  })

  const page    = parseInt(searchParams.get('page') ?? '1')
  const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })

  const [showCreateModal, setShowCreateModal] = useState(false)

  const queryClient = useQueryClient()

  const { data: invoices, isLoading } = useQuery<PaginatedResponse<InvoiceListResponse>>({
    queryKey: ['invoices', filters, page],
    queryFn: () => invoiceService.list({
      page,
      page_size: PAGE_SIZE,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      invoice_number: filters.invoice_number || undefined,
      customer_name: filters.customer_name || undefined,
      payment_status: filters.payment_status || undefined,
      overdue_only: filters.overdue_only || undefined,
    }),
  })

  const { data: invoiceDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['invoice', selectedInvoice?.id],
    queryFn: () => invoiceService.get(selectedInvoice!.id),
    enabled: !!selectedInvoice?.id && showInvoiceDetail,
  })

  const { data: company } = useQuery<CompanyProfile>({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileService.get(),
  })

  const deleteMutation = useMutation({
    mutationFn: invoiceService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowInvoiceDetail(false)
      setSelectedInvoice(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => invoiceService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', selectedInvoice?.id] })
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      setActiveTab('details')
      alert('Invoice updated successfully!')
    },
    onError: (error: any) => {
      alert(`Error updating invoice: ${error.response?.data?.detail || error.message}`)
    },
  })

  const handleViewInvoice = (invoice: InvoiceListResponse) => {
    setSelectedInvoice({
      id: invoice.id,
      customer_id: invoice.customer_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      line_items: [],
      sub_total: 0,
      total_tax_amount: 0,
      discount_amount: 0,
      grand_total: invoice.total_amount,
      payment_status: invoice.payment_status as 'paid' | 'partial' | 'unpaid',
      created_at: new Date().toISOString(),
    })
    setActiveTab('details')
    setShowInvoiceDetail(true)
  }

  const handleEditInvoice = (invoice: InvoiceListResponse) => {
    if (!invoiceDetail) {
      invoiceService.get(invoice.id).then((detail: Invoice) => {
        setSelectedInvoice(detail)
        setEditFormData({
          invoice_date: format(new Date(detail.invoice_date!), 'yyyy-MM-dd'),
          discount_type: detail.discount_type || 'amount',
          discount_amount: detail.discount_amount || 0,
          tax_rate: detail.tax_rate || 18,
          notes: detail.notes || '',
          line_items: (detail.line_items || []).map((li: InvoiceLineItem) => ({
            item_id: li.item_id || 0,
            item_name: li.item_name || 'Unknown',
            quantity: li.quantity || 0,
            price: li.price || 0,
            discount_amount: li.discount_amount || 0,
            discount_type: li.discount_type || 'amount',
          })),
        })
        setActiveTab('edit')
        setShowInvoiceDetail(true)
      })
    } else {
      setEditFormData({
        invoice_date: format(new Date(invoiceDetail.invoice_date), 'yyyy-MM-dd'),
        discount_type: invoiceDetail.discount_type || 'amount',
        discount_amount: invoiceDetail.discount_amount || 0,
        tax_rate: invoiceDetail.tax_rate || 18,
        notes: invoiceDetail.notes || '',
        line_items: (invoiceDetail.line_items || []).map((li: InvoiceLineItem) => ({
          item_id: li.item_id || 0,
          item_name: li.item_name || 'Unknown',
          quantity: li.quantity || 0,
          price: li.price || 0,
          discount_amount: li.discount_amount || 0,
          discount_type: li.discount_type || 'amount',
        })),
      })
      setActiveTab('edit')
      setShowInvoiceDetail(true)
    }
  }

  const handleCloseModal = () => {
    setShowInvoiceDetail(false)
    setSelectedInvoice(null)
    setActiveTab('details')
  }

  const handleSaveEdit = () => {
    if (!selectedInvoice?.id) return
    updateMutation.mutate({
      id: selectedInvoice.id,
      data: {
        invoice_date: editFormData.invoice_date,
        discount_type: editFormData.discount_type,
        discount_amount: editFormData.discount_amount,
        tax_rate: editFormData.tax_rate,
        notes: editFormData.notes,
        line_items: editFormData.line_items.map(li => ({
          item_id: li.item_id,
          quantity: li.quantity,
          price: li.price,
          discount_amount: li.discount_amount,
          discount_type: li.discount_type,
        })),
      },
    })
  }

  const handleRemoveLineItem = (index: number) => {
    const newItems = [...editFormData.line_items]
    newItems.splice(index, 1)
    setEditFormData({ ...editFormData, line_items: newItems })
  }

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const newItems = [...editFormData.line_items]
    newItems[index] = { ...newItems[index], [field]: value }
    setEditFormData({ ...editFormData, line_items: newItems })
  }

  const handlePrint = () => {
    if (!invoiceDetail) return
    const inv = invoiceDetail as any
    const invoiceNumber = invoiceDetail.invoice_number || `INV-${invoiceDetail.id}`
    const invoiceDate = format(new Date(invoiceDetail.invoice_date!), 'dd MMM yyyy')
    const dueDate = inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : null
    const balanceDue = invoiceDetail.grand_total - (invoiceDetail.amount_paid || 0)
    const shopName = company?.shop_name || 'RetailPilot'
    const lineItemsRows = (invoiceDetail.line_items || []).map((item: InvoiceLineItem, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.item_name || 'Unknown'}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">₹${(item.price || 0).toFixed(2)}</td>
        <td class="right">${item.discount_amount && item.discount_amount > 0 ? `-₹${item.discount_amount.toFixed(2)}` : '-'}</td>
        <td class="right">₹${(item.total || item.quantity * (item.price || 0)).toFixed(2)}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${invoiceNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;padding:32px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #f59e0b}
    .shop-name{font-size:24px;font-weight:800;color:#1a1a2e}
    .shop-details{font-size:12px;color:#4b5563;margin-top:6px;line-height:1.7}
    .invoice-badge{text-align:right}
    .invoice-title{font-size:30px;font-weight:800;color:#f59e0b;letter-spacing:2px}
    .invoice-meta{font-size:12px;color:#6b7280;margin-top:3px}
    .invoice-meta strong{color:#374151}
    .billing{display:flex;gap:32px;margin-bottom:24px}
    .billing-block{flex:1}
    .billing-block h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:6px}
    .customer-name{font-size:15px;font-weight:700;color:#1a1a2e}
    .customer-type{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    thead tr{background:#1e293b;color:#fff}
    thead th{padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
    tbody tr{border-bottom:1px solid #e5e7eb}
    tbody tr:nth-child(even){background:#f9fafb}
    tbody td{padding:9px 12px;font-size:13px;color:#374151}
    .center{text-align:center}.right{text-align:right}
    thead th:nth-child(3){text-align:center}
    thead th:nth-child(4),thead th:nth-child(5),thead th:nth-child(6){text-align:right}
    .totals{display:flex;justify-content:flex-end;margin-bottom:24px}
    .totals-box{width:300px;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden}
    .totals-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:13px;border-bottom:1px solid #e5e7eb}
    .totals-row:last-child{border-bottom:none}
    .totals-row .label{color:#6b7280}
    .grand{background:#1e293b;color:#fff;font-size:15px;font-weight:700}
    .grand .label{color:#d1d5db}
    .balance{background:#fef3c7;font-weight:700;color:#92400e}
    .balance .label{color:#92400e}
    .notes{margin-bottom:20px;padding:10px 14px;background:#f9fafb;border-left:4px solid #f59e0b;border-radius:4px;font-size:12px;color:#4b5563}
    .footer-row{display:flex;gap:32px;padding-top:18px;border-top:2px solid #e5e7eb}
    .footer-block{flex:1}
    .footer-block h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:6px}
    .footer-block p{font-size:12px;color:#4b5563;line-height:1.7}
    .sig-line{margin-top:44px;border-top:1px solid #9ca3af;padding-top:4px;font-size:12px;color:#374151;display:inline-block;min-width:160px}
    .status-badge{display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:700}
    .status-paid{background:#d1fae5;color:#065f46}
    .status-partial{background:#fef3c7;color:#92400e}
    .status-unpaid{background:#fee2e2;color:#991b1b}
    @media print{body{padding:0}@page{margin:16mm;size:A4}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="shop-name">${shopName}</div>
      <div class="shop-details">
        ${company?.shop_address ? company.shop_address + '<br>' : ''}
        ${company?.shop_phone ? 'Phone: ' + company.shop_phone + '<br>' : ''}
        ${company?.shop_gstin ? 'GSTIN: ' + company.shop_gstin : ''}
      </div>
    </div>
    <div class="invoice-badge">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-meta"><strong>${invoiceNumber}</strong></div>
      <div class="invoice-meta">Date: <strong>${invoiceDate}</strong></div>
      ${dueDate ? `<div class="invoice-meta">Due: <strong>${dueDate}</strong></div>` : ''}
      ${inv.po_number ? `<div class="invoice-meta">PO #: <strong>${inv.po_number}</strong></div>` : ''}
    </div>
  </div>
  <div class="billing">
    <div class="billing-block">
      <h3>Bill To</h3>
      <p class="customer-name">${invoiceDetail.customer_name || '-'}</p>
      <p><span class="customer-type">${invoiceDetail.customer_type || 'Retail'}</span></p>
    </div>
    ${inv.shipping_address ? `<div class="billing-block"><h3>Ship To</h3><p>${inv.shipping_address}</p></div>` : ''}
    <div class="billing-block" style="text-align:right">
      <h3>Status</h3>
      <span class="status-badge status-${invoiceDetail.payment_status}">${
        invoiceDetail.payment_status === 'paid' ? 'PAID' :
        invoiceDetail.payment_status === 'partial' ? 'PARTIALLY PAID' : 'UNPAID'
      }</span>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Total</th></tr></thead>
    <tbody>${lineItemsRows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span class="label">Subtotal</span><span>₹${invoiceDetail.sub_total.toFixed(2)}</span></div>
      ${invoiceDetail.discount_amount > 0 ? `<div class="totals-row"><span class="label">Discount</span><span>-₹${invoiceDetail.discount_amount.toFixed(2)}</span></div>` : ''}
      <div class="totals-row"><span class="label">CGST (${((invoiceDetail.tax_rate ?? 0) / 2).toFixed(1)}%)</span><span>₹${(invoiceDetail.total_tax_amount / 2).toFixed(2)}</span></div>
      <div class="totals-row"><span class="label">SGST (${((invoiceDetail.tax_rate ?? 0) / 2).toFixed(1)}%)</span><span>₹${(invoiceDetail.total_tax_amount / 2).toFixed(2)}</span></div>
      <div class="totals-row grand"><span class="label">Grand Total</span><span>₹${invoiceDetail.grand_total.toFixed(2)}</span></div>
      ${(invoiceDetail.amount_paid ?? 0) > 0 ? `<div class="totals-row"><span class="label">Amount Paid</span><span>₹${(invoiceDetail.amount_paid ?? 0).toFixed(2)}</span></div>` : ''}
      ${balanceDue > 0.01 ? `<div class="totals-row balance"><span class="label">Balance Due</span><span>₹${balanceDue.toFixed(2)}</span></div>` : ''}
    </div>
  </div>
  ${invoiceDetail.notes ? `<div class="notes"><strong>Notes:</strong> ${invoiceDetail.notes}</div>` : ''}
  <div class="footer-row">
    ${company?.receiver_bank_name ? `<div class="footer-block"><h4>Bank Details</h4><p>Bank: ${company.receiver_bank_name}<br>${company.receiver_account_number ? 'Account: ' + company.receiver_account_number + '<br>' : ''}${company.receiver_ifsc_code ? 'IFSC: ' + company.receiver_ifsc_code : ''}</p></div>` : ''}
    <div class="footer-block" style="text-align:right"><h4>Authorised Signatory</h4><p><span class="sig-line">${shopName}</span></p></div>
  </div>
</body>
</html>`
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => { printWindow.print() }, 400)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-line pb-6">
        <div>
          <h1 className="type-heading">Sales Invoices</h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">
            {invoices?.total_items ?? 0} invoices total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (filters.date_from) params.set('date_from', filters.date_from)
              if (filters.date_to) params.set('date_to', filters.date_to)
              if (filters.customer_name) params.set('customer_name', filters.customer_name)
              if (filters.payment_status) params.set('payment_status', filters.payment_status)
              if (filters.overdue_only) params.set('overdue_only', 'true')
              window.open(`/api/v1/invoices/export/?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 px-4 py-2.5 font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-hover brutal-focus transition-all"
            title="Export current view as CSV"
          >
            Export CSV
          </button>
          <MagneticButton strength={0.5}>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
            >
              <Plus className="w-4 h-4" /> New Invoice
            </button>
          </MagneticButton>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="brutal-border bg-surface p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className={labelCls}>From</label>
            <input type="date" value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input type="date" value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Invoice #</label>
            <input type="text" placeholder="SEARCH..." value={filters.invoice_number}
              onChange={(e) => setFilters({ ...filters, invoice_number: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Customer</label>
            <input type="text" placeholder="SEARCH..." value={filters.customer_name}
              onChange={(e) => setFilters({ ...filters, customer_name: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={filters.payment_status}
              onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
              className={inputCls}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filters.overdue_only}
                onChange={(e) => setFilters({ ...filters, overdue_only: e.target.checked })}
                className="w-3.5 h-3.5 accent-[var(--theme-accent)]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Overdue Only</span>
            </label>
            <button
              onClick={() => setFilters({ date_from: '', date_to: '', invoice_number: '', customer_name: '', payment_status: '', overdue_only: false })}
              className="px-3 py-2 brutal-border font-mono text-xs uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-light">Loading invoices...</p>
        </div>
      ) : invoices && invoices.data.length > 0 ? (
        <div className="brutal-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-surface text-ink-light border-b border-line">
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Invoice #</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Due Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Total</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.data.map((invoice: InvoiceListResponse) => {
                  const isOverdue = invoice.due_date &&
                    invoice.payment_status !== 'paid' &&
                    new Date(invoice.due_date) < new Date()
                  return (
                    <tr key={invoice.id} className="hover:bg-ink hover:text-surface transition-colors group cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-ink-light group-hover:text-surface/60 shrink-0" />
                          <span className="font-mono font-bold text-sm">{invoice.invoice_number || `INV-${invoice.id}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-ink-light group-hover:text-surface/70">
                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {invoice.due_date ? (
                          <span className={cn(isOverdue ? 'text-danger group-hover:text-surface' : 'text-ink-light group-hover:text-surface/70')}>
                            {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                            {isOverdue && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-danger text-on-status font-mono uppercase">Overdue</span>}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{invoice.customer_name}</div>
                        {invoice.customer_type && (
                          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-light group-hover:text-surface/60">{invoice.customer_type}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                        ₹{invoice.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(statusCls(invoice.payment_status), 'group-hover:bg-transparent group-hover:text-surface group-hover:border-surface/40')}>
                          {invoice.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewInvoice(invoice) }}
                            className="px-3 py-1.5 border border-transparent font-mono text-xs uppercase tracking-wider hover:bg-surface hover:text-ink hover:border-line hover:scale-105 group-hover:border-surface/40 group-hover:text-surface transition-all brutal-focus"
                            title="View"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice) }}
                            className="p-1.5 border border-transparent hover:bg-surface hover:text-ink hover:border-line hover:scale-105 group-hover:border-surface/40 group-hover:text-surface transition-all brutal-focus"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(invoice.id) }}
                            className="p-1.5 border border-transparent hover:bg-danger hover:text-on-status hover:scale-110 group-hover:border-surface/40 group-hover:text-surface transition-all brutal-focus"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={invoices?.total_pages ?? 1}
            totalItems={invoices?.total_items ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="brutal-border bg-surface p-16 text-center">
          <FileText className="w-10 h-10 text-ink-muted mx-auto mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest text-ink-light">No invoices found</p>
        </div>
      )}

      {/* ── Create Invoice Modal ─────────────────────────────────────────── */}
      <CreateInvoiceModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />


      {/* ── Invoice Detail / Edit Modal ──────────────────────────────────── */}
      {showInvoiceDetail && invoiceDetail && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
          <div className="brutal-border bg-surface w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tighter">
                  {invoiceDetail.invoice_number || `INV-${invoiceDetail.id}`}
                </h2>
                <p className="font-mono text-xs text-surface/60 uppercase tracking-widest mt-0.5">
                  {format(new Date(invoiceDetail.invoice_date!), 'dd MMM yyyy')}
                  {(invoiceDetail as any).due_date && (
                    <span className={cn('ml-3', (invoiceDetail as any).payment_status !== 'paid' && new Date((invoiceDetail as any).due_date) < new Date() ? 'text-danger' : '')}>
                      / Due: {format(new Date((invoiceDetail as any).due_date), 'dd MMM yyyy')}
                      {(invoiceDetail as any).payment_status !== 'paid' && new Date((invoiceDetail as any).due_date) < new Date() && ' (Overdue)'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrint} disabled={loadingDetail}
                  className="flex items-center gap-1.5 px-3 py-2 brutal-border border-surface/30 hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus disabled:opacity-40">
                  <Printer className="w-4 h-4" />
                  <span className="font-mono text-xs uppercase tracking-wider hidden sm:block">Print</span>
                </button>
                <button onClick={handleCloseModal}
                  className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-line px-5 bg-paper shrink-0">
              <div className="flex gap-0">
                {([
                  { key: 'details', label: 'Invoice Details', icon: FileText },
                  { key: 'edit',    label: 'Edit',           icon: Pencil },
                  { key: 'returns', label: 'Returns',        icon: RotateCcw },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors brutal-focus border-b-2',
                      activeTab === key
                        ? 'border-accent text-ink font-bold'
                        : 'border-transparent text-ink-light hover:text-ink',
                    )}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="text-center py-12 font-mono text-xs uppercase tracking-widest text-ink-light">
                  Loading invoice details...
                </div>
              ) : activeTab === 'details' ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Summary */}
                    <div className="brutal-border bg-paper p-5">
                      <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">Invoice Summary</div>
                      <div className="space-y-3 font-mono text-sm">
                        <div className="flex justify-between"><span className="text-ink-light">Subtotal</span><span>₹{invoiceDetail.sub_total.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-ink-light">Discount</span><span className="text-warning">-₹{invoiceDetail.discount_amount.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-ink-light">CGST ({(invoiceDetail.tax_rate / 2).toFixed(1)}%)</span><span>₹{(invoiceDetail.total_tax_amount / 2).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-ink-light">SGST ({(invoiceDetail.tax_rate / 2).toFixed(1)}%)</span><span>₹{(invoiceDetail.total_tax_amount / 2).toFixed(2)}</span></div>
                        <div className="flex justify-between border-t border-line pt-3">
                          <span className="font-bold">Grand Total</span>
                          <span className="text-xl font-bold">₹{invoiceDetail.grand_total.toFixed(2)}</span>
                        </div>
                      </div>
                      {(invoiceDetail as any).po_number && (
                        <div className="mt-4 pt-3 border-t border-line font-mono text-xs text-ink-light">
                          PO #: <span className="text-ink font-bold">{(invoiceDetail as any).po_number}</span>
                        </div>
                      )}
                      {(invoiceDetail as any).shipping_address && (
                        <div className="mt-2 font-mono text-xs text-ink-light">
                          Ship to: <span className="text-ink">{(invoiceDetail as any).shipping_address}</span>
                        </div>
                      )}
                    </div>
                    {/* Payment */}
                    <div className="brutal-border bg-paper p-5">
                      <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">Payment Status</div>
                      <div className={cn('inline-block px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider border', statusCls(invoiceDetail.payment_status ?? ''))}>
                        {invoiceDetail.payment_status}
                      </div>
                      {invoiceDetail.amount_paid != null && (
                        <div className="mt-4 brutal-border bg-paper p-4 space-y-2 font-mono text-sm">
                          <div className="flex justify-between">
                            <span className="text-ink-light">Amount Paid</span>
                            <span>₹{(invoiceDetail.amount_paid || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-light">Balance Due</span>
                            <span className={cn('font-bold', (invoiceDetail.grand_total || 0) - (invoiceDetail.amount_paid || 0) > 0 ? 'text-danger' : 'text-success')}>
                              ₹{((invoiceDetail.grand_total || 0) - (invoiceDetail.amount_paid || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      {invoiceDetail.notes && (
                        <div className="mt-4 p-3 border-l-2 border-accent bg-accent/5 font-mono text-xs text-ink-light">
                          <span className="font-bold text-ink">Notes:</span> {invoiceDetail.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Line Items */}
                  <div className="brutal-border bg-paper overflow-hidden">
                    <div className="font-display font-bold uppercase text-sm p-4 border-b border-line">Line Items</div>
                    <div className="divide-y divide-line">
                      {(invoiceDetail.line_items || []).map((item: InvoiceLineItem, index: number) => (
                        <div key={index} className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.item_name || 'Unknown Item'}</p>
                            <p className="text-xs font-mono text-ink-light mt-0.5">
                              Qty: {item.quantity} × ₹{(item.price || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right font-mono">
                            {item.discount_amount && item.discount_amount > 0 && (
                              <p className="text-xs text-warning">-₹{item.discount_amount.toFixed(2)}</p>
                            )}
                            <p className="font-bold text-sm">₹{(item.total || (item.quantity * (item.price || 0))).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'edit' ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Invoice Date</label>
                      <input type="date" value={editFormData.invoice_date}
                        onChange={(e) => setEditFormData({ ...editFormData, invoice_date: e.target.value })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>CGST (%)</label>
                      <input type="number" step="0.1" min="0" value={editFormData.tax_rate / 2}
                        onChange={(e) => setEditFormData({ ...editFormData, tax_rate: (parseFloat(e.target.value) || 0) * 2 })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>SGST (%)</label>
                      <input type="number" step="0.1" min="0" value={editFormData.tax_rate / 2}
                        onChange={(e) => setEditFormData({ ...editFormData, tax_rate: (parseFloat(e.target.value) || 0) * 2 })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Discount Type</label>
                      <select value={editFormData.discount_type}
                        onChange={(e) => setEditFormData({ ...editFormData, discount_type: e.target.value })}
                        className={inputCls}>
                        <option value="amount">Fixed Amount (₹)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Discount Value</label>
                      <input type="number" step="0.01" value={editFormData.discount_amount}
                        onChange={(e) => setEditFormData({ ...editFormData, discount_amount: parseFloat(e.target.value) || 0 })}
                        className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      className={cn(inputCls, 'resize-none')} rows={3} placeholder="Notes..." />
                  </div>
                  {/* Edit Line Items */}
                  <div className="brutal-border bg-paper overflow-hidden">
                    <div className="font-display font-bold uppercase text-sm p-4 border-b border-line">Line Items</div>
                    <div className="divide-y divide-line">
                      {editFormData.line_items.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-4">
                          <div className="flex-1 font-medium text-sm">{item.item_name}</div>
                          <div>
                            <div className={labelCls}>Qty</div>
                            <input type="number" min="1" value={item.quantity}
                              onChange={(e) => handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-2 brutal-border bg-paper text-ink font-mono text-sm text-center focus:outline-none focus:border-accent" />
                          </div>
                          <div>
                            <div className={labelCls}>Price (₹)</div>
                            <input type="number" step="0.01" value={item.price}
                              onChange={(e) => handleLineItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-2 brutal-border bg-paper text-ink font-mono text-sm text-center focus:outline-none focus:border-accent" />
                          </div>
                          <button onClick={() => handleRemoveLineItem(index)}
                            className="p-2 brutal-border hover:border-danger hover:text-danger transition-colors brutal-focus mt-4">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleSaveEdit} disabled={updateMutation.isPending}
                      className="flex-1 px-5 py-3 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50">
                      {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={() => setActiveTab('details')}
                      className="px-5 py-3 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <ReturnsPanel invoice={invoiceDetail} />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SalesInvoicesPage
