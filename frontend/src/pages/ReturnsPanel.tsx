import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { returnService } from '../services/api'
import type { Invoice } from '../types/api'

interface ReturnsPanelProps {
  invoice: Invoice
}

function ReturnsPanel({ invoice }: ReturnsPanelProps) {
  const queryClient = useQueryClient()
  const [showNewReturnForm, setShowNewReturnForm] = useState(false)
  const [returnFormData, setReturnFormData] = useState({
    return_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({})

  const { data: returns, isLoading } = useQuery({
    queryKey: ['returns', invoice.id],
    queryFn: () => returnService.list(),
    enabled: !!invoice.id,
  })

  const createReturnMutation = useMutation({
    mutationFn: returnService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns', invoice.id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowNewReturnForm(false)
      setReturnFormData({ return_date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      setSelectedItems({})
      alert('Return created successfully!')
    },
  })

  const filteredReturns = (returns || []).filter((r: any) => r.invoice_id === invoice.id)

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
        }
      })

    if (returnItems.length === 0) {
      alert('Please select at least one item to return')
      return
    }

    createReturnMutation.mutate({
      invoice_id: invoice.id,
      return_date: returnFormData.return_date,
      total_credit: returnItems.reduce((sum, item) => sum + item.amount, 0),
      notes: returnFormData.notes,
      line_items: returnItems,
    })
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
                  Notes (Reason)
                </label>
                <input
                  type="text"
                  value={returnFormData.notes}
                  onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="Optional reason for return"
                />
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
                      onChange={(e) =>
                        setSelectedItems({
                          ...selectedItems,
                          [item.item_id]: Math.min(
                            parseInt(e.target.value) || 0,
                            item.quantity || 0
                          ),
                        })
                      }
                      className="w-24 px-3 py-2 rounded-lg bg-slate-800 border-2 border-slate-700/50 text-slate-100 focus:border-amber-500/50 focus:outline-none text-center"
                      placeholder="Qty"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{item.item_name || 'Unknown Item'}</p>
                      <p className="text-sm text-slate-400">
                        Max returnable: {item.quantity || 0} @ ₹{item.quantity > 0 ? (item.total / item.quantity).toFixed(2) : '0.00'} each
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
                disabled={createReturnMutation.isPending}
                className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2"
              >
                {createReturnMutation.isPending ? 'Processing...' : 'Create Return'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewReturnForm(false)
                  setSelectedItems({})
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
                  <h4 className="text-xl font-semibold text-slate-100 mb-1">
                    Return #{returnReceipt.id}
                  </h4>
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

              {returnReceipt.notes && (
                <div className="mb-4 p-3 rounded-lg bg-slate-900/50">
                  <p className="text-sm text-slate-400">
                    <span className="font-semibold">Reason:</span> {returnReceipt.notes}
                  </p>
                </div>
              )}

               <div className="border-t-2 border-slate-700/30 pt-4">
                <h5 className="text-sm font-semibold text-slate-300 mb-3">Items Returned</h5>
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
    </div>
  )
}

export default ReturnsPanel
