import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowLeft, Search, ShoppingCart, X, Plus, Minus, ChevronRight,
  User, AlertTriangle, CheckCircle2, ScanBarcode, Lock, SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import { customerService, itemService, invoiceService } from '../services/api'
import type { CustomerListResponse, ItemListResponse, Customer } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { DatePicker } from '../components/DatePicker'
import { cn } from '../lib/utils'
import { toast } from '../lib/toast'

// ── Constants ─────────────────────────────────────────────────────────────────
const PIN_KEY = 'retailpilot_price_check_pin'
const today   = format(new Date(), 'yyyy-MM-dd')

type Step = 'setup' | 'browse' | 'confirm' | 'success'

interface CartItem {
  item_id: number
  item_name: string
  brand_name: string
  variant_id?: number
  variant_value?: string
  quantity: number
  unit_price: number
  unit_of_measurement?: string
  gst_rate?: number
  hsn_sac_code?: string
  stock: number   // stock for this specific variant (or parent if no variant)
}

// Pending variant selection in browse mode
interface PendingBrowsePick {
  item: ItemListResponse
}

interface SessionOverride {
  kind: 'markup' | 'discount'
  mode: 'percent' | 'flat'
  value: number
}

// ── Price calculation ─────────────────────────────────────────────────────────
function computePrice(
  basePrice: number,
  customer: CustomerListResponse | null,
  session: SessionOverride | null,
): number {
  let p = basePrice

  // 1. Permanent customer rule
  if (customer) {
    if (customer.price_markup_type === 'percent' && customer.price_markup_value)
      p = p * (1 + customer.price_markup_value / 100)
    else if (customer.price_markup_type === 'flat' && customer.price_markup_value)
      p = p + customer.price_markup_value

    if (customer.price_discount_type === 'percent' && customer.price_discount_value)
      p = p * (1 - customer.price_discount_value / 100)
    else if (customer.price_discount_type === 'flat' && customer.price_discount_value)
      p = p - customer.price_discount_value
  }

  // 2. Session override stacks on top
  if (session && session.value > 0) {
    if (session.kind === 'markup')
      p = session.mode === 'percent' ? p * (1 + session.value / 100) : p + session.value
    else
      p = session.mode === 'percent' ? p * (1 - session.value / 100) : p - session.value
  }

  return Math.max(0, Math.round(p * 100) / 100)
}

// ── PIN Modal ─────────────────────────────────────────────────────────────────
function PinModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError]   = useState(false)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  useEffect(() => { refs[0].current?.focus() }, [])

  const handleDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = [...digits]
    next[i] = v
    setDigits(next)
    setError(false)
    if (v && i < 3) refs[i + 1].current?.focus()
    if (i === 3 && v) {
      const entered = [...next.slice(0, 3), v].join('')
      const saved   = localStorage.getItem(PIN_KEY) ?? ''
      if (entered === saved) { onSuccess() }
      else { setError(true); setDigits(['', '', '', '']); setTimeout(() => refs[0].current?.focus(), 50) }
    }
  }

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface brutal-border p-8 w-full max-w-xs mx-4 space-y-6">
        <div className="text-center">
          <Lock className="w-8 h-8 mx-auto mb-3 text-accent" />
          <h2 className="font-display font-bold uppercase text-lg">Enter PIN</h2>
          <p className="font-mono text-xs text-ink-light mt-1">Enter your 4-digit PIN to exit</p>
        </div>
        <div className="flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              className={cn(
                'w-12 h-14 text-center text-2xl font-mono brutal-border bg-paper focus:outline-none focus:border-accent transition-colors',
                error && 'border-danger',
              )}
            />
          ))}
        </div>
        {error && <p className="font-mono text-xs text-danger text-center">Incorrect PIN. Try again.</p>}
        <button onClick={onCancel} className="w-full py-2 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Customer combobox (reused pattern) ────────────────────────────────────────
function CustomerCombobox({
  customers,
  selectedId,
  onChange,
}: {
  customers: CustomerListResponse[]
  selectedId: number | null
  onChange: (id: number, c: CustomerListResponse) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!q.trim()) return customers.slice(0, 30)
    const s = q.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(s) ||
      (c.phone_number ?? '').includes(s)
    ).slice(0, 30)
  }, [customers, q])

  const selected = customers.find(c => c.id === selectedId)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm flex items-center justify-between cursor-pointer hover:border-accent transition-colors"
      >
        <span>{selected ? `${selected.name} (${selected.customer_type})` : 'Select customer…'}</span>
        <ChevronRight className={cn('w-4 h-4 transition-transform shrink-0', open && 'rotate-90')} />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 bg-surface brutal-border border-t-0 max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-line">
            <input
              autoFocus
              type="text"
              placeholder="Search by name or phone…"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full px-2 py-1.5 bg-paper brutal-border font-mono text-xs focus:outline-none focus:border-accent"
            />
          </div>
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => { onChange(c.id, c); setOpen(false); setQ('') }}
              className={cn(
                'w-full px-3 py-2 text-left font-mono text-sm flex items-center justify-between hover:bg-accent/10 transition-colors',
                c.id === selectedId && 'bg-accent/10',
              )}
            >
              <span>{c.name}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 border', c.customer_type === 'Wholesale' ? 'border-accent text-accent' : 'border-line text-ink-light')}>
                {c.customer_type}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-4 font-mono text-xs text-ink-light text-center">No customers found</p>}
        </div>
      )}
    </div>
  )
}

// ── Item card ──────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  price,
  cartQty,
  onAdd,
  onRemove,
  formatCurrency,
}: {
  item: ItemListResponse
  price: number
  cartQty: number
  onAdd: () => void
  onRemove: () => void
  formatCurrency: (n: number) => string
}) {
  // Real-time available stock = server stock minus what's already in the cart
  const available  = item.current_stock_quantity - cartQty
  const outOfStock = available <= 0 && cartQty === 0  // truly out of stock (never had any)
  const depleted   = available <= 0 && cartQty > 0    // cart has taken all remaining units

  return (
    <div className={cn(
      'brutal-border bg-surface p-4 flex flex-col gap-3 transition-opacity',
      (outOfStock || depleted) && cartQty === 0 && 'opacity-50',
    )}>
      <div className="flex-1 min-w-0">
        <p className="font-mono font-semibold text-sm leading-tight truncate">{item.item_name}</p>
        <p className="font-mono text-[11px] text-ink-light truncate">{item.brand_name}</p>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="font-display font-bold text-lg leading-none">{formatCurrency(price)}</div>
          <div className={cn(
            'font-mono text-[10px] mt-0.5',
            outOfStock ? 'text-ink-light' :
            available <= 0 ? 'text-danger' :
            available <= 5 ? 'text-warning' : 'text-ink-light',
          )}>
            {outOfStock
              ? 'Out of stock'
              : available <= 0
                ? 'No more stock'
                : `${available} ${item.unit_of_measurement ?? 'pcs'} left`}
          </div>
        </div>

        {!outOfStock && (
          <div className="flex items-center gap-1 shrink-0">
            {cartQty > 0 ? (
              <>
                <button
                  onClick={onRemove}
                  className="w-8 h-8 brutal-border flex items-center justify-center hover:bg-danger hover:text-white hover:border-danger transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-mono font-bold text-sm">{cartQty}</span>
                <button
                  onClick={onAdd}
                  disabled={available <= 0}
                  className="w-8 h-8 brutal-border flex items-center justify-center hover:bg-accent hover:text-on-accent hover:border-accent transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={onAdd}
                className="px-3 h-8 brutal-border font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-on-accent hover:border-accent transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PriceCheckPage() {
  const navigate       = useNavigate()
  const queryClient    = useQueryClient()
  const { formatCurrency } = useSettings()

  // ── Step management ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('setup')

  // ── Setup state ─────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListResponse | null>(null)
  const [isWalkin, setIsWalkin] = useState(false)
  const [walkinCustomer, setWalkinCustomer] = useState<Customer | null>(null)

  // Session override (applies to both named customer AND walk-in)
  const [sessionKind, setSessionKind]   = useState<'markup' | 'discount'>('markup')
  const [sessionMode, setSessionMode]   = useState<'percent' | 'flat'>('percent')
  const [sessionValue, setSessionValue] = useState('')

  // ── Browse state ─────────────────────────────────────────────────────────
  const [cart, setCart]           = useState<CartItem[]>([])
  const [search, setSearch]       = useState('')
  const [showCart, setShowCart]   = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [pendingBrowsePick, setPendingBrowsePick] = useState<PendingBrowsePick | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterBrand, setFilterBrand]       = useState('')
  const [filterPriceMin, setFilterPriceMin] = useState('')
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [filterInStock, setFilterInStock]   = useState(false)
  const [sortBy, setSortBy]                 = useState<'name' | 'price_asc' | 'price_desc' | 'stock'>('name')

  // ── Confirm state ────────────────────────────────────────────────────────
  const [invoiceDate, setInvoiceDate]       = useState(today)
  const [paymentStatus, setPaymentStatus]   = useState<'paid' | 'partial' | 'unpaid'>('unpaid')
  const [paymentMethod, setPaymentMethod]   = useState('cash')
  const [notes, setNotes]                   = useState('')
  const [createdInvoice, setCreatedInvoice] = useState<{ id: number; number: string } | null>(null)

  // ── PIN check ────────────────────────────────────────────────────────────
  const storedPin = localStorage.getItem(PIN_KEY)
  const pinIsSet  = !!storedPin

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: customers = [] } = useQuery<CustomerListResponse[]>({
    queryKey: ['customers-all'],
    queryFn: () => customerService.list({ page_size: 500 }).then(r => r.data),
  })

  const { data: items = [] } = useQuery<ItemListResponse[]>({
    queryKey: ['items-all'],
    queryFn: () => itemService.list({ page_size: 500 }).then(r => r.data),
  })

  // ── Derived: session override object ────────────────────────────────────
  const sessionOverride: SessionOverride | null = useMemo(() => {
    const v = parseFloat(sessionValue)
    if (!v || v <= 0) return null
    return { kind: sessionKind, mode: sessionMode, value: v }
  }, [sessionKind, sessionMode, sessionValue])

  // ── Derived: effective customer for price calc ───────────────────────────
  // Walk-in has no pricing rules, so pass null for the customer rule part
  const pricingCustomer = isWalkin ? null : selectedCustomer

  // ── Derived: unique brand list ───────────────────────────────────────────
  const brandOptions = useMemo(() => {
    const brands = [...new Set(items.map(i => i.brand_name).filter(Boolean))].sort()
    return brands
  }, [items])

  // ── Derived: active filter count (for badge) ─────────────────────────────
  const activeFilterCount = [
    filterBrand,
    filterPriceMin,
    filterPriceMax,
    filterInStock,
  ].filter(Boolean).length

  // ── Derived: filtered + sorted item list ─────────────────────────────────
  const filteredItems = useMemo(() => {
    const q        = search.toLowerCase().trim()
    const minPrice = parseFloat(filterPriceMin)
    const maxPrice = parseFloat(filterPriceMax)

    let result = items.filter(i => {
      if (q && !i.item_name.toLowerCase().includes(q) && !i.brand_name.toLowerCase().includes(q) && !(i.sku ?? '').toLowerCase().includes(q)) return false
      if (filterBrand && i.brand_name !== filterBrand) return false
      if (filterInStock && i.current_stock_quantity <= 0) return false
      const price = computePrice(i.selling_price_retail, pricingCustomer, sessionOverride)
      if (!isNaN(minPrice) && price < minPrice) return false
      if (!isNaN(maxPrice) && price > maxPrice) return false
      return true
    })

    result = [...result].sort((a, b) => {
      if (sortBy === 'price_asc') return computePrice(a.selling_price_retail, pricingCustomer, sessionOverride) - computePrice(b.selling_price_retail, pricingCustomer, sessionOverride)
      if (sortBy === 'price_desc') return computePrice(b.selling_price_retail, pricingCustomer, sessionOverride) - computePrice(a.selling_price_retail, pricingCustomer, sessionOverride)
      if (sortBy === 'stock') return b.current_stock_quantity - a.current_stock_quantity
      return a.item_name.localeCompare(b.item_name)
    })

    return result
  }, [items, search, filterBrand, filterPriceMin, filterPriceMax, filterInStock, sortBy, pricingCustomer, sessionOverride])

  // ── Cart helpers ─────────────────────────────────────────────────────────
  const addToCart = useCallback((item: ItemListResponse, variant?: { id: number; variant_value: string; stock_quantity: number; price_override?: number | null }) => {
    // Variant items with no variant pre-selected: open picker
    if (item.has_variants && item.variants && item.variants.length > 0 && !variant) {
      setPendingBrowsePick({ item })
      return
    }
    const basePrice = variant?.price_override != null ? variant.price_override : item.selling_price_retail
    const price = computePrice(basePrice, pricingCustomer, sessionOverride)
    const cartKey = variant ? `${item.id}-${variant.id}` : `${item.id}`
    const stockForSlot = variant ? variant.stock_quantity : item.current_stock_quantity

    setCart(prev => {
      const existing = prev.find(c => (variant ? c.item_id === item.id && c.variant_id === variant.id : c.item_id === item.id && !c.variant_id))
      if (existing) {
        if (existing.quantity >= stockForSlot) return prev
        return prev.map(c =>
          (variant ? c.item_id === item.id && c.variant_id === variant.id : c.item_id === item.id && !c.variant_id)
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [...prev, {
        item_id: item.id,
        item_name: variant ? `${item.item_name} — ${variant.variant_value}` : item.item_name,
        brand_name: item.brand_name,
        variant_id: variant?.id,
        variant_value: variant?.variant_value,
        quantity: 1,
        unit_price: price,
        unit_of_measurement: item.unit_of_measurement,
        gst_rate: item.gst_rate,
        hsn_sac_code: item.hsn_sac_code,
        stock: stockForSlot,
      }]
    })
    // suppress unused variable lint warning
    void cartKey
  }, [pricingCustomer, sessionOverride])

  const removeFromCart = useCallback((itemId: number, variantId?: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.item_id === itemId && c.variant_id === variantId)
      if (!existing) return prev
      if (existing.quantity <= 1) return prev.filter(c => !(c.item_id === itemId && c.variant_id === variantId))
      return prev.map(c => c.item_id === itemId && c.variant_id === variantId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }, [])

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  // Total qty in cart for a given item (all variants combined, for ItemCard badge)
  const cartQtyForItem = useCallback((itemId: number) =>
    cart.filter(c => c.item_id === itemId).reduce((s, c) => s + c.quantity, 0)
  , [cart])

  // ── Launch browse ────────────────────────────────────────────────────────
  const handleLaunch = async () => {
    if (!isWalkin && !selectedCustomer) {
      toast.error('Select a customer or choose Walk-in')
      return
    }
    if (isWalkin && !walkinCustomer) {
      try {
        const wc = await customerService.getOrCreateWalkin()
        setWalkinCustomer(wc)
      } catch {
        toast.error('Failed to set up walk-in customer')
        return
      }
    }
    setCart([])
    setSearch('')
    setStep('browse')
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  // ── Exit browse (with PIN gate) ──────────────────────────────────────────
  const handleExitBrowse = () => {
    if (pinIsSet) {
      setShowPinModal(true)
    } else {
      setStep('setup')
    }
  }

  // ── Invoice mutation ─────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => invoiceService.create(data),
    onSuccess: (inv: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['items-all'] })
      setCreatedInvoice({ id: inv.id, number: inv.invoice_number })
      setStep('success')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to create invoice'),
  })

  const handleConfirmSubmit = () => {
    const customerId = isWalkin
      ? walkinCustomer!.id
      : selectedCustomer!.id

    createMutation.mutate({
      customer_id: customerId,
      invoice_date: invoiceDate,
      payment_status: paymentStatus,
      notes: notes || undefined,
      line_items: cart.map(c => ({
        item_id: c.item_id,
        variant_id: c.variant_id ?? undefined,
        variant_value: c.variant_value ?? undefined,
        quantity: c.quantity,
        price: c.unit_price,
        total: c.quantity * c.unit_price,
        gst_rate: c.gst_rate,
        hsn_sac_code: c.hsn_sac_code,
      })),
      grand_total: cartTotal,
    })
  }

  const resetAll = () => {
    setStep('setup')
    setSelectedCustomer(null)
    setIsWalkin(false)
    setSessionValue('')
    setCart([])
    setCreatedInvoice(null)
    setPaymentStatus('unpaid')
    setPaymentMethod('cash')
    setNotes('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — STEP 1: SETUP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    const customerHasRules = selectedCustomer && (
      (selectedCustomer.price_markup_type && selectedCustomer.price_markup_value) ||
      (selectedCustomer.price_discount_type && selectedCustomer.price_discount_value)
    )

    return (
      <div className="max-w-lg mx-auto space-y-6 pb-16">
        {/* Header */}
        <header className="border-b border-line pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-ink-light hover:text-accent transition-colors mb-4"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <div className="flex items-center gap-3">
            <ScanBarcode className="w-6 h-6 text-accent shrink-0" />
            <div>
              <h1 className="font-display font-bold text-2xl uppercase tracking-tighter">Price Browser</h1>
              <p className="font-mono text-xs text-ink-light mt-0.5">Set up customer, then launch the item browser</p>
            </div>
          </div>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </header>

        {/* Step 1 card */}
        <div className="brutal-border bg-surface p-5 space-y-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light border-b border-line pb-2">
            Step 1 — Select Customer
          </div>

          {/* Walk-in quick button */}
          <div className="flex gap-2">
            <button
              onClick={() => { setIsWalkin(true); setSelectedCustomer(null) }}
              className={cn(
                'flex-1 py-2.5 brutal-border font-mono text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2',
                isWalkin ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface',
              )}
            >
              <User className="w-3.5 h-3.5" /> Walk-in
            </button>
            <button
              onClick={() => setIsWalkin(false)}
              className={cn(
                'flex-1 py-2.5 brutal-border font-mono text-xs uppercase tracking-widest transition-colors',
                !isWalkin ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface',
              )}
            >
              Named Customer
            </button>
          </div>

          {/* Customer combobox — shown only for named customers */}
          {!isWalkin && (
            <CustomerCombobox
              customers={customers}
              selectedId={selectedCustomer?.id ?? null}
              onChange={(_, c) => setSelectedCustomer(c)}
            />
          )}

          {/* Customer profile card */}
          {!isWalkin && selectedCustomer && (
            <div className="brutal-border p-3 space-y-2 bg-paper">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light">Customer Profile</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
                <span className="text-ink-light">Type</span>
                <span className={selectedCustomer.customer_type === 'Wholesale' ? 'text-accent font-semibold' : ''}>{selectedCustomer.customer_type}</span>
                {selectedCustomer.credit_days != null && selectedCustomer.credit_days > 0 && (
                  <>
                    <span className="text-ink-light">Credit Period</span>
                    <span>Net-{selectedCustomer.credit_days}</span>
                  </>
                )}
                {selectedCustomer.credit_limit != null && selectedCustomer.credit_limit > 0 && (
                  <>
                    <span className="text-ink-light">Credit Limit</span>
                    <span>{formatCurrency(selectedCustomer.credit_limit)}</span>
                  </>
                )}
                {customerHasRules && (
                  <>
                    <span className="text-ink-light">Pricing Rule</span>
                    <span className="text-warning">
                      {selectedCustomer.price_markup_type && selectedCustomer.price_markup_value
                        ? `+${selectedCustomer.price_markup_value}${selectedCustomer.price_markup_type === 'percent' ? '%' : '₹'} markup`
                        : ''}
                      {selectedCustomer.price_discount_type && selectedCustomer.price_discount_value
                        ? ` −${selectedCustomer.price_discount_value}${selectedCustomer.price_discount_type === 'percent' ? '%' : '₹'} discount`
                        : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Session override card */}
        <div className="brutal-border bg-surface p-5 space-y-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light border-b border-line pb-2">
            Step 2 — Session Pricing Override <span className="normal-case tracking-normal">(optional, not saved)</span>
          </div>
          <p className="font-mono text-xs text-ink-light">
            Stacks on top of the customer's permanent rule.{' '}
            {isWalkin ? 'Walk-in uses retail base price.' : selectedCustomer ? `${selectedCustomer.name} already has ${customerHasRules ? 'pricing rules applied' : 'no pricing rules'}.` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              value={sessionKind}
              onChange={e => setSessionKind(e.target.value as 'markup' | 'discount')}
              className="px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent"
            >
              <option value="markup">Markup (add)</option>
              <option value="discount">Discount (subtract)</option>
            </select>
            <select
              value={sessionMode}
              onChange={e => setSessionMode(e.target.value as 'percent' | 'flat')}
              className="px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent"
            >
              <option value="percent">% Percent</option>
              <option value="flat">₹ Flat amount</option>
            </select>
            <input
              type="number" min="0" step="0.01"
              placeholder={sessionMode === 'percent' ? 'e.g. 10' : 'e.g. 50'}
              value={sessionValue}
              onChange={e => setSessionValue(e.target.value)}
              className="w-28 px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent"
            />
            {sessionValue && parseFloat(sessionValue) > 0 && (
              <button onClick={() => setSessionValue('')} className="px-2 py-1.5 brutal-border font-mono text-xs hover:border-danger hover:text-danger transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {sessionOverride && (
            <div className="font-mono text-[10px] text-warning">
              Session: {sessionOverride.kind === 'markup' ? '+' : '−'}{sessionOverride.value}{sessionOverride.mode === 'percent' ? '%' : '₹'} applied on top of base
            </div>
          )}
        </div>

        {/* PIN warning if no PIN set */}
        {!pinIsSet && (
          <div className="flex items-start gap-2 px-3 py-2.5 border border-warning/40 bg-warning/5 font-mono text-xs text-warning">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            No PIN set — customers can exit the browser freely. Set one in Settings → Price Browser PIN.
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={!isWalkin && !selectedCustomer}
          className="w-full py-4 bg-accent text-on-accent font-display font-bold uppercase tracking-widest text-lg brutal-border hover:bg-ink hover:text-surface hover:border-ink transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <ScanBarcode className="w-5 h-5" /> Launch Browser
        </button>
      </div>
    )
  }

  // ── Clear all filters helper ─────────────────────────────────────────────
  const clearFilters = () => {
    setFilterBrand('')
    setFilterPriceMin('')
    setFilterPriceMax('')
    setFilterInStock(false)
    setSortBy('name')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — STEP 2: BROWSE (portal — renders directly in document.body to
  // escape Layout's motion.div transform stacking context)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'browse') {
    const customerLabel = isWalkin ? 'Walk-in Customer' : selectedCustomer?.name ?? ''

    return createPortal(
      <div className="fixed inset-0 z-[9000] bg-paper flex flex-col overflow-hidden">
        {showPinModal && (
          <PinModal
            onSuccess={() => { setShowPinModal(false); setStep('setup') }}
            onCancel={() => setShowPinModal(false)}
          />
        )}

        {/* Top bar */}
        <div className="shrink-0 bg-surface border-b border-line px-4 py-3 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name, brand, SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 brutal-border bg-paper font-mono text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'relative p-2 brutal-border transition-colors flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest shrink-0',
              showFilters || activeFilterCount > 0
                ? 'bg-accent text-on-accent border-accent'
                : 'hover:border-accent hover:text-accent',
            )}
            title="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-ink text-surface font-mono text-[9px] font-bold flex items-center justify-center rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="font-mono text-xs text-ink-light shrink-0 hidden sm:block">{customerLabel}</div>
          {/* Mobile cart button */}
          <button
            onClick={() => setShowCart(true)}
            className="relative p-2 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors lg:hidden"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent text-on-accent font-mono text-[10px] font-bold flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </button>
          {/* Exit — far right */}
          <button
            onClick={handleExitBrowse}
            className="p-2 brutal-border hover:border-danger hover:text-danger transition-colors shrink-0"
            title="Exit browser"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar (collapsible) */}
        {showFilters && (
          <div className="shrink-0 bg-surface border-b border-line px-4 py-3 flex flex-wrap items-end gap-3">
            {/* Brand */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-widest text-ink-light">Brand</label>
              <div className="relative">
                <select
                  value={filterBrand}
                  onChange={e => setFilterBrand(e.target.value)}
                  className="pl-2 pr-7 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent appearance-none min-w-[120px]"
                >
                  <option value="">All brands</option>
                  {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-light pointer-events-none" />
              </div>
            </div>

            {/* Price range */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-widest text-ink-light">Price Range</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" step="1"
                  placeholder="Min"
                  value={filterPriceMin}
                  onChange={e => setFilterPriceMin(e.target.value)}
                  className="w-20 px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent"
                />
                <span className="font-mono text-xs text-ink-light">–</span>
                <input
                  type="number" min="0" step="1"
                  placeholder="Max"
                  value={filterPriceMax}
                  onChange={e => setFilterPriceMax(e.target.value)}
                  className="w-20 px-2 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* In-stock only */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-widest text-ink-light">Availability</label>
              <button
                onClick={() => setFilterInStock(v => !v)}
                className={cn(
                  'px-3 py-1.5 brutal-border font-mono text-xs uppercase tracking-widest transition-colors',
                  filterInStock ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface',
                )}
              >
                In Stock Only
              </button>
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-widest text-ink-light">Sort By</label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="pl-2 pr-7 py-1.5 brutal-border bg-paper text-ink font-mono text-xs focus:outline-none focus:border-accent appearance-none"
                >
                  <option value="name">Name A–Z</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="stock">Stock: High → Low</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-light pointer-events-none" />
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 brutal-border font-mono text-xs uppercase tracking-widest hover:border-danger hover:text-danger transition-colors flex items-center gap-1.5 self-end"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}

            <div className="ml-auto self-end font-mono text-[10px] text-ink-light">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} shown
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Items grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="text-center font-mono text-xs uppercase tracking-widest text-ink-light py-20">
                No items match the current filters
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredItems.map(item => {
                  const price   = computePrice(item.selling_price_retail, pricingCustomer, sessionOverride)
                  const cartQty = cartQtyForItem(item.id)
                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      price={price}
                      cartQty={cartQty}
                      onAdd={() => addToCart(item)}
                      onRemove={() => removeFromCart(item.id)}
                      formatCurrency={formatCurrency}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Desktop cart sidebar */}
          <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-line bg-surface">
            <CartPanel
              cart={cart}
              cartTotal={cartTotal}
              formatCurrency={formatCurrency}
              onAdd={(itemId, variantId) => {
                const item = items.find(i => i.id === itemId)
                const variant = item?.variants?.find(v => v.id === variantId)
                if (item) addToCart(item, variant)
              }}
              onRemove={removeFromCart}
              onCheckout={() => setStep('confirm')}
            />
          </div>
        </div>

        {/* Mobile sticky bottom bar */}
        {cartCount > 0 && (
          <div className="lg:hidden shrink-0 bg-surface border-t border-line px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-mono text-xs text-ink-light">{cartCount} item{cartCount !== 1 ? 's' : ''}</div>
              <div className="font-display font-bold text-base">{formatCurrency(cartTotal)}</div>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="px-4 py-2 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-colors"
            >
              View Cart
            </button>
            <button
              onClick={() => setStep('confirm')}
              className="px-4 py-2 bg-accent text-on-accent font-mono text-xs uppercase tracking-widest brutal-border hover:bg-ink hover:text-surface transition-colors"
            >
              Checkout
            </button>
          </div>
        )}

        {/* Mobile cart drawer */}
        {showCart && (
          <div className="fixed inset-0 z-[9100] lg:hidden flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowCart(false)} />
            <div className="w-80 bg-surface flex flex-col border-l border-line">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <span className="font-display font-bold uppercase text-sm">Cart</span>
                <button onClick={() => setShowCart(false)} className="p-1 brutal-border hover:bg-ink hover:text-surface transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <CartPanel
                cart={cart}
                cartTotal={cartTotal}
                formatCurrency={formatCurrency}
                onAdd={itemId => {
                  const item = items.find(i => i.id === itemId)
                  if (item) addToCart(item)
                }}
                onRemove={removeFromCart}
                onCheckout={() => { setShowCart(false); setStep('confirm') }}
              />
            </div>
          </div>
        )}

        {/* Variant picker for browse mode */}
        {pendingBrowsePick && (
          <div
            className="absolute inset-0 z-[9200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setPendingBrowsePick(null) }}
          >
            <div className="brutal-border bg-surface w-full max-w-sm mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface">
                <div>
                  <h3 className="font-display font-bold text-sm uppercase tracking-tighter">
                    Select {pendingBrowsePick.item.variant_type ?? 'Variant'}
                  </h3>
                  <p className="font-mono text-[10px] text-surface/60 mt-0.5">{pendingBrowsePick.item.item_name}</p>
                </div>
                <button onClick={() => setPendingBrowsePick(null)} className="p-1.5 hover:bg-danger transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {(pendingBrowsePick.item.variants ?? []).map(v => {
                  const basePrice = v.price_override != null ? v.price_override : pendingBrowsePick.item.selling_price_retail
                  const price = computePrice(basePrice, pricingCustomer, sessionOverride)
                  const inCart = cart.find(c => c.item_id === pendingBrowsePick.item.id && c.variant_id === v.id)?.quantity ?? 0
                  const variantAvailable = v.stock_quantity - inCart
                  return (
                    <button
                      key={v.id}
                      disabled={variantAvailable <= 0}
                      onClick={() => { addToCart(pendingBrowsePick.item, v); setPendingBrowsePick(null) }}
                      className={cn(
                        'w-full px-4 py-3 brutal-border flex items-center justify-between transition-colors',
                        variantAvailable <= 0
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-accent hover:text-on-accent hover:border-accent',
                      )}
                    >
                      <div className="text-left">
                        <span className="font-mono font-bold text-sm">{v.variant_value}</span>
                        {inCart > 0 && (
                          <span className="ml-2 text-[10px] font-mono bg-accent text-on-accent px-1.5 py-0.5">{inCart} in cart</span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-sm">{formatCurrency(price)}</div>
                        <div className={cn('font-mono text-[10px]', variantAvailable <= 0 ? 'text-danger' : variantAvailable <= 5 ? 'text-warning' : 'text-ink-light')}>
                          {variantAvailable <= 0 ? 'No stock' : `${variantAvailable} left`}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>,
      document.body
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — STEP 3: CONFIRM
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return createPortal(
      <div className="fixed inset-0 z-[9000] bg-paper flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 bg-surface border-b border-line px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep('browse')} className="p-2 brutal-border hover:border-accent hover:text-accent transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-display font-bold uppercase text-sm">Confirm Invoice</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto p-4 space-y-5">
            {/* Cart summary (read-only) */}
            <div className="brutal-border bg-surface">
              <div className="px-4 py-3 border-b border-line font-mono text-[10px] uppercase tracking-widest text-ink-light">
                Order Summary
              </div>
              <div className="divide-y divide-line">
                {cart.map(c => (
                  <div key={c.item_id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-semibold truncate">{c.item_name}</p>
                      <p className="font-mono text-[11px] text-ink-light">{c.brand_name} · {formatCurrency(c.unit_price)} × {c.quantity}</p>
                    </div>
                    <span className="font-mono font-bold text-sm shrink-0">{formatCurrency(c.unit_price * c.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t-2 border-line flex justify-between items-center">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-light">Total</span>
                <span className="font-display font-bold text-xl">{formatCurrency(cartTotal)}</span>
              </div>
            </div>

            {/* Invoice details */}
            <div className="brutal-border bg-surface p-5 space-y-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light border-b border-line pb-2">
                Invoice Details
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1.5">Customer</label>
                <div className="px-3 py-2.5 brutal-border bg-paper font-mono text-sm text-ink-light">
                  {isWalkin ? 'Walk-in Customer' : selectedCustomer?.name}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1.5">Invoice Date</label>
                <DatePicker value={invoiceDate} onChange={setInvoiceDate} className="w-full" />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1.5">Payment Status</label>
                <div className="flex gap-2">
                  {(['paid', 'partial', 'unpaid'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setPaymentStatus(s)}
                      className={cn(
                        'flex-1 py-2 brutal-border font-mono text-xs uppercase tracking-widest transition-colors',
                        paymentStatus === s ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {paymentStatus !== 'unpaid' && (
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1.5">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent"
                  >
                    {['cash', 'upi', 'card', 'cheque', 'bank_transfer'].map(m => (
                      <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1.5">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any notes for this invoice…"
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleConfirmSubmit}
              disabled={createMutation.isPending}
              className="w-full py-4 bg-accent text-on-accent font-display font-bold uppercase tracking-widest text-lg brutal-border hover:bg-ink hover:text-surface hover:border-ink transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — SUCCESS
  // ─────────────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-paper flex items-center justify-center">
      <div className="max-w-sm w-full mx-4 text-center space-y-6">
        <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
        <div>
          <h2 className="font-display font-bold uppercase text-2xl tracking-tighter">Invoice Created</h2>
          <p className="font-mono text-sm text-ink-light mt-2">
            {createdInvoice?.number}
          </p>
          <p className="font-display font-bold text-3xl mt-3">{formatCurrency(cartTotal)}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={resetAll}
            className="w-full py-3 bg-accent text-on-accent font-mono text-xs uppercase tracking-widest brutal-border hover:bg-ink hover:text-surface transition-colors"
          >
            New Sale
          </button>
          <button
            onClick={() => navigate(`/invoices/${createdInvoice?.id}`)}
            className="w-full py-3 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-colors"
          >
            View Invoice
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Cart panel (shared between sidebar and mobile drawer) ─────────────────────
function CartPanel({
  cart,
  cartTotal,
  formatCurrency,
  onAdd,
  onRemove,
  onCheckout,
}: {
  cart: CartItem[]
  cartTotal: number
  formatCurrency: (n: number) => string
  onAdd: (itemId: number, variantId?: number) => void
  onRemove: (itemId: number, variantId?: number) => void
  onCheckout: () => void
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <ShoppingCart className="w-10 h-10 text-ink-light mb-3" />
            <p className="font-mono text-xs uppercase tracking-widest text-ink-light">Cart is empty</p>
            <p className="font-mono text-[10px] text-ink-muted mt-1">Add items from the grid</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {cart.map(c => (
              <div key={`${c.item_id}-${c.variant_id ?? 'base'}`} className="px-4 py-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-semibold truncate">{c.item_name}</p>
                  <p className="font-mono text-[10px] text-ink-light">{formatCurrency(c.unit_price)} each</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onRemove(c.item_id, c.variant_id)} className="w-6 h-6 brutal-border flex items-center justify-center hover:bg-danger hover:text-white hover:border-danger transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-mono text-xs font-bold">{c.quantity}</span>
                  <button
                    onClick={() => onAdd(c.item_id, c.variant_id)}
                    disabled={c.quantity >= c.stock}
                    className="w-6 h-6 brutal-border flex items-center justify-center hover:bg-accent hover:text-on-accent hover:border-accent transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-mono text-xs font-bold shrink-0 w-16 text-right">{formatCurrency(c.unit_price * c.quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart footer */}
      <div className="shrink-0 border-t border-line p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-mono text-xs uppercase tracking-widest text-ink-light">Total</span>
          <span className="font-display font-bold text-lg">{formatCurrency(cartTotal)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="w-full py-3 bg-accent text-on-accent font-mono text-xs uppercase tracking-widest brutal-border hover:bg-ink hover:text-surface transition-colors disabled:opacity-40"
        >
          Checkout →
        </button>
      </div>
    </>
  )
}
