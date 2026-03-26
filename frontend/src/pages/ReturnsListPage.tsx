import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { returnService } from '../services/api'
import { ReturnReasonCategory, type ReturnReceipt } from '../types/api'

const REASON_CATEGORIES = [
  { value: '', label: 'All Reasons' },
  { value: ReturnReasonCategory.DAMAGED, label: '🔴 Damaged Goods' },
  { value: ReturnReasonCategory.UNABLE_TO_PAY, label: '🟡 Unable to Pay' },
  { value: ReturnReasonCategory.UNABLE_TO_SELL, label: '🟠 Unable to Sell' },
  { value: ReturnReasonCategory.BETTER_DEAL, label: '🔵 Found Better Deal' },
  { value: ReturnReasonCategory.QUALITY_ISSUE, label: '🟣 Quality Issue' },
  { value: ReturnReasonCategory.WRONG_ITEM, label: '⚪ Wrong Item Delivered' },
  { value: ReturnReasonCategory.OTHER, label: '⚫ Other' },
]

const EDIT_REASON_CATEGORIES = [
  { value: '', label: 'Select a reason' },
  { value: ReturnReasonCategory.DAMAGED, label: '🔴 Damaged Goods' },
  { value: ReturnReasonCategory.UNABLE_TO_PAY, label: '🟡 Customer Was Unable to Pay' },
  { value: ReturnReasonCategory.UNABLE_TO_SELL, label: '🟠 Customer Was Unable to Sell' },
  { value: ReturnReasonCategory.BETTER_DEAL, label: '🔵 Found a Better Deal' },
  { value: ReturnReasonCategory.QUALITY_ISSUE, label: '🟣 Quality Issue' },
  { value: ReturnReasonCategory.WRONG_ITEM, label: '⚪ Wrong Item Delivered' },
  { value: ReturnReasonCategory.OTHER, label: '⚫ Other' },
]

interface EditLineItem {
  id?: number
  item_id: number
  item_name: string
  quantity_returned: number
  amount: number
  reason: string
  reason_category: string
}

