import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Eye, Pencil, X, ClipboardList, FileText, Plus, Package } from 'lucide-react'
import { toast } from '../lib/toast'
import { returnService, customerService, itemService } from '../services/api'
import { ReturnReasonCategory, type ReturnReceipt } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'

interface GRItem {
  item_id: number
  item_name: string
  quantity_returned: number
  unit_price: number
  reason_category: string
}

const REASON_FILTER_OPTIONS = [
  { value: '', label: 'All Reasons' },
  { value: ReturnReasonCategory.DAMAGED, label: 'Damaged Goods' },
  { value: ReturnReasonCategory.UNABLE_TO_PAY, label: 'Unable to Pay' },
  { value: ReturnReasonCategory.UNABLE_TO_SELL, label: 'Unable to Sell' },
  { value: ReturnReasonCategory.BETTER_DEAL, label: 'Better Deal' },
  { value: ReturnReasonCategory.QUALITY_ISSUE, label: 'Quality Issue' },
  { value: ReturnReasonCategory.WRONG_ITEM, label: 'Wrong Item' },
  { value: ReturnReasonCategory.OTHER, label: 'Other' },
]

const REASON_EDIT_OPTIONS = [
  { value: '', label: 'Select a reason' },
  { value: ReturnReasonCategory.DAMAGED, label: 'Damaged Goods' },
  { value: ReturnReasonCategory.UNABLE_TO_PAY, label: 'Unable to Pay' },
  { value: ReturnReasonCategory.UNABLE_TO_SELL, label: 'Unable to Sell' },
  { value: ReturnReasonCategory.BETTER_DEAL, label: 'Better Deal' },
  { value: ReturnReasonCategory.QUALITY_ISSUE, label: 'Quality Issue' },
  { value: ReturnReasonCategory.WRONG_ITEM, label: 'Wrong Item' },
  { value: ReturnReasonCategory.OTHER, label: 'Other' },
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

function getReasonLabel(category: string) {
  return REASON_FILTER_OPTIONS.find(c => c.value === category)?.label ?? category
}

function ReturnsListPage() {
  const navigate = useNavigate()
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

  // GR (Goods Return — no invoice) state
  const [showGRForm, setShowGRForm] = useState(false)
  const [grFormData, setGrFormData] = useState({
    customer_id: '',
    return_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    reason_category: '',
  })
  const [grItems, setGrItems] = useState<GRItem[]>([])
  const [grItemSelect, setGrItemSelect] = useState('')

  const queryClient = useQueryClient()
  const { formatCurrency } = useSettings()

  const { data: customersData } = useQuery({
    queryKey: ['customers-for-gr'],
    queryFn: () => customerService.list({ page_size: 200 }),
    enabled: showGRForm,
  })
  const { data: itemsData } = useQuery({
    queryKey: ['items-for-gr'],
    queryFn: () => itemService.list({ page_size: 300 }),
    enabled: showGRForm,
  })
  const allCustomers: any[] = customersData?.data ?? customersData ?? []
  const allItems: any[] = itemsData?.data ?? itemsData ?? []

  const createGRMutation = useMutation({
    mutationFn: returnService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      setShowGRForm(false)
      setGrFormData({ customer_id: '', return_date: format(new Date(), 'yyyy-MM-dd'), notes: '', reason_category: '' })
      setGrItems([])
      setGrItemSelect('')
      toast.success('Goods Return created. Credit note added to customer account.')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create GR.')
    },
  })

  const handleAddGRItem = () => {
    const item = allItems.find((i: any) => String(i.id) === grItemSelect)
    if (!item) return
    if (grItems.some(gi => gi.item_id === item.id)) {
      toast.warning('Item already added. Adjust quantity in the list.')
      return
    }
    setGrItems(prev => [...prev, {
      item_id: item.id,
      item_name: item.item_name,
      quantity_returned: 1,
      unit_price: item.selling_price_wholesale ?? item.selling_price_retail ?? 0,
      reason_category: grFormData.reason_category,
    }])
    setGrItemSelect('')
  }

  const handleGRItemChange = (idx: number, field: keyof GRItem, value: any) => {
    setGrItems(prev => prev.map((gi, i) => i === idx ? { ...gi, [field]: value } : gi))
  }

  const handleSubmitGR = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grFormData.customer_id) { toast.error('Select a customer.'); return }
    if (grItems.length === 0) { toast.error('Add at least one item.'); return }
    const totalQty = grItems.reduce((s, gi) => s + gi.quantity_returned, 0)
    createGRMutation.mutate({
      customer_id: parseInt(grFormData.customer_id),
      return_date: grFormData.return_date,
      notes: grFormData.notes || undefined,
      line_items: grItems.map(gi => ({
        item_id: gi.item_id,
        quantity_returned: gi.quantity_returned,
        amount: gi.quantity_returned * gi.unit_price,
        reason: grFormData.notes || 'Goods Return',
        reason_category: gi.reason_category || grFormData.reason_category || undefined,
      })),
      is_partial: true,
      total_items_in_invoice: totalQty,
      items_returned_count: totalQty,
    })
  }

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
    mutationFn: ({ id, data }: { id: number; data: any }) => returnService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      queryClient.invalidateQueries({ queryKey: ['return-details'] })
      setShowEditModal(false)
      setSelectedReturn(null)
      toast.success('Return updated successfully.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update return.')
    },
  })

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

  const inputClass = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="border-b border-line pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="type-heading"
            >
              Returns
            </motion.h1>
            <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">
              Return receipts &amp; credit management
            </p>
            <div className="w-16 h-0.5 bg-accent mt-4" />
          </div>
          <button
            onClick={() => setShowGRForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all shrink-0 mt-1"
          >
            <Plus className="w-4 h-4" /> New GR
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="brutal-border bg-surface p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
              Reason Category
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => { setReasonCategory(e.target.value); setPage(1) }}
              className={inputClass}
            >
              {REASON_FILTER_OPTIONS.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
              Return Type
            </label>
            <select
              value={returnType}
              onChange={(e) => { setReturnType(e.target.value); setPage(1) }}
              className={inputClass}
            >
              <option value="all">All Types</option>
              <option value="partial">Partial</option>
              <option value="full">Full</option>
            </select>
          </div>
          <button
            onClick={() => { setReasonCategory(''); setReturnType('all'); setPage(1) }}
            className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading returns...</p>
        </div>
      ) : !returns || returns.length === 0 ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-2">No returns found</p>
          <p className="font-mono text-xs text-ink-light opacity-60">
            {reasonCategory || returnType !== 'all' ? 'Try adjusting your filters' : 'No return receipts recorded yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="brutal-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest">Return Receipts</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">{returns.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="bg-surface text-ink-light border-b border-line">
                    <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Return ID</th>
                    <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Invoice #</th>
                    <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Customer</th>
                    <th className="px-4 py-3 text-center text-[10px] font-mono uppercase tracking-widest">Items</th>
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Credit</th>
                    <th className="px-4 py-3 text-center text-[10px] font-mono uppercase tracking-widest">Type</th>
                    <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Reason</th>
                    <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {returns.map((ret: any) => (
                    <tr key={ret.id} className="hover:bg-paper transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-bold">#{ret.id}</td>
                      <td className="px-4 py-3 font-mono text-sm text-ink-light">
                        {format(new Date(ret.return_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {ret.is_gr ? (
                          <span className="brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent border-accent flex items-center gap-1 w-fit">
                            <Package className="w-3 h-3" /> GR
                          </span>
                        ) : (
                          ret.invoice_number || <span className="opacity-40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-ink-light">{ret.customer_name || <span className="opacity-40">—</span>}</td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-ink-light">
                        {ret.items_returned_count} / {ret.total_items_in_invoice}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-success">
                        {formatCurrency(ret.total_credit)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
                          ret.is_partial ? 'text-warning border-warning' : 'text-success border-success'
                        )}>
                          {ret.is_partial ? 'Partial' : 'Full'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ret.reason_category ? (
                          <span className="brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-light">
                            {getReasonLabel(ret.reason_category)}
                          </span>
                        ) : (
                          <span className="opacity-40 font-mono text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedReturn(ret)}
                            className="p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClick(ret)}
                            className="p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                            title="Edit return"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {ret.invoice_id && (
                            <button
                              onClick={() => navigate(`/invoices/${ret.invoice_id}`)}
                              className="p-1.5 brutal-border hover:bg-ink hover:text-surface hover:border-ink transition-colors brutal-focus"
                              title="View invoice"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="font-mono text-sm text-ink-light">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(returns || []).length < 20}
              className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* New GR Modal */}
      {showGRForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
          <div className="brutal-border bg-surface w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tighter flex items-center gap-2">
                  <Package className="w-5 h-5" /> Goods Return Note
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface/60 mt-0.5">
                  No invoice reference — credit added to customer account
                </p>
              </div>
              <button onClick={() => setShowGRForm(false)} className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGR} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Customer + Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Customer *</label>
                    <select
                      required
                      value={grFormData.customer_id}
                      onChange={(e) => setGrFormData({ ...grFormData, customer_id: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select customer…</option>
                      {[...allCustomers]
                        .sort((a: any, b: any) => (a.customer_type === 'Wholesale' ? -1 : 1))
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.customer_type})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Return Date *</label>
                    <input
                      type="date"
                      required
                      value={grFormData.return_date}
                      onChange={(e) => setGrFormData({ ...grFormData, return_date: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Reason + Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Reason Category</label>
                    <select
                      value={grFormData.reason_category}
                      onChange={(e) => setGrFormData({ ...grFormData, reason_category: e.target.value })}
                      className={inputClass}
                    >
                      {REASON_EDIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Notes</label>
                    <input
                      type="text"
                      value={grFormData.notes}
                      onChange={(e) => setGrFormData({ ...grFormData, notes: e.target.value })}
                      placeholder="Optional details"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Item picker */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Add Item</label>
                  <div className="flex gap-2">
                    <select
                      value={grItemSelect}
                      onChange={(e) => setGrItemSelect(e.target.value)}
                      className={cn(inputClass, 'flex-1')}
                    >
                      <option value="">Select item from catalog…</option>
                      {allItems.map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.item_name} — WS: {formatCurrency(item.selling_price_wholesale ?? 0)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddGRItem}
                      disabled={!grItemSelect}
                      className="px-4 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Added items list */}
                {grItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light">Items to Return</div>
                    {grItems.map((gi, idx) => (
                      <div key={gi.item_id} className="brutal-border bg-paper p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-bold">{gi.item_name}</span>
                          <button
                            type="button"
                            onClick={() => setGrItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 brutal-border hover:bg-danger hover:text-paper hover:border-danger transition-colors brutal-focus"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-ink-light mb-1">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={gi.quantity_returned}
                              onChange={(e) => handleGRItemChange(idx, 'quantity_returned', parseInt(e.target.value) || 1)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-ink-light mb-1">Unit Credit</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={gi.unit_price}
                              onChange={(e) => handleGRItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-ink-light mb-1">Total</label>
                            <div className="px-3 py-2.5 brutal-border bg-surface font-mono text-sm font-bold text-success">
                              {formatCurrency(gi.quantity_returned * gi.unit_price)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center font-mono text-sm pt-1 border-t border-line">
                      <span className="text-ink-light uppercase tracking-widest text-[10px]">Total GR Credit</span>
                      <span className="font-bold text-success text-lg">
                        {formatCurrency(grItems.reduce((s, gi) => s + gi.quantity_returned * gi.unit_price, 0))}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-ink-light uppercase tracking-widest">
                      Items will be added back to stock. Credit note created on customer account.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
                <button type="button" onClick={() => setShowGRForm(false)}
                  className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
                  Cancel
                </button>
                <button type="submit" disabled={createGRMutation.isPending || grItems.length === 0}
                  className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50">
                  {createGRMutation.isPending ? 'Creating…' : 'Create GR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {selectedReturn && !showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
          <div className="brutal-border bg-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tighter flex items-center gap-2">
                  {selectedReturn.is_gr && <Package className="w-5 h-5" />}
                  Return #{selectedReturn.id}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface/60 mt-0.5">
                  {selectedReturn.is_gr
                    ? `Goods Return — ${selectedReturn.customer_name ?? 'Customer'}`
                    : selectedReturn.invoice_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {selectedReturnDetails ? (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-0 divide-x divide-line border border-line">
                    <div className="p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Return Date</div>
                      <div className="font-mono font-bold text-sm">
                        {format(new Date(selectedReturnDetails.return_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Credit</div>
                      <div className="font-mono font-bold text-sm text-success">
                        {formatCurrency(selectedReturnDetails.total_credit)}
                      </div>
                    </div>
                    <div className="p-4 border-t border-line">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Type</div>
                      <span className={cn(
                        'brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
                        selectedReturnDetails.is_partial ? 'text-warning border-warning' : 'text-success border-success'
                      )}>
                        {selectedReturnDetails.is_partial ? 'Partial' : 'Full'}
                      </span>
                      <div className="font-mono text-[10px] text-ink-light mt-1">
                        {selectedReturnDetails.items_returned_count} of {selectedReturnDetails.total_items_in_invoice} items
                      </div>
                    </div>
                    <div className="p-4 border-t border-line">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Reason</div>
                      <div className="font-mono text-sm">
                        {selectedReturnDetails.reason_category
                          ? getReasonLabel(selectedReturnDetails.reason_category)
                          : <span className="opacity-40">—</span>
                        }
                      </div>
                    </div>
                  </div>

                  {selectedReturnDetails.notes && (
                    <div className="brutal-border bg-paper p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Notes</div>
                      <div className="font-mono text-sm">{selectedReturnDetails.notes}</div>
                    </div>
                  )}

                  {/* Items */}
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-3">Items Returned</div>
                    <div className="space-y-2">
                      {(selectedReturnDetails.line_items || []).map((li: any) => (
                        <div key={li.id} className="flex justify-between items-center brutal-border p-3 bg-paper">
                          <div>
                            <div className="font-mono text-sm font-bold">{li.item_name || `Item #${li.item_id}`}</div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mt-0.5">
                              Qty: {li.quantity_returned}
                            </div>
                          </div>
                          <div className="font-mono text-sm font-bold text-success">{formatCurrency(li.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stock Audit */}
                  {(selectedReturnDetails.stock_audit || []).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-light mb-3">
                        <ClipboardList className="w-3.5 h-3.5" /> Stock Audit Trail
                      </div>
                      <div className="space-y-2">
                        {(selectedReturnDetails.stock_audit || []).map((audit: any) => (
                          <div key={audit.id} className="brutal-border border-success bg-success/5 p-3">
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
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center">
                  <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading details...</p>
                </div>
              )}
            </div>

            <div className="border-t border-line p-5 shrink-0 bg-paper">
              <button
                onClick={() => setSelectedReturn(null)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
          <div className="brutal-border bg-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tighter">
                  Edit Return #{selectedReturn.id}
                </h2>
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
                          {REASON_EDIT_OPTIONS.map(cat => (
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
                disabled={updateMutation.isPending}
                className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReturnsListPage
