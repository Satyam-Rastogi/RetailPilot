import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { returnService } from '../services/api'
import { ReturnReasonCategory, type Invoice, type ReturnReceipt } from '../types/api'

interface ReturnsPanelProps {
  invoice: Invoice
}

const REASON_CATEGORIES = [
  { value: '', label: 'Select a reason' },
  { value: ReturnReasonCategory.DAMAGED, label: '🔴 Damaged Goods' },
  { value: ReturnReasonCategory.UNABLE_TO_PAY, label: '🟡 Customer Was Unable to Pay' },
  { value: ReturnReasonCategory.UNABLE_TO_SELL, label: '🟠 Customer Was Unable to Sell' },
  { value: ReturnReasonCategory.BETTER_DEAL, label: '🔵 Found a Better Deal' },
  { value: ReturnReasonCategory.QUALITY_ISSUE, label: '🟣 Quality Issue' },
  { value: ReturnReasonCategory.WRONG_ITEM, label: '⚪ Wrong Item Delivered' },
  { value: ReturnReasonCategory.OTHER, label: '⚫ Other' },
]

function getReasonBadge(category: string) {
  const found = REASON_CATEGORIES.find(c => c.value === category)
  return found?.label || category
}

interface EditLineItem {
  id?: number
  item_id: number
  item_name: string
  quantity_returned: number
  amount: number
  reason: string
  reason_category: string
}