function ReturnsListPage() {
  const [page, setPage] = useState(1)
  const [reasonCategory, setReasonCategory] = useState('')
  const [returnType, setReturnType] = useState<string>('all')
  const [selectedReturn, setSelectedReturn] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    return_date: '',
    notes: '',
    line_items: [] as EditLineItem[],
  })

  const queryClient = useQueryClient()

  const { data: returns, isLoading } = useQuery({
    queryKey: ['returns', page, reasonCategory, returnType],
    queryFn: () => returnService.list({
      skip: (page - 1) * 20,
      limit: 20,
      reason_category: reasonCategory || undefined,
      is_partial: returnType === 'all' ? undefined : returnType === 'partial',
    }),
  })

  const { data: selectedReturnDetails } = useQuery({
    queryKey: ['return-details', selectedReturn?.id],
    queryFn: () => returnService.get(selectedReturn.id),
    enabled: !!selectedReturn && !showEditModal,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      returnService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      queryClient.invalidateQueries({ queryKey: ['return-details'] })
      setShowEditModal(false)
      setSelectedReturn(null)
      alert('Return updated successfully!')
    },
    onError: (error: any) => {
      alert(`Error updating return: ${error.response?.data?.detail || error.message}`)
    },
  })

  const getReasonBadge = (category: string) => {
    const found = REASON_CATEGORIES.find(c => c.value === category)
    return found?.label || category
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

    updateMutation.mutate({
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
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">↩️ Returns Management</h1>
        <p className="page-subtitle">View and manage all return transactions</p>
      </div>

      <div className="card mb-8">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Reason Category
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => {
                setReasonCategory(e.target.value)
                setPage(1)
              }}
              className="px-4 py-3 rounded-lg bg-slate-800 border-2 border-slate-700/50 text-slate-100 min-w-[200px]"
            >
              {REASON_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Return Type
            </label>
            <select
              value={returnType}
              onChange={(e) => {
                setReturnType(e.target.value)
                setPage(1)
              }}
              className="px-4 py-3 rounded-lg bg-slate-800 border-2 border-slate-700/50 text-slate-100 min-w-[150px]"
            >
              <option value="all">All Types</option>
              <option value="partial">⚠️ Partial</option>
              <option value="full">✅ Full</option>
            </select>
          </div>

          <button
            onClick={() => {
              setReasonCategory('')
              setReturnType('all')
              setPage(1)
            }}
            className="px-6 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 font-semibold transition-all"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <p className="text-xl text-slate-400">Loading returns...</p>
        </div>
      ) : !returns || returns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-xl text-slate-400">No returns found</p>
          <p className="text-slate-500 mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Return ID</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Date</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Invoice #</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Customer</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Items</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Credit</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Type</th>
                    <th className="text-left px-6 py-4 font-display font-semibold text-slate-300">Reason</th>
                    <th className="text-right px-6 py-4 font-display font-semibold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret: any) => (
                    <tr key={ret.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-all">
                      <td className="px-6 py-4 font-semibold text-slate-100">#{ret.id}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {format(new Date(ret.return_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{ret.invoice_number}</td>
                      <td className="px-6 py-4 text-slate-400">{ret.customer_name || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {ret.items_returned_count} of {ret.total_items_in_invoice}
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-400">₹{ret.total_credit.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {ret.is_partial ? (
                          <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-semibold">
                            ⚠️ Partial
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-semibold">
                            ✅ Full
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {ret.reason_category && (
                          <span className="px-2 py-1 rounded bg-slate-700/50 text-sm">
                            {getReasonBadge(ret.reason_category)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedReturn(ret)}
                          className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 text-blue-400 text-sm font-semibold transition-all"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditClick(ret)}
                          className="ml-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/50 text-amber-400 text-sm font-semibold transition-all"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-3 rounded-lg bg-slate-800 border-2 border-slate-700/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="px-6 py-3 text-slate-400">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(returns || []).length < 20}
              className="px-6 py-3 rounded-lg bg-slate-800 border-2 border-slate-700/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </>
      )}

      {selectedReturn && !showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-100">
                  Return #{selectedReturn.id}
                </h2>
                <p className="text-slate-400">{selectedReturn.invoice_number}</p>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="text-slate-400 hover:text-slate-200 text-2xl"
              >
                ×
              </button>
            </div>

            {selectedReturnDetails ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-slate-900/50">
                    <p className="text-sm text-slate-400">Return Date</p>
                    <p className="font-semibold text-slate-100">
                      {format(new Date(selectedReturnDetails.return_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/50">
                    <p className="text-sm text-slate-400">Total Credit</p>
                    <p className="font-semibold text-emerald-400 text-xl">
                      ₹{selectedReturnDetails.total_credit.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/50">
                    <p className="text-sm text-slate-400">Return Type</p>
                    <p className="font-semibold text-slate-100">
                      {selectedReturnDetails.is_partial ? '⚠️ Partial' : '✅ Full'}
                    </p>
                    <p className="text-sm text-slate-400">
                      {selectedReturnDetails.items_returned_count} of {selectedReturnDetails.total_items_in_invoice} items
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/50">
                    <p className="text-sm text-slate-400">Reason Category</p>
                    <p className="font-semibold text-slate-100">
                      {selectedReturnDetails.reason_category ? getReasonBadge(selectedReturnDetails.reason_category) : '-'}
                    </p>
                  </div>
                </div>

                {selectedReturnDetails.notes && (
                  <div className="mb-6 p-4 rounded-lg bg-slate-900/50">
                    <p className="text-sm text-slate-400 mb-1">Notes</p>
                    <p className="text-slate-200">{selectedReturnDetails.notes}</p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-100 mb-3">Items Returned</h3>
                  <div className="space-y-2">
                    {(selectedReturnDetails.line_items || []).map((li: any) => (
                      <div key={li.id} className="flex justify-between p-3 rounded-lg bg-slate-900/30">
                        <div>
                          <p className="font-semibold text-slate-200">{li.item_name || `Item #${li.item_id}`}</p>
                          <p className="text-sm text-slate-400">Qty: {li.quantity_returned}</p>
                        </div>
                        <p className="font-semibold text-emerald-400">₹{li.amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
                    📋 Stock Audit Trail
                  </h3>
                  <div className="space-y-2">
                    {(selectedReturnDetails.stock_audit || []).map((audit: any) => (
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
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl animate-bounce">⏳</div>
                <p className="text-slate-400">Loading details...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && selectedReturn && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-100">
                  Edit Return #{selectedReturn.id}
                </h2>
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
                <h3 className="text-lg font-semibold text-slate-100 mb-3">Items Returned</h3>
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
                          {EDIT_REASON_CATEGORIES.map(cat => (
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
                  disabled={updateMutation.isPending}
                  className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? 'Saving...' : '💾 Save Changes'}
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

export default ReturnsListPage
