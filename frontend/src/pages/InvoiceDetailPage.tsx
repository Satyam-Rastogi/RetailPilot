import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { invoiceService, ledgerService } from '../services/api'
import type { InvoiceAllocationDetail } from '../types/api'

interface InvoiceLineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  discount_amount: number
  discount_type: string
  total: number
}

interface InvoiceDetail {
  id: number
  invoice_number: string
  invoice_date: string
  customer_id: number
  customer_name: string
  customer_type: string
  discount_type: string
  discount_amount: number
  tax_rate: number
  sub_total: number
  total_tax_amount: number
  grand_total: number
  amount_paid: number
  payment_status: string
  notes: string
  line_items: InvoiceLineItem[]
}

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const [showAllocations, setShowAllocations] = useState(false)

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

  if (isLoading) {
    return (
      <div className="page-container fade-in">
        <div className="section">
          <div className="section-inner slide-up">
            <div className="text-center py-24">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400">Loading invoice details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container fade-in">
        <div className="section">
          <div className="section-inner slide-up">
            <div className="text-center py-24 card p-16 rounded-2xl">
              <div className="text-8xl mb-6">❌</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">Error Loading Invoice</h3>
              <p className="text-slate-400 text-lg mb-6">
                {(error as Error).message || 'Failed to load invoice details'}
              </p>
              <button
                onClick={() => navigate(-1)}
                className="btn btn-primary px-8"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="page-container fade-in">
        <div className="section">
          <div className="section-inner slide-up">
            <div className="text-center py-24 card p-16 rounded-2xl">
              <div className="text-8xl mb-6">📄</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">Invoice Not Found</h3>
              <button
                onClick={() => navigate(-1)}
                className="btn btn-primary px-8"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const unpaid = invoice.grand_total - invoice.amount_paid

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="text-slate-400 hover:text-amber-400 transition-colors mb-2"
              >
                ← Back
              </button>
              <h1 className="text-5xl font-display font-bold gradient-text mb-2">
                Invoice Details
              </h1>
              <p className="text-xl text-slate-400">
                {invoice.invoice_number}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                ${invoice.payment_status === 'Paid'
                  ? 'bg-gradient-to-r from-green-500/20 to-green-500/5 border-2 border-green-500/50 text-green-400'
                  : invoice.payment_status === 'Partially Paid'
                  ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                  : 'bg-gradient-to-r from-red-500/20 to-red-500/5 border-2 border-red-500/50 text-red-400'
                }`}>
                {invoice.payment_status}
              </span>
            </div>
          </div>

          {/* Invoice Header Card */}
          <div className="card rounded-2xl p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-slate-400 mb-1">Customer</div>
                <div className="font-semibold text-slate-100">{invoice.customer_name}</div>
                <div className="text-sm text-slate-400">{invoice.customer_type}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-1">Invoice Date</div>
                <div className="font-semibold text-slate-100">
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-1">Invoice Total</div>
                <div className="font-bold text-3xl text-amber-400">
                  ₹{invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-1">Amount Paid</div>
                <div className="font-semibold text-green-400">
                  ₹{invoice.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                {unpaid > 0 && (
                  <div className="text-sm text-amber-400">
                    Outstanding: ₹{unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-6 pt-6 border-t-2 border-slate-800/30">
                <div className="text-sm text-slate-400 mb-1">Notes</div>
                <div className="text-slate-100">{invoice.notes}</div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="card rounded-2xl overflow-hidden mb-8">
            <div className="p-6 border-b-2 border-slate-800/30">
              <h2 className="text-2xl font-display font-semibold">Items</h2>
            </div>
            {invoice.line_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                      <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Item</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Quantity</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Price</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Discount</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.line_items.map((item) => (
                      <tr
                        key={item.item_id}
                        className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300"
                      >
                        <td className="px-8 py-4 font-semibold text-slate-100">
                          {item.item_name || 'Unknown Item'}
                        </td>
                        <td className="px-8 py-4 text-right text-slate-400">
                          {item.quantity}
                        </td>
                        <td className="px-8 py-4 text-right text-slate-100">
                          ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-4 text-right text-slate-400">
                          {item.discount_amount > 0
                            ? `₹${item.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${item.discount_type})`
                            : '-'
                          }
                        </td>
                        <td className="px-8 py-4 text-right font-semibold text-slate-100">
                          ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                No line items found for this invoice
              </div>
            )}

            {/* Invoice Totals Summary */}
            <div className="p-6 bg-slate-800/30 border-t-2 border-slate-700/50">
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-3">
                  <div className="flex justify-between text-slate-400">
                    <span>Sub Total</span>
                    <span>₹{invoice.sub_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Discount ({invoice.discount_type})</span>
                    <span>-₹{invoice.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tax ({invoice.tax_rate}%)</span>
                    <span>₹{invoice.total_tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t-2 border-slate-700">
                    <span className="font-bold text-slate-100">Grand Total</span>
                    <span className="font-bold text-2xl text-amber-400">
                      ₹{invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
              </div>
            </div>

          {/* Allocations Section */}
          <div className="card rounded-2xl overflow-hidden mb-8">
            <button
              onClick={() => setShowAllocations(!showAllocations)}
              className="w-full p-6 flex items-center justify-between border-b-2 border-slate-800/30 hover:bg-slate-800/20 transition-all duration-300"
              aria-expanded={showAllocations}
              aria-controls="allocations-content"
            >
              <h2 className="text-2xl font-display font-semibold">
                Allocations
              </h2>
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${showAllocations ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showAllocations && (
              <div id="allocations-content" className="p-6">
                {isLoadingAllocations ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-2 animate-bounce">⏳</div>
                    <p className="text-slate-400">Loading allocations...</p>
                  </div>
                ) : allocations && allocations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[600px] w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                          <th className="text-left px-6 py-3 font-display font-semibold text-slate-300">Payment Date</th>
                          <th className="text-left px-6 py-3 font-display font-semibold text-slate-300">Payment ID</th>
                          <th className="text-right px-6 py-3 font-display font-semibold text-slate-300">Amount</th>
                          <th className="text-left px-6 py-3 font-display font-semibold text-slate-300">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map((allocation) => (
                          <tr
                            key={allocation.id}
                            className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300"
                          >
                            <td className="px-6 py-3 text-slate-400">
                              {new Date(allocation.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-3 text-slate-100">
                              #{allocation.payment_id}
                            </td>
                            <td className="px-6 py-3 text-right text-green-400 font-semibold">
                              ₹{allocation.allocated_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3 text-slate-400">
                              {allocation.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    No allocations for this invoice
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate(-1)}
              className="btn btn-secondary px-8"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
