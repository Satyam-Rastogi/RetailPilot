import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Pencil, X, ClipboardList, RotateCcw } from 'lucide-react'
import { toast } from '../lib/toast'
import { returnService } from '../services/api'
import { ReturnReasonCategory, type Invoice, type ReturnReceipt } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

interface ReturnsPanelProps {
  invoice: Invoice
}

const REASON_OPTIONS = [
  { value: '', label: 'Select a reason' },
  { value: ReturnReasonCategory.DAMAGED, label: 'Damaged Goods' },
  { value: ReturnReasonCategory.UNABLE_TO_PAY, label: 'Unable to Pay' },
  { value: ReturnReasonCategory.UNABLE_TO_SELL, label: 'Unable to Sell' },
  { value: ReturnReasonCategory.BETTER_DEAL, label: 'Better Deal' },
  { value: ReturnReasonCategory.QUALITY_ISSUE, label: 'Quality Issue' },
  { value: ReturnReasonCategory.WRONG_ITEM, label: 'Wrong Item' },
  { value: ReturnReasonCategory.OTHER, label: 'Other' },
]

function getReasonLabel(category: string) {
  return REASON_OPTIONS.find(c => c.value === category)?.label ?? category
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
  const { formatCurrency } = useSettings()

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

  const auditModalRef = useRef<HTMLDivElement>(null)
  const editModalRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(showAuditModal, () => setShowAuditModal(false), auditModalRef)
  useModalKeyboard(showEditModal, () => setShowEditModal(false), editModalRef)

  // Escape closes the inline new-return form
  useEffect(() => {
    if (!showNewReturnForm || showAuditModal || showEditModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowNewReturnForm(false); setSelectedItems({}); setReturnType('partial') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showNewReturnForm, showAuditModal, showEditModal])
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
      toast.success('Return created successfully.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create return.')
    },
  })

  const updateReturnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => returnService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns', invoice.id] })
      queryClient.invalidateQueries({ queryKey: ['return-details'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowEditModal(false)
      setSelectedReturn(null)
      toast.success('Return updated successfully.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update return.')
    },
  })

  const filteredReturns = (returns || []).filter((r: any) => r.invoice_id === invoice.id)
  const totalInvoiceItems = invoice.line_items?.reduce((sum, li) => sum + (li.quantity || 0), 0) || 0
  const totalSelectedItems = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0)

  const handleFullReturn = () => {
    const allItems: Record<number, number> = {}
    invoice.line_items?.forEach(li => {
      if (li.item_id && li.quantity) allItems[li.item_id] = li.quantity
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
          amount: (invoiceItem && invoiceItem.quantity > 0)
            ? ((invoiceItem.total || (invoiceItem.quantity * (invoiceItem.price || 0))) / invoiceItem.quantity) * qty
            : 0,
          reason: returnFormData.notes || 'Customer return',
          reason_category: returnFormData.reason_category as ReturnReasonCategory || undefined,
        }
      })

    if (returnItems.length === 0) {
      toast.error('Please select at least one item to return.')
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

  const estimatedCredit = Object.entries(selectedItems)
    .filter(([_, qty]) => qty > 0)
    .reduce((sum, [itemId, qty]) => {
      const invoiceItem = (invoice.line_items || []).find(li => li.item_id === parseInt(itemId))
      if (!invoiceItem || !invoiceItem.quantity || invoiceItem.quantity === 0) return sum
      return sum + ((invoiceItem.total || (invoiceItem.quantity * (invoiceItem.price || 0))) / invoiceItem.quantity) * qty
    }, 0)

  const inputClass = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-heading text-xl">Returns</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light mt-1">
            {invoice.invoice_number} — {filteredReturns.length} return{filteredReturns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNewReturnForm(!showNewReturnForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
        >
          {showNewReturnForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showNewReturnForm ? 'Cancel' : 'New Return'}
        </button>
      </div>

      {/* New Return Form */}
      {showNewReturnForm && (
        <div className="brutal-border border-accent bg-accent/5 p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-4">Create New Return</div>
          <form onSubmit={handleCreateReturn} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Return Date *</label>
                <input
                  type="date"
                  value={returnFormData.return_date}
                  onChange={(e) => setReturnFormData({ ...returnFormData, return_date: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Reason Category *</label>
                <select
                  value={returnFormData.reason_category}
                  onChange={(e) => setReturnFormData({ ...returnFormData, reason_category: e.target.value })}
                  className={inputClass}
                  required
                >
                  {REASON_OPTIONS.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Additional Notes</label>
              <input
                type="text"
                value={returnFormData.notes}
                onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                className={inputClass}
                placeholder="Optional additional details"
              />
            </div>

            {/* Return Type Toggle */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light">Return Type</label>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 brutal-border font-mono text-[10px] uppercase tracking-widest hover:border-accent hover:text-accent transition-colors brutal-focus"
                >
                  <RotateCcw className="w-3 h-3" />
                  {returnType === 'partial' ? 'Select All (Full Return)' : 'Switch to Partial'}
                </button>
              </div>
              <div className="flex gap-3 mb-4">
                <span className={cn(
                  'brutal-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest',
                  returnType === 'partial' ? 'text-warning border-warning' : 'text-ink-light border-line'
                )}>
                  Partial ({totalSelectedItems}/{totalInvoiceItems})
                </span>
                <span className={cn(
                  'brutal-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest',
                  returnType === 'full' ? 'text-success border-success' : 'text-ink-light border-line'
                )}>
                  Full
                </span>
              </div>
            </div>

            {/* Item Selection */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-3">Items to Return</label>
              <div className="space-y-2">
                {(invoice.line_items || []).map((item) => (
                  <div key={item.item_id} className="flex items-center gap-4 brutal-border bg-paper p-3">
                    <input
                      type="number"
                      min="0"
                      max={item.quantity || 0}
                      value={selectedItems[item.item_id] || 0}
                      onChange={(e) => {
                        const val = Math.min(parseInt(e.target.value) || 0, item.quantity || 0)
                        setSelectedItems({ ...selectedItems, [item.item_id || 0]: val })
                        if (val < (item.quantity || 0)) setReturnType('partial')
                      }}
                      className="w-20 px-2 py-1.5 brutal-border bg-surface text-ink font-mono text-sm text-center focus:outline-none focus:border-accent transition-colors"
                      placeholder="Qty"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold truncate">{item.item_name || 'Unknown Item'}</div>
                      <div className="font-mono text-[10px] text-ink-light">
                        Max: {item.quantity || 0} @ {item.quantity > 0 ? formatCurrency((item.total || 0) / item.quantity) : '—'} each
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light">Total</div>
                      <div className="font-mono text-sm font-bold">{formatCurrency(item.total || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated Credit */}
            {estimatedCredit > 0 && (
              <div className="brutal-border border-success bg-success/5 p-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-success">Estimated Credit</span>
                  <span className="font-display font-bold text-xl text-success">{formatCurrency(estimatedCredit)}</span>
                </div>
                <p className="font-mono text-[10px] text-ink-light mt-1 uppercase tracking-widest">
                  Items will be added back to stock
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createReturnMutation.isPending || totalSelectedItems === 0}
                className="flex-1 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {createReturnMutation.isPending ? 'Processing...' : 'Create Return'}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewReturnForm(false); setSelectedItems({}); setReturnType('partial') }}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Returns List */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-12 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading returns...</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="brutal-border bg-surface p-12 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-1">No returns for this invoice</p>
          <p className="font-mono text-[10px] text-ink-muted uppercase tracking-widest">
            Click "New Return" to create a return receipt
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReturns.map((returnReceipt: any) => (
            <div key={returnReceipt.id} className="brutal-border bg-surface p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm font-bold">Return #{returnReceipt.id}</span>
                    <span className={cn(
                      'brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
                      returnReceipt.is_partial ? 'text-warning border-warning' : 'text-success border-success'
                    )}>
                      {returnReceipt.is_partial ? 'Partial' : 'Full'}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light">
                    {format(new Date(returnReceipt.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-xl text-success">
                    +{formatCurrency(returnReceipt.total_credit)}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-success/70">Credit</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {returnReceipt.reason_category && (
                  <span className="brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-light">
                    {getReasonLabel(returnReceipt.reason_category)}
                  </span>
                )}
                {returnReceipt.is_partial && returnReceipt.items_returned_count !== undefined && (
                  <span className="brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-light">
                    {returnReceipt.items_returned_count}/{returnReceipt.total_items_in_invoice} items
                  </span>
                )}
              </div>

              {returnReceipt.notes && (
                <div className="brutal-border bg-paper p-3 mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-light">Notes: </span>
                  <span className="font-mono text-xs">{returnReceipt.notes}</span>
                </div>
              )}

              <div className="border-t border-line pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-light">Items Returned</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedReturn(returnReceipt); setShowAuditModal(true) }}
                      className="flex items-center gap-1.5 p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                      title="View stock audit trail"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditClick(returnReceipt)}
                      className="flex items-center gap-1.5 p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                      title="Edit return"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {(returnReceipt.line_items || []).map((lineItem: any) => (
                    <div key={lineItem.id} className="flex items-center justify-between font-mono text-sm">
                      <span className="text-ink-light">{lineItem.item_name || 'Unknown Item'}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] uppercase tracking-widest text-ink-muted">Qty: {lineItem.quantity_returned || 0}</span>
                        <span className="font-bold text-success">{formatCurrency(lineItem.amount || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Modal */}
      {showAuditModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowAuditModal(false) }}>
          <div ref={auditModalRef} className="brutal-border bg-surface w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  <h3 className="font-display font-bold text-lg uppercase tracking-tighter">Stock Audit Trail</h3>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface/60 mt-0.5">
                  Return #{selectedReturn.id}
                </p>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {returnDetails ? (
                <div className="space-y-3">
                  {(returnDetails.stock_audit || []).length > 0 ? (
                    (returnDetails.stock_audit || []).map((audit: any) => (
                      <div key={audit.id} className="brutal-border border-success bg-success/5 p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-mono text-sm font-bold text-success">
                              {audit.item_name || `Item #${audit.item_id}`}
                            </div>
                            <div className="font-mono text-[10px] text-ink-light mt-0.5">{audit.reason}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-success">+{audit.quantity_change} units</div>
                            <div className="font-mono text-[10px] text-ink-muted">
                              {audit.created_at ? format(new Date(audit.created_at), 'dd MMM yyyy, HH:mm') : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="font-mono text-sm uppercase tracking-widest text-ink-light">No audit entries found</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading audit trail...</p>
                </div>
              )}
            </div>

            <div className="border-t border-line p-5 shrink-0 bg-paper">
              <button
                onClick={() => setShowAuditModal(false)}
                className="w-full px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false) }}>
          <div ref={editModalRef} className="brutal-border bg-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h3 className="font-display font-bold text-xl uppercase tracking-tighter">
                  Edit Return #{selectedReturn.id}
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface/60 mt-0.5">
                  {selectedReturn.invoice_number}
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Return Date</label>
                <input
                  type="date"
                  value={editFormData.return_date}
                  onChange={(e) => setEditFormData({ ...editFormData, return_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className={cn(inputClass, 'resize-none')}
                  rows={3}
                  placeholder="Add notes about this return..."
                />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-3">Items Returned</div>
                <div className="space-y-3">
                  {editFormData.line_items.map((item, index) => (
                    <div key={index} className="brutal-border bg-paper p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold">{item.item_name}</span>
                        <button
                          onClick={() => handleRemoveLineItem(index)}
                          className="p-1.5 brutal-border hover:bg-danger hover:text-paper hover:border-danger transition-colors brutal-focus"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity_returned}
                            onChange={(e) => handleLineItemChange(index, 'quantity_returned', parseInt(e.target.value) || 0)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Credit Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value) || 0)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Reason Category</label>
                        <select
                          value={item.reason_category}
                          onChange={(e) => handleLineItemChange(index, 'reason_category', e.target.value)}
                          className={inputClass}
                        >
                          {REASON_OPTIONS.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Reason Notes</label>
                        <input
                          type="text"
                          value={item.reason}
                          onChange={(e) => handleLineItemChange(index, 'reason', e.target.value)}
                          className={inputClass}
                          placeholder="Additional details..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateReturnMutation.isPending}
                className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {updateReturnMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReturnsPanel
