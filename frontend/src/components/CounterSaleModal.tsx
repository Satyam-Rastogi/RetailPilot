import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Search, ChevronDown, CheckCircle, Printer } from 'lucide-react'
import { counterSaleService, itemService, customerService } from '../services/api'
import type { ItemListResponse, CustomerListResponse, CounterSaleResult } from '../types/api'
import { cn } from '../lib/utils'

const inputCls = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'
const labelCls = 'block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5'

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'cheque', 'bank_transfer'] as const

interface LineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  gst_rate?: number
  unit_of_measurement?: string
}

// ── Item search combobox ──────────────────────────────────────────────────────
function ItemCombobox({ items, onSelect }: { items: ItemListResponse[]; onSelect: (i: ItemListResponse) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const filtered = useMemo(() => {
    const pool = items.filter(i => i.current_stock_quantity > 0)
    if (!query.trim()) return pool
    const q = query.toLowerCase()
    return pool.filter(i =>
      i.item_name.toLowerCase().includes(q) ||
      (i.brand_name && i.brand_name.toLowerCase().includes(q)) ||
      (i.sku && i.sku.toLowerCase().includes(q))
    )
  }, [items, query])

  useEffect(() => setActiveIdx(-1), [query])

  const openDropdown = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (item: ItemListResponse) => {
    onSelect(item); setOpen(false); setQuery(''); setActiveIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); setActiveIdx(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) { e.preventDefault(); handleSelect(filtered[activeIdx]) }
  }

  return (
    <div className="relative">
      <button ref={triggerRef} type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className={cn(inputCls, 'flex items-center justify-between text-left')}>
        <span className="text-ink-light/60">Search item to add (name / brand / SKU)…</span>
        <ChevronDown className={cn('w-4 h-4 text-ink-light shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && createPortal(
        <div ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="brutal-border bg-paper shadow-lg max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-light pointer-events-none" />
              <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown} placeholder="Name, brand, or SKU…"
                className="w-full pl-8 pr-3 py-1.5 bg-surface border border-line font-mono text-sm focus:outline-none focus:border-accent transition-colors" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0
              ? <p className="px-3 py-4 text-xs font-mono text-ink-light text-center uppercase tracking-widest">No items in stock</p>
              : filtered.map((i, idx) => (
                <button key={i.id} type="button" onClick={() => handleSelect(i)}
                  className={cn('w-full text-left px-3 py-2.5 transition-colors border-b border-line last:border-0 group',
                    activeIdx === idx ? 'bg-accent text-on-accent' : 'hover:bg-ink hover:text-surface')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold truncate">{i.item_name}</div>
                      {i.brand_name && <div className={cn('text-[10px] font-mono uppercase', activeIdx === idx ? 'text-on-accent/70' : 'text-ink-light group-hover:text-surface/60')}>{i.brand_name}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold">₹{i.selling_price_retail}</div>
                      <div className={cn('text-[10px] font-mono uppercase', i.current_stock_quantity <= (i.low_stock_threshold ?? 10) ? 'text-danger' : activeIdx === idx ? 'text-on-accent/70' : 'text-ink-light')}>
                        Stock: {i.current_stock_quantity}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Success receipt overlay ───────────────────────────────────────────────────
function SuccessReceipt({ result, onClose }: { result: CounterSaleResult; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-8 px-6 space-y-4">
      <CheckCircle className="w-14 h-14 text-success" />
      <div className="text-center">
        <div className="font-display font-bold text-2xl uppercase tracking-tighter">Sale Complete</div>
        <div className="font-mono text-xs text-ink-light uppercase tracking-widest mt-1">{result.invoice_number}</div>
      </div>
      <div className="w-full brutal-border bg-paper p-4 space-y-2 font-mono text-sm max-w-xs">
        <div className="flex justify-between">
          <span className="text-ink-light uppercase text-xs tracking-widest">Total</span>
          <span className="font-bold">₹{result.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-light uppercase text-xs tracking-widest">Received</span>
          <span>₹{result.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        {result.change_due > 0 && (
          <div className="flex justify-between border-t border-line pt-2">
            <span className="text-success uppercase text-xs tracking-widest font-bold">Change Due</span>
            <span className="font-bold text-success">₹{result.change_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-2">
          <span className="text-ink-light uppercase text-xs tracking-widest">Method</span>
          <span className="uppercase">{result.payment_method}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-light uppercase text-xs tracking-widest">Customer</span>
          <span className="truncate ml-4">{result.customer_name}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-colors brutal-focus">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
        <button onClick={onClose}
          className="px-4 py-2 bg-ink text-surface font-mono text-xs uppercase tracking-widest hover:bg-accent transition-colors brutal-focus">
          New Sale
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface CounterSaleModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CounterSaleModal({ open, onClose, onSuccess }: CounterSaleModalProps) {
  const queryClient = useQueryClient()
  const modalRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(open, onClose, modalRef)

  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [amountReceived, setAmountReceived] = useState('')
  const [discount, setDiscount] = useState(0)
  const [customerId, setCustomerId] = useState(0)  // 0 = will use Walk-in
  const [error, setError] = useState('')
  const [result, setResult] = useState<CounterSaleResult | null>(null)

  const { data: customers } = useQuery<CustomerListResponse[]>({
    queryKey: ['customers-all'],
    queryFn: () => customerService.list({ page_size: 500 }).then(r => r.data),
    enabled: open,
  })

  const { data: items } = useQuery<ItemListResponse[]>({
    queryKey: ['items-all'],
    queryFn: () => itemService.list({ page_size: 500 }).then(r => r.data),
    enabled: open,
  })

  // Auto-select Walk-in Customer when customers load
  useEffect(() => {
    if (customers && customerId === 0) {
      const walkin = customers.find(c => c.name === 'Walk-in Customer')
      if (walkin) setCustomerId(walkin.id)
    }
  }, [customers, customerId])

  const grandTotal = useMemo(() => {
    const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.price, 0)
    return Math.max(0, subtotal - discount)
  }, [lineItems, discount])

  const amountNum = parseFloat(amountReceived) || 0
  const changeDue = Math.max(0, amountNum - grandTotal)

  const mutation = useMutation({
    mutationFn: (data: any) => counterSaleService.create(data),
    onSuccess: (data: CounterSaleResult) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['items-all'] })
      onSuccess?.()
      setResult(data)
    },
    onError: (e: any) => setError(e.response?.data?.detail || 'Failed to complete sale'),
  })

  const handleAddItem = (item: ItemListResponse) => {
    const existing = lineItems.find(li => li.item_id === item.id)
    if (existing) {
      setLineItems(prev => prev.map(li => li.item_id === item.id ? { ...li, quantity: li.quantity + 1 } : li))
    } else {
      setLineItems(prev => [...prev, {
        item_id: item.id,
        item_name: item.item_name,
        quantity: 1,
        price: item.selling_price_retail,
        gst_rate: item.gst_rate,
        unit_of_measurement: item.unit_of_measurement,
      }])
    }
  }

  const handleSubmit = () => {
    setError('')
    if (lineItems.length === 0) { setError('Add at least one item'); return }
    if (!customerId) { setError('No customer selected'); return }
    if (amountNum < grandTotal) { setError(`Amount received (₹${amountNum.toFixed(2)}) is less than total (₹${grandTotal.toFixed(2)})`); return }

    mutation.mutate({
      customer_id: customerId,
      invoice_date: new Date().toISOString().split('T')[0],
      discount_type: 'amount',
      discount_amount: discount,
      line_items: lineItems.map(li => ({
        item_id: li.item_id,
        quantity: li.quantity,
        price: li.price,
        gst_rate: li.gst_rate ?? null,
      })),
      payment_method: paymentMethod,
      amount_paid: amountNum,
    })
  }

  const handleClose = () => {
    setLineItems([])
    setPaymentMethod('cash')
    setAmountReceived('')
    setDiscount(0)
    setCustomerId(0)
    setError('')
    setResult(null)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={modalRef} className="brutal-border bg-surface w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
          <div>
            <h2 className="font-display font-bold text-xl uppercase tracking-tighter">Counter Sale</h2>
            <p className="text-[10px] font-mono text-surface/60 uppercase tracking-widest mt-0.5">Invoice + payment in one step</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <SuccessReceipt result={result} onClose={() => {
            setResult(null)
            setLineItems([])
            setPaymentMethod('cash')
            setAmountReceived('')
            setDiscount(0)
          }} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && (
                <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider">{error}</div>
              )}

              {/* Customer (optional override) */}
              <div>
                <label className={labelCls}>Customer</label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(Number(e.target.value))}
                  className={inputCls}>
                  {customers?.map(c => (
                    <option key={c.id} value={c.id}>{c.name === 'Walk-in Customer' ? 'Walk-in Customer' : `${c.name} (${c.customer_type})`}</option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="brutal-border bg-paper p-4">
                <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">Items</div>
                <div className="mb-3">
                  <ItemCombobox items={items ?? []} onSelect={handleAddItem} />
                </div>
                {lineItems.length === 0
                  ? <p className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-4">No items added</p>
                  : (
                    <div className="divide-y divide-line">
                      {lineItems.map((li, idx) => (
                        <div key={li.item_id} className="flex items-center gap-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm font-medium truncate">{li.item_name}</p>
                            {li.gst_rate != null && (
                              <span className="text-[9px] font-mono text-accent uppercase tracking-widest">GST {li.gst_rate}%</span>
                            )}
                          </div>
                          <input type="number" min="1" value={li.quantity}
                            onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, parseInt(e.target.value) || 1) } : l))}
                            className="w-14 px-2 py-1 brutal-border bg-paper font-mono text-sm text-center focus:outline-none focus:border-accent" />
                          <span className="font-mono text-sm w-6 text-center text-ink-light">×</span>
                          <input type="number" step="0.01" value={li.price}
                            onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, price: parseFloat(e.target.value) || 0 } : l))}
                            className="w-24 px-2 py-1 brutal-border bg-paper font-mono text-sm text-center focus:outline-none focus:border-accent" />
                          <span className="font-mono font-bold text-sm w-20 text-right">
                            ₹{(li.quantity * li.price).toFixed(2)}
                          </span>
                          <button onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 brutal-border hover:border-danger hover:text-danger transition-colors brutal-focus">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* Discount + Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Discount ₹</label>
                  <input type="number" min="0" step="0.01" value={discount || ''}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1).replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Totals + Amount received */}
              <div className="brutal-border bg-paper p-4 space-y-3">
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-ink-light uppercase text-xs tracking-widest">Subtotal</span>
                  <span>₹{lineItems.reduce((s, li) => s + li.quantity * li.price, 0).toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-ink-light uppercase text-xs tracking-widest">Discount</span>
                    <span className="text-danger">−₹{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-mono font-bold text-base border-t border-line pt-2">
                  <span className="uppercase text-sm tracking-widest">Total</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>

                <div className="border-t border-line pt-3 grid grid-cols-2 gap-4 items-end">
                  <div>
                    <label className={labelCls}>Amount Received ₹</label>
                    <input type="number" step="0.01" value={amountReceived}
                      onChange={e => setAmountReceived(e.target.value)}
                      placeholder={grandTotal.toFixed(2)}
                      className={cn(inputCls, 'text-center font-bold text-base')} />
                  </div>
                  <div className="text-right">
                    {amountNum > 0 && amountNum >= grandTotal ? (
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-0.5">Change Due</div>
                        <div className="font-mono font-bold text-xl text-success">₹{changeDue.toFixed(2)}</div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-ink-light uppercase tracking-widest">Enter amount received</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-line bg-paper shrink-0 flex items-center justify-between gap-3">
              <button onClick={handleClose}
                className="px-4 py-2 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-colors brutal-focus">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={mutation.isPending || lineItems.length === 0 || (amountNum > 0 && amountNum < grandTotal)}
                className="px-6 py-2.5 bg-ink text-surface font-mono text-xs uppercase tracking-widest hover:bg-accent transition-colors brutal-focus disabled:opacity-40 disabled:cursor-not-allowed">
                {mutation.isPending ? 'Processing…' : `Collect ₹${grandTotal.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