function ReturnsPanel({ invoice }: ReturnsPanelProps) {
  const queryClient = useQueryClient()
  const [showNewReturnForm, setShowNewReturnForm] = useState(false)
  const [returnType, setReturnType] = useState<'full' | 'partial'>('partial')
  const [returnFormData, setReturnFormData] = useState({
    return_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    reason_category: '',
  })
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({})
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<ReturnReceipt | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    return_date: '',
    notes: '',
    line_items: [] as EditLineItem[],
  })

  const { data: returns, isLoading } = useQuery({
    queryKey: ['returns', invoice.id],
    queryFn: () => returnService.list(),
    enabled: !!invoice.id,
  })

  const { data: returnDetails } = useQuery({
    queryKey: ['return-details', selectedReturn?.id],
    queryFn: () => returnService.get(selectedReturn!.id),
    enabled: !!selectedReturn && (showAuditModal || showEditModal),
  })

  const createReturnMutation = useMutation({
    mutationFn: returnService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns', invoice.id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowNewReturnForm(false)
      setReturnFormData({ return_date: format(new Date(), 'yyyy-MM-dd'), notes: '', reason_category: '' })
      setSelectedItems({})
      setReturnType('partial')
      alert('Return created successfully!')
    },
  })

  const updateReturnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      returnService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns', invoice.id] })
      queryClient.invalidateQueries({ queryKey: ['return-details'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowEditModal(false)
      setSelectedReturn(null)
      alert('Return updated successfully!')
    },
    onError: (error: any) => {
      alert(`Error updating return: ${error.response?.data?.detail || error.message}`)
    },
  })

  const filteredReturns = (returns || []).filter((r: any) => r.invoice_id === invoice.id)

  const totalInvoiceItems = invoice.line_items?.reduce((sum, li) => sum + (li.quantity || 0), 0) || 0
  const totalSelectedItems = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0)

  const handleFullReturn = () => {
    const allItems: Record<number, number> = {}
    invoice.line_items?.forEach(li => {
      if (li.item_id && li.quantity) {
        allItems[li.item_id] = li.quantity
      }
    })
    setSelectedItems(allItems)
  }

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault()

    const returnItems = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const invoiceItem = invoice.line_items?.find(li => li.item_id === parseInt(itemId))
        return {
          item_id: parseInt(itemId),
          quantity_returned: qty,
          amount: (invoiceItem && invoiceItem.quantity > 0) ? ((invoiceItem.total || (invoiceItem.quantity * (invoiceItem.price || 0))) / invoiceItem.quantity) * qty : 0,
          reason: returnFormData.notes || 'Customer return',
          reason_category: returnFormData.reason_category as ReturnReasonCategory || undefined,
        }
      })

    if (returnItems.length === 0) {
      alert('Please select at least one item to return')
      return
    }

    const isFullReturn = returnItems.length === totalInvoiceItems && returnItems.every(ri => {
      const originalItem = invoice.line_items?.find(li => li.item_id === ri.item_id)
      return originalItem && originalItem.quantity === ri.quantity_returned
    })

    createReturnMutation.mutate({
      invoice_id: invoice.id,
      return_date: returnFormData.return_date,
      total_credit: returnItems.reduce((sum, item) => sum + item.amount, 0),
      notes: returnFormData.notes,
      line_items: returnItems,
      is_partial: !isFullReturn,
      total_items_in_invoice: totalInvoiceItems,
      items_returned_count: totalSelectedItems,
    })
  }

  const viewAuditTrail = (ret: ReturnReceipt) => {
    setSelectedReturn(ret)
    setShowAuditModal(true)
  }

  const handleEditClick = (ret: any) => {
    returnService.get(ret.id).then((details: ReturnReceipt) => {
      setSelectedReturn(ret)
      setEditFormData({
        return_date: format(new Date(details.return_date), 'yyyy-MM-dd'),
        notes: details.notes || '',
        line_items: (details.line_items || []).map((li: any) => ({
          id: li.id,
          item_id: li.item_id || 0,
          item_name: li.item_name || 'Unknown',
          quantity_returned: li.quantity_returned || 0,
          amount: li.amount || 0,
          reason: li.reason || '',
          reason_category: li.reason_category || '',
        })),
      })
      setShowEditModal(true)
    })
  }

  const handleSaveEdit = () => {
    if (!selectedReturn?.id) return

    updateReturnMutation.mutate({
      id: selectedReturn.id,
      data: {
        return_date: editFormData.return_date,
        notes: editFormData.notes,
        line_items: editFormData.line_items.map(li => ({
          item_id: li.item_id,
          quantity_returned: li.quantity_returned,
          amount: li.amount,
          reason: li.reason,
          reason_category: li.reason_category || undefined,
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-100 mb-2">
            Returns for {invoice.invoice_number || `INV-${invoice.id}`}
          </h2>
          <p className="text-slate-400">Total Returns: {filteredReturns.length}</p>
        </div>
        <button
          onClick={() => setShowNewReturnForm(!showNewReturnForm)}
          className="btn btn-primary px-6 flex items-center gap-2"
        >
          <span className="text-xl">↩️</span>
          New Return
        </button>
      </div>

      {showNewReturnForm && (
        <div className="card rounded-2xl p-8 bg-slate-800/30 border-2 border-amber-500/20">
          <h3 className="text-2xl font-display font-bold text-slate-100 mb-6">Create New Return</h3>
          <form onSubmit={handleCreateReturn} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Return Date
                </label>
                <input
                  type="date"
                  value={returnFormData.return_date}
                  onChange={(e) => setReturnFormData({ ...returnFormData, return_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Reason Category
                </label>
                <select
                  value={returnFormData.reason_category}
                  onChange={(e) => setReturnFormData({ ...returnFormData, reason_category: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  required
                >
                  {REASON_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Additional Notes
              </label>
              <input
                type="text"
                value={returnFormData.notes}
                onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                placeholder="Optional additional details"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-slate-300">
                  Return Type
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (returnType === 'partial') {
                      handleFullReturn()
                      setReturnType('full')
                    } else {
                      setSelectedItems({})
                      setReturnType('partial')
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/50 text-amber-400 text-sm font-semibold transition-all"
                >
                  {returnType === 'partial' ? '✅ Select All Items (Full Return)' : '🔄 Switch to Partial'}
                </button>
              </div>
              <div className="flex gap-4 mb-4">
                <span className={`px-4 py-2 rounded-lg ${returnType === 'partial' ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50' : 'bg-slate-800/50 text-slate-400 border-2 border-slate-700/50'}`}>
                  ⚠️ Partial Return ({totalSelectedItems} of {totalInvoiceItems} items)
                </span>
                <span className={`px-4 py-2 rounded-lg ${returnType === 'full' ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50' : 'bg-slate-800/50 text-slate-400 border-2 border-slate-700/50'}`}>
                  ✅ Full Return
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Select Items to Return
              </label>
              <div className="space-y-3">
                {(invoice.line_items || []).map((item) => (
                  <div key={item.item_id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50 border-2 border-slate-700/30">
                    <input
                      type="number"
                      min="0"
                      max={item.quantity || 0}
                      value={selectedItems[item.item_id] || 0}
                      onChange={(e) => {
                        const val = Math.min(parseInt(e.target.value) || 0, item.quantity || 0)
                        setSelectedItems({
                          ...selectedItems,
                          [item.item_id || 0]: val,
                        })
                        if (val < (item.quantity || 0)) {
                          setReturnType('partial')
                        }
                      }}
                      className="w-24 px-3 py-2 rounded-lg bg-slate-800 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none text-center"
                      placeholder="Qty"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{item.item_name || 'Unknown Item'}</p>
                      <p className="text-sm text-slate-400">
                        Max: {item.quantity || 0} @ ₹{item.quantity > 0 ? (item.total / item.quantity).toFixed(2) : '0.00'} each
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Original Total</p>
                      <p className="font-semibold text-slate-200">₹{(item.total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {Object.values(selectedItems).some(qty => qty > 0) && (
              <div className="p-6 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-2 border-amber-500/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-amber-400">Estimated Credit</span>
                  <span className="text-2xl font-bold text-amber-400">
                    ₹{Object.entries(selectedItems)
                      .filter(([_, qty]) => qty > 0)
                      .reduce((sum, [itemId, qty]) => {
                        const invoiceItem = (invoice.line_items || []).find(li => li.item_id === parseInt(itemId))
                        if (!invoiceItem || !invoiceItem.quantity || invoiceItem.quantity === 0) {
                          return sum
                        }
                        return sum + ((invoiceItem.total || (invoiceItem.quantity * (invoiceItem.price || 0))) / invoiceItem.quantity) * qty
                      }, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  Items returned will be added back to stock inventory
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={createReturnMutation.isPending || totalSelectedItems === 0}
                className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {createReturnMutation.isPending ? 'Processing...' : 'Create Return'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewReturnForm(false)
                  setSelectedItems({})
                  setReturnType('partial')
                }}
                className="px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-700/50 text-slate-300 font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 animate-bounce">⏳</div>
          <p className="text-slate-400">Loading returns...</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-xl text-slate-400">No returns found for this invoice</p>
          <p className="text-slate-500 mt-2">Click "New Return" to create a return receipt</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((returnReceipt: any) => (
            <div key={returnReceipt.id} className="card rounded-xl p-6 bg-slate-800/30 border-2 border-slate-700/30 hover:border-amber-500/30 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-semibold text-slate-100">
                      Return #{returnReceipt.id}
                    </h4>
                    {returnReceipt.is_partial ? (
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-semibold">
                        ⚠️ PARTIAL
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-semibold">
                        ✅ FULL
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400">
                    {format(new Date(returnReceipt.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-emerald-400">
                    +₹{returnReceipt.total_credit.toFixed(2)}
                  </span>
                  <p className="text-sm text-emerald-400">Credit Issued</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                {returnReceipt.reason_category && (
                  <span className="px-3 py-1 rounded-lg bg-slate-700/50 text-slate-300 text-sm">
                    {getReasonBadge(returnReceipt.reason_category)}
                  </span>
                )}
                {returnReceipt.is_partial && returnReceipt.items_returned_count !== undefined && returnReceipt.total_items_in_invoice !== undefined && (
                  <span className="px-3 py-1 rounded-lg bg-slate-700/50 text-slate-400 text-sm">
                    {returnReceipt.items_returned_count} of {returnReceipt.total_items_in_invoice} items
                  </span>
                )}
              </div>

              {returnReceipt.notes && (
                <div className="mb-4 p-3 rounded-lg bg-slate-900/50">
                  <p className="text-sm text-slate-400">
                    <span className="font-semibold">Notes:</span> {returnReceipt.notes}
                  </p>
                </div>
              )}

              <div className="border-t-2 border-slate-700/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-slate-300">Items Returned</h5>
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewAuditTrail(returnReceipt)}
                      className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/50 text-amber-400 text-sm font-semibold transition-all"
                    >
                      📋 Audit
                    </button>
                    <button
                      onClick={() => handleEditClick(returnReceipt)}
                      className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 text-blue-400 text-sm font-semibold transition-all"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {(returnReceipt.line_items || []).map((lineItem: any) => (
                    <div key={lineItem.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{lineItem.item_name || 'Unknown Item'}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400">Qty: {lineItem.quantity_returned || 0}</span>
                        <span className="font-semibold text-emerald-400">₹{(lineItem.amount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAuditModal && selectedReturn && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-display font-bold text-slate-100">
                  📋 Stock Audit Trail
                </h3>
                <p className="text-slate-400">Return #{selectedReturn.id}</p>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-slate-200 text-2xl"
              >
                ×
              </button>
            </div>

            {returnDetails ? (
              <div className="space-y-3">
                {(returnDetails.stock_audit || []).map((audit: any) => (
                  <div key={audit.id} className="p-4 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-emerald-400">{audit.item_name || `Item #${audit.item_id}`}</p>
                        <p className="text-sm text-slate-400">{audit.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-400">+{audit.quantity_change} units</p>
                        <p className="text-xs text-slate-500">
                          {audit.created_at ? format(new Date(audit.created_at), 'dd MMM yyyy, HH:mm') : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl animate-bounce">⏳</div>
                <p className="text-slate-400">Loading audit trail...</p>
              </div>
            )}

            <button
              onClick={() => setShowAuditModal(false)}
              className="mt-6 w-full btn btn-primary py-3"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showEditModal && selectedReturn && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-display font-bold text-slate-100">
                  Edit Return #{selectedReturn.id}
                </h3>
                <p className="text-slate-400">{selectedReturn.invoice_number}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Return Date
                </label>
                <input
                  type="date"
                  value={editFormData.return_date}
                  onChange={(e) => setEditFormData({ ...editFormData, return_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
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
                  placeholder="Add notes about this return..."
                />
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-100 mb-3">Items Returned</h4>
                <div className="space-y-3">
                  {editFormData.line_items.map((item, index) => (
                    <div key={index} className="p-4 rounded-lg bg-slate-900/50">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-semibold text-slate-100">{item.item_name}</p>
                        <button
                          onClick={() => handleRemoveLineItem(index)}
                          className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-400 font-semibold transition-all"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity_returned}
                            onChange={(e) => handleLineItemChange(index, 'quantity_returned', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Credit Amount (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="text-xs text-slate-400">Reason Category</label>
                        <select
                          value={item.reason_category}
                          onChange={(e) => handleLineItemChange(index, 'reason_category', e.target.value)}
                          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 mt-1"
                        >
                          {REASON_CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-3">
                        <label className="text-xs text-slate-400">Reason Notes</label>
                        <input
                          type="text"
                          value={item.reason}
                          onChange={(e) => handleLineItemChange(index, 'reason', e.target.value)}
                          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 mt-1"
                          placeholder="Additional details..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={updateReturnMutation.isPending}
                  className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {updateReturnMutation.isPending ? 'Saving...' : '💾 Save Changes'}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-700/50 text-slate-300 font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReturnsPanel
