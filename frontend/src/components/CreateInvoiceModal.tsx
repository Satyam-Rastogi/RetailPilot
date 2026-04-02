import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { X, Search, ChevronDown, UserPlus } from 'lucide-react'
import { invoiceService, customerService, itemService } from '../services/api'
import type { CustomerListResponse, ItemListResponse } from '../types/api'
import { cn } from '../lib/utils'

const inputCls = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'
const labelCls = 'block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5'

interface CreateLineItem {
  item_id: number
  item_name: string
  quantity: number
  price: number
  discount_amount: number
  discount_type: string
  unit_of_measurement?: string
  gst_rate?: number
  hsn_sac_code?: string
}

// ── Customer fuzzy combobox ───────────────────────────────────────────────────
function CustomerCombobox({
  customers,
  selectedId,
  onChange,
}: {
  customers: CustomerListResponse[]
  selectedId: number
  onChange: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = customers.find(c => c.id === selectedId)

  const walkin = customers.find(c => c.name === 'Walk-in Customer')
  const rest = customers.filter(c => c.name !== 'Walk-in Customer')

  const filtered = useMemo(() => {
    if (!query.trim()) return rest
    const q = query.toLowerCase()
    return rest.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.customer_type.toLowerCase().includes(q) ||
      (c.phone_number && c.phone_number.toLowerCase().includes(q))
    )
  }, [rest, query])

  const allOptions = useMemo(() => [...(walkin ? [walkin] : []), ...filtered], [walkin, filtered])
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
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (id: number) => {
    onChange(id)
    setOpen(false)
    setQuery('')
    setActiveIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); setActiveIdx(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allOptions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0 && allOptions[activeIdx]) { e.preventDefault(); handleSelect(allOptions[activeIdx].id) }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className={cn(inputCls, 'flex items-center justify-between text-left')}
      >
        <span className={selectedId ? 'text-ink' : 'text-ink-light/60'}>
          {selected
            ? selected.name === 'Walk-in Customer'
              ? 'Walk-in Customer'
              : `${selected.name} (${selected.customer_type})`
            : 'Search customer...'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-ink-light shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="brutal-border bg-paper shadow-lg max-h-60 overflow-hidden flex flex-col"
        >
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-light pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface border border-line font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {/* Walk-in pinned at top — always visible regardless of search */}
            {walkin && (
              <button
                type="button"
                onClick={() => handleSelect(walkin.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 border-b-2 border-line transition-colors',
                  allOptions[activeIdx]?.id === walkin.id
                    ? 'bg-accent text-on-accent'
                    : walkin.id === selectedId
                      ? 'bg-ink text-surface'
                      : 'hover:bg-ink hover:text-surface'
                )}
              >
                <span className="font-mono text-sm font-bold">Walk-in Customer</span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-current shrink-0">
                  Walk-in
                </span>
              </button>
            )}
            {filtered.length === 0 && !walkin ? (
              <p className="px-3 py-4 text-xs font-mono text-ink-light text-center uppercase tracking-widest">No customers found</p>
            ) : filtered.map((c, i) => {
              const optIdx = walkin ? i + 1 : i
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors border-b border-line last:border-0',
                    activeIdx === optIdx
                      ? 'bg-accent text-on-accent'
                      : c.id === selectedId
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-ink hover:text-surface'
                  )}
                >
                  <span className="font-mono text-sm truncate">{c.name}</span>
                  <span className={cn(
                    'text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border shrink-0',
                    activeIdx === optIdx ? 'border-current' : c.customer_type === 'Wholesale' ? 'border-accent text-accent' : 'border-line text-ink-light'
                  )}>
                    {c.customer_type}
                  </span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Item fuzzy combobox ───────────────────────────────────────────────────────
function ItemCombobox({
  items,
  isWholesale,
  onSelect,
}: {
  items: ItemListResponse[]
  isWholesale: boolean
  onSelect: (item: ItemListResponse) => void
}) {
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
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => setActiveIdx(-1), [query])

  const handleSelect = (item: ItemListResponse) => {
    onSelect(item)
    setOpen(false)
    setQuery('')
    setActiveIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); setActiveIdx(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) { e.preventDefault(); handleSelect(filtered[activeIdx]) }
  }

  return (
    <div className="relative flex-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className={cn(inputCls, 'flex items-center justify-between text-left')}
      >
        <span className="text-ink-light/60">Search item to add (name / brand / SKU)...</span>
        <ChevronDown className={cn('w-4 h-4 text-ink-light shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="brutal-border bg-paper shadow-lg max-h-64 overflow-hidden flex flex-col"
        >
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-light pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Name, brand, or SKU..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface border border-line font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs font-mono text-ink-light text-center uppercase tracking-widest">No items found</p>
            ) : filtered.map((i, idx) => (
              <button
                key={i.id}
                type="button"
                onClick={() => handleSelect(i)}
                className={cn(
                  'w-full text-left px-3 py-2.5 transition-colors border-b border-line last:border-0 group',
                  activeIdx === idx ? 'bg-accent text-on-accent' : 'hover:bg-ink hover:text-surface'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold truncate">{i.item_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {i.brand_name && <span className={cn('text-[10px] font-mono uppercase', activeIdx === idx ? 'text-on-accent/70' : 'text-ink-light group-hover:text-surface/60')}>{i.brand_name}</span>}
                      {i.sku && <span className={cn('text-[10px] font-mono', activeIdx === idx ? 'text-on-accent/50' : 'text-ink-light/60 group-hover:text-surface/40')}>{i.sku}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold">
                      ₹{isWholesale ? i.selling_price_wholesale : i.selling_price_retail}
                    </div>
                    <div className={cn('text-[10px] font-mono uppercase', i.current_stock_quantity <= (i.low_stock_threshold ?? 10) ? 'text-danger' : activeIdx === idx ? 'text-on-accent/70' : 'text-ink-light group-hover:text-surface/60')}>
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

// ── Main modal ────────────────────────────────────────────────────────────────
interface CreateInvoiceModalProps {
  open: boolean
  onClose: () => void
}

export function CreateInvoiceModal({ open, onClose }: CreateInvoiceModalProps) {
  const queryClient = useQueryClient()

  const [createForm, setCreateForm] = useState({
    customer_id: 0,
    invoice_date: new Date().toISOString().split('T')[0],
    discount_type: 'amount',
    discount_amount: 0,
    tax_rate: 5,
    po_number: '',
    shipping_address: '',
    notes: '',
  })
  const [createLineItems, setCreateLineItems] = useState<CreateLineItem[]>([])
  const [createError, setCreateError] = useState('')

  // Quick-add customer
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [qaForm, setQaForm] = useState({ name: '', type: 'Retail', phone: '', gstin: '' })
  const [qaError, setQaError] = useState('')

  // Keyboard accessibility
  const mainModalRef = useRef<HTMLDivElement>(null)
  const quickAddRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(open && !showQuickAdd, onClose, mainModalRef)
  useModalKeyboard(showQuickAdd, () => setShowQuickAdd(false), quickAddRef)

  const quickAddMutation = useMutation({
    mutationFn: (data: any) => customerService.create(data),
    onSuccess: (newCustomer: any) => {
      queryClient.invalidateQueries({ queryKey: ['customers-all'] })
      handleCustomerChange(newCustomer.id)
      setShowQuickAdd(false)
      setQaForm({ name: '', type: 'Retail', phone: '', gstin: '' })
      setQaError('')
    },
    onError: (e: any) => setQaError(e.response?.data?.detail || 'Failed to create customer'),
  })

  const handleQuickAddSubmit = () => {
    if (!qaForm.name.trim()) { setQaError('Name is required'); return }
    quickAddMutation.mutate({
      name: qaForm.name.trim(),
      customer_type: qaForm.type,
      phone_number: qaForm.phone.trim() || undefined,
      gstin: qaForm.gstin.trim() || undefined,
    })
  }

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

  const createMutation = useMutation({
    mutationFn: (data: any) => invoiceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      handleClose()
    },
    onError: (error: any) => {
      setCreateError(error.response?.data?.detail || error.message || 'Failed to create invoice')
    },
  })

  const selectedCustomer = customers?.find(c => c.id === createForm.customer_id)
  const isWholesale = selectedCustomer?.customer_type === 'Wholesale'

  const handleCustomerChange = (customerId: number) => {
    setCreateForm(f => ({ ...f, customer_id: customerId }))
    const newCustomer = customers?.find(c => c.id === customerId)
    const newIsWholesale = newCustomer?.customer_type === 'Wholesale'
    if (createLineItems.length > 0 && items) {
      setCreateLineItems(prev => prev.map(li => {
        const itemData = items.find(i => i.id === li.item_id)
        if (!itemData) return li
        return { ...li, price: newIsWholesale ? itemData.selling_price_wholesale : itemData.selling_price_retail }
      }))
    }
  }

  const handleAddItem = (item: ItemListResponse) => {
    const price = isWholesale ? item.selling_price_wholesale : item.selling_price_retail
    const existing = createLineItems.find(li => li.item_id === item.id)
    if (existing) {
      setCreateLineItems(prev => prev.map(li =>
        li.item_id === item.id ? { ...li, quantity: li.quantity + 1 } : li
      ))
    } else {
      setCreateLineItems(prev => [...prev, {
        item_id: item.id,
        item_name: item.item_name,
        quantity: 1,
        price,
        discount_amount: 0,
        discount_type: 'amount',
        unit_of_measurement: item.unit_of_measurement,
        gst_rate: item.gst_rate,
        hsn_sac_code: item.hsn_sac_code,
      }])
    }
  }

  const computeTotals = () => {
    const lineSubtotal = createLineItems.reduce((sum, li) =>
      sum + (li.quantity * li.price) - (li.discount_amount || 0), 0)
    const invoiceDiscount = createForm.discount_type === 'amount'
      ? createForm.discount_amount || 0
      : lineSubtotal * ((createForm.discount_amount || 0) / 100)
    const discountRatio = lineSubtotal > 0 ? invoiceDiscount / lineSubtotal : 0
    const afterDiscount = lineSubtotal - invoiceDiscount

    // Per-item GST: group by rate
    const hasPerItemRates = createLineItems.some(li => li.gst_rate != null)
    const perRateTax: Record<number, { taxable: number; tax: number }> = {}
    let totalTax = 0

    if (hasPerItemRates) {
      for (const li of createLineItems) {
        const lineTaxable = ((li.quantity * li.price) - (li.discount_amount || 0)) * (1 - discountRatio)
        const rate = li.gst_rate ?? 0
        const lineTax = lineTaxable * (rate / 100)
        totalTax += lineTax
        if (!perRateTax[rate]) perRateTax[rate] = { taxable: 0, tax: 0 }
        perRateTax[rate].taxable += lineTaxable
        perRateTax[rate].tax += lineTax
      }
    } else {
      totalTax = afterDiscount * ((createForm.tax_rate || 0) / 100)
      if (createForm.tax_rate) perRateTax[createForm.tax_rate] = { taxable: afterDiscount, tax: totalTax }
    }

    return { subtotal: lineSubtotal, discount: invoiceDiscount, tax: totalTax, grandTotal: afterDiscount + totalTax, perRateTax, hasPerItemRates }
  }

  const handleSubmit = () => {
    setCreateError('')
    if (!createForm.customer_id) { setCreateError('Please select a customer'); return }
    if (createLineItems.length === 0) { setCreateError('Please add at least one line item'); return }
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
        gst_rate: li.gst_rate ?? null,
      })),
    })
  }

  const handleClose = () => {
    setCreateForm({
      customer_id: 0,
      invoice_date: new Date().toISOString().split('T')[0],
      discount_type: 'amount',
      discount_amount: 0,
      tax_rate: 5,
      po_number: '',
      shipping_address: '',
      notes: '',
    })
    setCreateLineItems([])
    setCreateError('')
    onClose()
  }

  const totals = computeTotals()

  if (!open) return null

  const invoiceModal = createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={mainModalRef} className="brutal-border bg-surface w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
          <h2 className="font-display font-bold text-xl uppercase tracking-tighter">New Invoice</h2>
          <button onClick={handleClose} className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {createError && (
            <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider">
              {createError}
            </div>
          )}

          {/* Customer + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Customer *</label>
                <button
                  type="button"
                  onClick={() => { setQaForm({ name: '', type: 'Retail', phone: '', gstin: '' }); setQaError(''); setShowQuickAdd(true) }}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-accent hover:underline brutal-focus"
                >
                  <UserPlus className="w-3 h-3" /> New Customer
                </button>
              </div>
              <CustomerCombobox
                customers={customers ?? []}
                selectedId={createForm.customer_id}
                onChange={handleCustomerChange}
              />
              {selectedCustomer && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border',
                    isWholesale ? 'bg-accent text-on-accent border-accent' : 'border-line text-ink-light'
                  )}>
                    {isWholesale ? 'Wholesale' : 'Retail'} — auto-priced
                  </span>
                  {selectedCustomer.credit_days && selectedCustomer.credit_days > 0 && (
                    <span className="text-[10px] font-mono text-ink-light">Net-{selectedCustomer.credit_days}</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Invoice Date *</label>
              <input type="date" value={createForm.invoice_date}
                onChange={(e) => setCreateForm(f => ({ ...f, invoice_date: e.target.value }))}
                className={inputCls} />
              {selectedCustomer?.credit_days && selectedCustomer.credit_days > 0 && createForm.invoice_date && (
                <div className="mt-1.5 text-[10px] font-mono text-ink-light uppercase tracking-widest">
                  Due: {format(new Date(new Date(createForm.invoice_date).getTime() + selectedCustomer.credit_days * 86400000), 'dd MMM yyyy')}
                </div>
              )}
            </div>
          </div>

          {/* Wholesale fields */}
          {isWholesale && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-accent/30 bg-accent/5">
              <div>
                <label className={labelCls}>PO Number</label>
                <input type="text" value={createForm.po_number}
                  onChange={(e) => setCreateForm(f => ({ ...f, po_number: e.target.value }))}
                  placeholder="Customer PO number" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Shipping Address</label>
                <input type="text" value={createForm.shipping_address}
                  onChange={(e) => setCreateForm(f => ({ ...f, shipping_address: e.target.value }))}
                  placeholder="Delivery address" className={inputCls} />
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="brutal-border bg-paper p-4">
            <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">Line Items</div>
            <div className="mb-4">
              <ItemCombobox
                items={items ?? []}
                isWholesale={isWholesale}
                onSelect={handleAddItem}
              />
            </div>
            {createLineItems.length > 0 ? (
              <div className="divide-y divide-line">
                {createLineItems.map((li, index) => (
                  <div key={li.item_id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{li.item_name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {li.unit_of_measurement && (
                          <p className="text-[10px] font-mono text-ink-light uppercase">{li.unit_of_measurement}</p>
                        )}
                        {li.gst_rate != null ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 border border-accent/40 text-accent uppercase tracking-widest">
                            GST {li.gst_rate}%
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 border border-line text-ink-light/50 uppercase tracking-widest">
                            No GST
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div>
                        <div className={labelCls}>Qty</div>
                        <input type="number" min="1" value={li.quantity}
                          onChange={(e) => {
                            const updated = [...createLineItems]
                            updated[index] = { ...updated[index], quantity: parseInt(e.target.value) || 1 }
                            setCreateLineItems(updated)
                          }}
                          className="w-16 px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-sm text-center focus:outline-none focus:border-accent" />
                      </div>
                      <div>
                        <div className={cn(labelCls, 'flex items-center gap-1')}>
                          Price
                          <span className={cn('px-1 text-[9px] border', isWholesale ? 'border-accent text-accent' : 'border-line text-ink-light')}>
                            {isWholesale ? 'WS' : 'R'}
                          </span>
                        </div>
                        <input type="number" step="0.01" value={li.price}
                          onChange={(e) => {
                            const updated = [...createLineItems]
                            updated[index] = { ...updated[index], price: parseFloat(e.target.value) || 0 }
                            setCreateLineItems(updated)
                          }}
                          className="w-24 px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-sm text-center focus:outline-none focus:border-accent" />
                      </div>
                      <div className="text-right min-w-[72px]">
                        <div className={labelCls}>Total</div>
                        <div className="font-mono font-bold text-sm">
                          ₹{(li.quantity * li.price - (li.discount_amount || 0)).toFixed(2)}
                        </div>
                      </div>
                      <button onClick={() => setCreateLineItems(createLineItems.filter((_, i) => i !== index))}
                        className="p-1.5 brutal-border hover:border-danger hover:text-danger transition-colors brutal-focus mt-4">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-6">No items added yet</p>
            )}
          </div>

          {/* Discount / Tax / Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Discount Type</label>
              <select value={createForm.discount_type}
                onChange={(e) => setCreateForm(f => ({ ...f, discount_type: e.target.value }))}
                className={inputCls}>
                <option value="amount">Fixed Amount (₹)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Discount Value</label>
              <input type="number" step="0.01" min="0" value={createForm.discount_amount}
                onChange={(e) => setCreateForm(f => ({ ...f, discount_amount: parseFloat(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
          </div>
          {/* Tax info banner */}
          {createLineItems.length > 0 && (
            <div className="px-4 py-2.5 border border-line bg-paper font-mono text-xs text-ink-light">
              {totals.hasPerItemRates
                ? <span>GST rates applied per item (from item catalogue). <span className="text-ink">CGST + SGST shown in totals below.</span></span>
                : <span>No item-level GST rates set. <span className="text-accent">Assign GST rates to items in inventory to auto-calculate CGST &amp; SGST.</span></span>
              }
            </div>
          )}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={createForm.notes}
              onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              className={cn(inputCls, 'resize-none')} rows={2} placeholder="Optional notes" />
          </div>

          {/* Totals summary */}
          {createLineItems.length > 0 && (
            <div className="brutal-border bg-paper p-4">
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between text-ink-light">
                  <span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-warning">
                    <span>Discount</span><span>−₹{totals.discount.toFixed(2)}</span>
                  </div>
                )}
                {Object.entries(totals.perRateTax).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, { tax }]) => (
                  <div key={rate} className="text-ink-light">
                    <div className="flex justify-between">
                      <span>CGST ({(Number(rate) / 2).toFixed(1)}%)</span><span>₹{(tax / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST ({(Number(rate) / 2).toFixed(1)}%)</span><span>₹{(tax / 2).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {totals.tax === 0 && Object.keys(totals.perRateTax).length === 0 && (
                  <div className="flex justify-between text-ink-light/50 text-xs">
                    <span>GST</span><span>₹0.00 (no rates set)</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-line pt-2">
                  <span>Grand Total</span><span>₹{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
          <button onClick={handleClose}
            className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={createMutation.isPending}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  // ── Quick-add customer modal ─────────────────────────────────────────────────
  return (
    <>
      {invoiceModal}
      {showQuickAdd && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowQuickAdd(false) }}>
          <div ref={quickAddRef} className="brutal-border bg-surface w-full max-w-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-line bg-ink text-surface shrink-0">
              <h3 className="font-display font-bold text-base uppercase tracking-tighter">New Customer</h3>
              <button onClick={() => setShowQuickAdd(false)} className="p-1.5 hover:bg-danger hover:text-paper transition-colors brutal-focus">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleQuickAddSubmit() }} className="p-5 space-y-4">
              {qaError && (
                <p className="text-[10px] font-mono uppercase tracking-widest text-danger border border-danger px-3 py-2">{qaError}</p>
              )}
              <div>
                <label className={labelCls}>Name *</label>
                <input type="text" value={qaForm.name} onChange={e => setQaForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Customer name" className={inputCls} autoFocus />
              </div>
              <div>
                <label className={labelCls}>Type *</label>
                <select value={qaForm.type} onChange={e => setQaForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Phone <span className="normal-case text-ink-light/60">(optional)</span></label>
                <input type="tel" value={qaForm.phone} onChange={e => setQaForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>GSTIN <span className="normal-case text-ink-light/60">(optional)</span></label>
                <input type="text" value={qaForm.gstin} onChange={e => setQaForm(f => ({ ...f, gstin: e.target.value }))}
                  placeholder="GST number" className={inputCls} />
              </div>
              <div className="border-t border-line pt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowQuickAdd(false)}
                  className="px-4 py-2 brutal-border font-mono text-xs uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
                  Cancel
                </button>
                <button type="submit" disabled={quickAddMutation.isPending}
                  className="px-4 py-2 bg-accent text-on-accent font-mono text-xs uppercase tracking-wider brutal-border brutal-focus transition-all disabled:opacity-50">
                  {quickAddMutation.isPending ? 'Saving...' : 'Add & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
