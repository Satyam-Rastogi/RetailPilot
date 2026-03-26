import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { invoiceService, customerService, itemService } from '../services/api'
import type { Invoice, InvoiceListResponse, InvoiceLineItem, CustomerListResponse, ItemListResponse } from '../types/api'
import ReturnsPanel from './ReturnsPanel'

interface EditLineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  discount_amount: number
  discount_type: string
}

interface CreateLineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  discount_amount: number
  discount_type: string
  unit_of_measurement?: string
}

function SalesInvoicesPage() {
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    invoice_number: '',
  })
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'returns' | 'edit'>('details')

  const [editFormData, setEditFormData] = useState({
    invoice_date: '',
    discount_type: 'amount',
    discount_amount: 0,
    tax_rate: 18,
    notes: '',
    line_items: [] as EditLineItem[],
  })

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    customer_id: 0,
    invoice_date: new Date().toISOString().split('T')[0],
    discount_type: 'amount',
    discount_amount: 0,
    tax_rate: 18,
    po_number: '',
    shipping_address: '',
    notes: '',
  })
  const [createLineItems, setCreateLineItems] = useState<CreateLineItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState(0)
  const [createError, setCreateError] = useState('')

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

  const { data: customers } = useQuery<CustomerListResponse[]>({
    queryKey: ['customers'],
    queryFn: () => customerService.list(),
    enabled: showCreateModal,
  })

  const { data: items } = useQuery<ItemListResponse[]>({
    queryKey: ['items'],
    queryFn: () => itemService.list(),
    enabled: showCreateModal,
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
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      invoiceService.update(id, data),
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

  const createMutation = useMutation({
    mutationFn: (data: any) => invoiceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowCreateModal(false)
      resetCreateForm()
    },
    onError: (error: any) => {
      setCreateError(error.response?.data?.detail || error.message || 'Failed to create invoice')
    },
  })

  const selectedCustomer = customers?.find(c => c.id === createForm.customer_id)
  const isWholesale = selectedCustomer?.customer_type === 'Wholesale'

  const getAutoPrice = (item: ItemListResponse) => {
    return isWholesale ? item.selling_price_wholesale : item.selling_price_retail
  }

  const handleAddLineItem = () => {
    if (!selectedItemId) return
    const item = items?.find(i => i.id === selectedItemId)
    if (!item) return

    const existing = createLineItems.find(li => li.item_id === selectedItemId)
    if (existing) {
      setCreateLineItems(createLineItems.map(li =>
        li.item_id === selectedItemId
          ? { ...li, quantity: li.quantity + 1 }
          : li
      ))
    } else {
      setCreateLineItems([...createLineItems, {
        item_id: item.id,
        item_name: item.item_name,
        quantity: 1,
        price: getAutoPrice(item),
        discount_amount: 0,
        discount_type: 'amount',
        unit_of_measurement: item.unit_of_measurement,
      }])
    }
    setSelectedItemId(0)
  }

  const handleCustomerChange = (customerId: number) => {
    setCreateForm({ ...createForm, customer_id: customerId })
    const newCustomer = customers?.find(c => c.id === customerId)
    const newIsWholesale = newCustomer?.customer_type === 'Wholesale'
    // Re-price all existing line items when customer type changes
    if (createLineItems.length > 0 && items) {
      setCreateLineItems(createLineItems.map(li => {
        const itemData = items.find(i => i.id === li.item_id)
        if (!itemData) return li
        return {
          ...li,
          price: newIsWholesale ? itemData.selling_price_wholesale : itemData.selling_price_retail,
        }
      }))
    }
  }

  const computeCreateTotals = () => {
    const lineSubtotal = createLineItems.reduce((sum, li) => {
      return sum + (li.quantity * li.price) - (li.discount_amount || 0)
    }, 0)
    let invoiceDiscount = 0
    if (createForm.discount_type === 'amount') {
      invoiceDiscount = createForm.discount_amount || 0
    } else {
      invoiceDiscount = lineSubtotal * ((createForm.discount_amount || 0) / 100)
    }
    const afterDiscount = lineSubtotal - invoiceDiscount
    const tax = afterDiscount * ((createForm.tax_rate || 0) / 100)
    return {
      subtotal: lineSubtotal,
      discount: invoiceDiscount,
      tax,
      grandTotal: afterDiscount + tax,
    }
  }

  const handleSubmitCreate = () => {
    setCreateError('')
    if (!createForm.customer_id) {
      setCreateError('Please select a customer')
      return
    }
    if (createLineItems.length === 0) {
      setCreateError('Please add at least one line item')
      return
    }
    createMutation.mutate({
      customer_id: createForm.customer_id,
      invoice_date: createForm.invoice_date,
      discount_type: createForm.discount_type,
      discount_amount: createForm.discount_amount,
      tax_rate: createForm.tax_rate,
      po_number: createForm.po_number || undefined,
      shipping_address: createForm.shipping_address || undefined,
      notes: createForm.notes || undefined,
      line_items: createLineItems.map(li => ({
        item_id: li.item_id,
        quantity: li.quantity,
        price: li.price,
        discount_amount: li.discount_amount,
        discount_type: li.discount_type,
        total: li.quantity * li.price - (li.discount_amount || 0),
      })),
    })
  }

  const resetCreateForm = () => {
    setCreateForm({
      customer_id: 0,
      invoice_date: new Date().toISOString().split('T')[0],
      discount_type: 'amount',
      discount_amount: 0,
      tax_rate: 18,
      po_number: '',
      shipping_address: '',
      notes: '',
    })
    setCreateLineItems([])
    setSelectedItemId(0)
    setCreateError('')
  }

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

  const totals = computeCreateTotals()

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
                onClick={() => { resetCreateForm(); setShowCreateModal(true) }}
                className="btn btn-primary px-8 flex items-center gap-2"
              >
                <span className="text-xl">📄</span>
                New Invoice
              </button>
            </div>
          </header>

          {/* Filters */}
          <div className="card rounded-2xl p-6 mb-6 slide-up">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-semibold text-slate-400 mb-1">From</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="input"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-semibold text-slate-400 mb-1">To</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="input"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Invoice #</label>
                <input
                  type="text"
                  placeholder="Search by invoice number..."
                  value={filters.invoice_number}
                  onChange={(e) => setFilters({ ...filters, invoice_number: e.target.value })}
                  className="input"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ date_from: '', date_to: '', invoice_number: '' })}
                  className="btn btn-secondary h-[42px] px-4"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

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
                      Due Date
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
                  {invoices.map((invoice: InvoiceListResponse, index: number) => {
                    const isOverdue = invoice.due_date &&
                      invoice.payment_status !== 'paid' &&
                      new Date(invoice.due_date) < new Date()
                    return (
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
                        <td className="px-8 py-6">
                          {invoice.due_date ? (
                            <span className={isOverdue ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                              {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                              {isOverdue && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40">Overdue</span>}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          <div>{invoice.customer_name}</div>
                          {invoice.customer_type && (
                            <div className="text-xs text-slate-500">{invoice.customer_type}</div>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
                            ₹{invoice.total_amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm ${
                            invoice.payment_status === 'paid'
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewInvoice(invoice)}
                              className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-blue-500/20 border-2 border-slate-700/50 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 font-semibold transition-all duration-300 hover:scale-105"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-amber-500/20 border-2 border-slate-700/50 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-semibold transition-all duration-300 hover:scale-105"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(invoice.id)}
                              className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 hover:text-red-300 font-semibold transition-all duration-300 hover:scale-105"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">📄</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">No invoices found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b-2 border-slate-700/30">
              <h2 className="text-2xl font-display font-bold text-slate-100">New Invoice</h2>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 font-semibold transition-all">✕ Close</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {createError && (
                <div className="p-4 rounded-lg bg-red-500/10 border-2 border-red-500/30 text-red-400">
                  {createError}
                </div>
              )}

              {/* Customer + Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Customer *</label>
                  <select
                    value={createForm.customer_id}
                    onChange={(e) => handleCustomerChange(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  >
                    <option value={0}>Select a customer...</option>
                    {customers?.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.customer_type})</option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        isWholesale
                          ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
                          : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                      }`}>
                        {isWholesale ? '🏢 Wholesale' : '🏪 Retail'} — prices auto-selected
                      </span>
                      {selectedCustomer.credit_days && selectedCustomer.credit_days > 0 && (
                        <span className="text-xs text-slate-400">Net-{selectedCustomer.credit_days}</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Invoice Date *</label>
                  <input
                    type="date"
                    value={createForm.invoice_date}
                    onChange={(e) => setCreateForm({ ...createForm, invoice_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                  {selectedCustomer?.credit_days && selectedCustomer.credit_days > 0 && createForm.invoice_date && (
                    <div className="mt-1 text-xs text-slate-400">
                      Due: {format(new Date(new Date(createForm.invoice_date).getTime() + selectedCustomer.credit_days * 86400000), 'dd MMM yyyy')}
                    </div>
                  )}
                </div>
              </div>

              {/* Wholesale-only fields */}
              {isWholesale && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-indigo-500/5 border-2 border-indigo-500/20">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">PO Number</label>
                    <input
                      type="text"
                      value={createForm.po_number}
                      onChange={(e) => setCreateForm({ ...createForm, po_number: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      placeholder="Customer purchase order number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Shipping Address</label>
                    <input
                      type="text"
                      value={createForm.shipping_address}
                      onChange={(e) => setCreateForm({ ...createForm, shipping_address: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      placeholder="Delivery address (if different)"
                    />
                  </div>
                </div>
              )}

              {/* Line Items */}
              <div className="card rounded-xl p-5 bg-slate-800/30">
                <h3 className="text-lg font-semibold text-slate-300 mb-4">Line Items</h3>

                {/* Add item row */}
                <div className="flex gap-2 mb-4">
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(Number(e.target.value))}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  >
                    <option value={0}>Select an item to add...</option>
                    {items?.filter(i => i.current_stock_quantity > 0).map(i => (
                      <option key={i.id} value={i.id}>
                        {i.item_name} — Stock: {i.current_stock_quantity} — {isWholesale ? `WS: ₹${i.selling_price_wholesale}` : `Retail: ₹${i.selling_price_retail}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    disabled={!selectedItemId}
                    className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/50 text-amber-400 font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Add
                  </button>
                </div>

                {/* Line items list */}
                {createLineItems.length > 0 ? (
                  <div className="space-y-2">
                    {createLineItems.map((li, index) => (
                      <div key={li.item_id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-100 truncate">{li.item_name}</p>
                          {li.unit_of_measurement && (
                            <p className="text-xs text-slate-500">{li.unit_of_measurement}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <label className="text-xs text-slate-400">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={li.quantity}
                              onChange={(e) => {
                                const updated = [...createLineItems]
                                updated[index] = { ...updated[index], quantity: parseInt(e.target.value) || 1 }
                                setCreateLineItems(updated)
                              }}
                              className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-100 text-center text-sm"
                            />
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-slate-400 flex items-center gap-1">
                              Price
                              <span className={`px-1 rounded text-xs ${isWholesale ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {isWholesale ? 'WS' : 'R'}
                              </span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={li.price}
                              onChange={(e) => {
                                const updated = [...createLineItems]
                                updated[index] = { ...updated[index], price: parseFloat(e.target.value) || 0 }
                                setCreateLineItems(updated)
                              }}
                              className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-100 text-center text-sm"
                            />
                          </div>
                          <div className="text-right min-w-[80px]">
                            <div className="text-xs text-slate-400">Total</div>
                            <div className="font-semibold text-slate-200 text-sm">
                              ₹{(li.quantity * li.price - (li.discount_amount || 0)).toFixed(2)}
                            </div>
                          </div>
                          <button
                            onClick={() => setCreateLineItems(createLineItems.filter((_, i) => i !== index))}
                            className="px-2 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 transition-all text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No items added yet</p>
                )}
              </div>

              {/* Discount / Tax / Notes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Discount Type</label>
                  <select
                    value={createForm.discount_type}
                    onChange={(e) => setCreateForm({ ...createForm, discount_type: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  >
                    <option value="amount">Fixed Amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.discount_amount}
                    onChange={(e) => setCreateForm({ ...createForm, discount_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={createForm.tax_rate}
                    onChange={(e) => setCreateForm({ ...createForm, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>

              {/* Totals summary */}
              {createLineItems.length > 0 && (
                <div className="card rounded-xl p-5 bg-slate-800/30">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>Discount</span><span>-₹{totals.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>Tax ({createForm.tax_rate}%)</span><span>₹{totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-amber-400 border-t-2 border-slate-700/30 pt-2">
                      <span>Grand Total</span><span>₹{totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t-2 border-slate-700/30 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-700/50 text-slate-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCreate}
                disabled={createMutation.isPending}
                className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? 'Creating...' : '📄 Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail / Edit Modal */}
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
                  {(invoiceDetail as any).due_date && (
                    <span className={`ml-3 text-sm ${
                      (invoiceDetail as any).payment_status !== 'paid' && new Date((invoiceDetail as any).due_date) < new Date()
                        ? 'text-red-400 font-semibold'
                        : 'text-slate-500'
                    }`}>
                      Due: {format(new Date((invoiceDetail as any).due_date), 'dd MMM yyyy')}
                      {(invoiceDetail as any).payment_status !== 'paid' && new Date((invoiceDetail as any).due_date) < new Date() && ' (Overdue)'}
                    </span>
                  )}
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
                  onClick={() => setActiveTab('edit')}
                  className={`px-6 py-3 font-semibold transition-all ${
                    activeTab === 'edit'
                      ? 'text-amber-400 border-b-2 border-amber-400'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  ✏️ Edit
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
                      {(invoiceDetail as any).po_number && (
                        <div className="mt-4 pt-3 border-t-2 border-slate-700/30">
                          <span className="text-slate-400 text-sm">PO #: </span>
                          <span className="text-slate-200 text-sm font-semibold">{(invoiceDetail as any).po_number}</span>
                        </div>
                      )}
                      {(invoiceDetail as any).shipping_address && (
                        <div className="mt-2">
                          <span className="text-slate-400 text-sm">Ship to: </span>
                          <span className="text-slate-200 text-sm">{(invoiceDetail as any).shipping_address}</span>
                        </div>
                      )}
                    </div>

                    <div className="card rounded-xl p-6 bg-slate-800/30">
                      <h3 className="text-lg font-semibold text-slate-300 mb-4">Payment Status</h3>
                      <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-lg ${
                        invoiceDetail.payment_status === 'paid'
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
              ) : activeTab === 'edit' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Invoice Date
                      </label>
                      <input
                        type="date"
                        value={editFormData.invoice_date}
                        onChange={(e) => setEditFormData({ ...editFormData, invoice_date: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.tax_rate}
                        onChange={(e) => setEditFormData({ ...editFormData, tax_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Discount Type
                      </label>
                      <select
                        value={editFormData.discount_type}
                        onChange={(e) => setEditFormData({ ...editFormData, discount_type: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      >
                        <option value="amount">Fixed Amount (₹)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.discount_amount}
                        onChange={(e) => setEditFormData({ ...editFormData, discount_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      rows={3}
                      placeholder="Add notes about this invoice..."
                    />
                  </div>

                  <div className="card rounded-xl p-6 bg-slate-800/30">
                    <h3 className="text-lg font-semibold text-slate-300 mb-4">Line Items</h3>
                    <div className="space-y-3">
                      {editFormData.line_items.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-100">{item.item_name}</p>
                          </div>
                          <div className="w-20">
                            <label className="text-xs text-slate-400">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-center"
                            />
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-slate-400">Price (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => handleLineItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-center"
                            />
                          </div>
                          <button
                            onClick={() => handleRemoveLineItem(index)}
                            className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-400 font-semibold transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                      className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2"
                    >
                      {updateMutation.isPending ? 'Saving...' : '💾 Save Changes'}
                    </button>
                    <button
                      onClick={() => setActiveTab('details')}
                      className="px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-700/50 text-slate-300 font-semibold transition-all"
                    >
                      Cancel
                    </button>
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
