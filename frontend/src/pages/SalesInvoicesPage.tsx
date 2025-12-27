import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { invoiceService } from '../services/api'
import type { Invoice, InvoiceListResponse, InvoiceLineItem } from '../types/api'
import ReturnsPanel from './ReturnsPanel'

function SalesInvoicesPage() {
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    invoice_number: '',
  })
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'returns'>('details')

  const queryClient = useQueryClient()

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => invoiceService.list({
      skip: 0,
      limit: 100,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      invoice_number: filters.invoice_number || undefined,
    }),
  })

  const { data: invoiceDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['invoice', selectedInvoice?.id],
    queryFn: () => invoiceService.get(selectedInvoice!.id),
    enabled: !!selectedInvoice?.id && showInvoiceDetail,
  })

  const deleteMutation = useMutation({
    mutationFn: invoiceService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowInvoiceDetail(false)
      setSelectedInvoice(null)
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

  const handleCloseModal = () => {
    setShowInvoiceDetail(false)
    setSelectedInvoice(null)
    setActiveTab('details')
  }

  const resetForm = () => {
    setFilters({
      date_from: '',
      date_to: '',
      invoice_number: '',
    })
  }

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner">
           <header className="mb-12 slide-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-5xl font-display font-bold gradient-text mb-2">
                  Sales Invoices
                </h1>
                <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                  Create and manage sales invoices
                </p>
              </div>

              <button
                onClick={() => resetForm()}
                className="btn btn-primary px-8 flex items-center gap-2"
              >
                <span className="text-xl">📄</span>
                New Invoice
              </button>
            </div>
          </header>

          {isLoading ? (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">Loading invoices...</p>
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="card rounded-2xl overflow-hidden slide-up">
              <table className="min-w-[1200px] w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Invoice #
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Date
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Customer
                    </th>
                    <th className="text-right px-8 py-6 font-display font-semibold text-slate-300">
                      Total
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Status
                    </th>
                    <th className="text-right px-8 py-6 font-display font-semibold text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: InvoiceListResponse, index: number) => (
                    <tr 
                      key={invoice.id} 
                      className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300 group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-8 py-6">
                        <span className="font-semibold text-slate-100 dark:text-slate-100 light:text-slate-900 group-hover:text-amber-400 transition-colors">
                          {invoice.invoice_number || `INV-${invoice.id}`}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                        {invoice.customer_name}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
                          {invoice.total_amount.toFixed(2)}
                        </span>
                      </td>
                       <td className="px-8 py-6">
                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                          ${invoice.payment_status === 'paid'
                            ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 border-2 border-emerald-500/50 text-emerald-400'
                            : invoice.payment_status === 'partial'
                            ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                            : 'bg-gradient-to-r from-red-500/20 to-red-500/5 border-2 border-red-500/50 text-red-400'
                          }`}>
                            {invoice.payment_status === 'paid' ? '✓' : invoice.payment_status === 'partial' ? '⏳' : '○'}
                            <span className="text-base">
                              {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                            </span>
                          </span>
                      </td>
                        <td className="px-8 py-6">
                         <button
                           onClick={() => handleViewInvoice(invoice)}
                           className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-blue-500/20 border-2 border-slate-700/50 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 font-semibold transition-all duration-300 hover:scale-105"
                         >
                           View
                         </button>
                         <button className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-amber-500/20 border-2 border-slate-700/50 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-semibold transition-all duration-300 hover:scale-105">
                           Edit
                         </button>
                         <button
                           onClick={() => deleteMutation.mutate(invoice.id)}
                           className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 hover:text-red-300 font-semibold transition-all duration-300 hover:scale-105"
                         >
                           Delete
                         </button>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">No invoices found</p>
            </div>
          )}
        </div>
      </div>

      {showInvoiceDetail && invoiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="card rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b-2 border-slate-700/30">
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-100">
                  {invoiceDetail.invoice_number || `INV-${invoiceDetail.id}`}
                </h2>
                <p className="text-slate-400">
                  {format(new Date(invoiceDetail.invoice_date), 'dd MMM yyyy')}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 hover:text-red-300 font-semibold transition-all"
              >
                ✕ Close
              </button>
            </div>

            <div className="border-b-2 border-slate-700/30 px-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-6 py-3 font-semibold transition-all ${
                    activeTab === 'details'
                      ? 'text-amber-400 border-b-2 border-amber-400'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  📄 Invoice Details
                </button>
                <button
                  onClick={() => setActiveTab('returns')}
                  className={`px-6 py-3 font-semibold transition-all ${
                    activeTab === 'returns'
                      ? 'text-amber-400 border-b-2 border-amber-400'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  ↩️ Returns
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4 animate-bounce">⏳</div>
                  <p className="text-slate-400">Loading invoice details...</p>
                </div>
              ) : activeTab === 'details' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card rounded-xl p-6 bg-slate-800/30">
                      <h3 className="text-lg font-semibold text-slate-300 mb-4">Invoice Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Subtotal</span>
                          <span className="font-semibold text-slate-200">₹{invoiceDetail.sub_total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Discount</span>
                          <span className="font-semibold text-amber-400">-₹{invoiceDetail.discount_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tax</span>
                          <span className="font-semibold text-slate-200">₹{invoiceDetail.total_tax_amount.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 border-slate-700/30 pt-3 flex justify-between">
                          <span className="text-lg font-semibold text-slate-300">Grand Total</span>
                          <span className="text-2xl font-bold text-amber-400">₹{invoiceDetail.grand_total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card rounded-xl p-6 bg-slate-800/30">
                      <h3 className="text-lg font-semibold text-slate-300 mb-4">Payment Status</h3>
                      <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-lg
                        ${invoiceDetail.payment_status === 'paid'
                          ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 border-2 border-emerald-500/50 text-emerald-400'
                          : invoiceDetail.payment_status === 'partial'
                          ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                          : 'bg-gradient-to-r from-red-500/20 to-red-500/5 border-2 border-red-500/50 text-red-400'
                        }`}>
                        {invoiceDetail.payment_status === 'paid' ? '✓' : invoiceDetail.payment_status === 'partial' ? '⏳' : '○'}
                        <span className="text-base">
                          {invoiceDetail.payment_status.charAt(0).toUpperCase() + invoiceDetail.payment_status.slice(1)}
                        </span>
                      </div>
                       {invoiceDetail.amount_paid != null && invoiceDetail.amount_paid !== undefined && (
                        <div className="mt-4 p-4 rounded-lg bg-slate-900/50">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Amount Paid</span>
                            <span className="font-semibold text-slate-200">₹{(invoiceDetail.amount_paid || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className="text-slate-400">Balance Due</span>
                            <span className={`font-semibold ${(invoiceDetail.grand_total || 0) - (invoiceDetail.amount_paid || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              ₹{((invoiceDetail.grand_total || 0) - (invoiceDetail.amount_paid || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      {invoiceDetail.notes && (
                        <div className="mt-4 p-4 rounded-lg bg-slate-900/50">
                          <p className="text-sm text-slate-400">
                            <span className="font-semibold">Notes:</span> {invoiceDetail.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                   <div className="card rounded-xl p-6 bg-slate-800/30">
                    <h3 className="text-lg font-semibold text-slate-300 mb-4">Line Items</h3>
                    <div className="space-y-3">
                      {(invoiceDetail.line_items || []).map((item: InvoiceLineItem, index: number) => (
                        <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-100">{item.item_name || 'Unknown Item'}</p>
                            <p className="text-sm text-slate-400">
                              Qty: {item.quantity} × ₹{(item.price || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            {item.discount_amount && item.discount_amount > 0 && (
                              <p className="text-sm text-amber-400">-₹{item.discount_amount.toFixed(2)}</p>
                            )}
                            <p className="font-semibold text-slate-200">₹{(item.total || (item.quantity * (item.price || 0))).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <ReturnsPanel invoice={invoiceDetail} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesInvoicesPage
