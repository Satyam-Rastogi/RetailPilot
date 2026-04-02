import React, { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '../lib/toast'
import { itemService, variantService } from '../services/api'
import type { Item, ItemListResponse, ItemVariant, StockAdjust, PaginatedResponse } from '../types/api'
import Pagination from '../components/Pagination'
import { Sparkline } from '../components/Sparkline'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'
import {
  Plus, Minus, Package, Settings2, X, Search, Trash2,
  ChevronDown, ChevronUp, Layers, SlidersHorizontal,
} from 'lucide-react'
import { MagneticButton } from '../components/MagneticButton'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

const PAGE_SIZE = 20

// ── Brutalist toggle ─────────────────────────────────────────────────────────
function Toggle({ checked, onChange, accent = false }: { checked: boolean; onChange: (v: boolean) => void; accent?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative flex-shrink-0 w-11 h-6 border-2 transition-colors duration-200 brutal-focus outline-none',
        checked
          ? accent ? 'bg-accent border-accent' : 'bg-accent border-accent'
          : 'bg-paper border-line',
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 w-4 h-4 transition-transform duration-200',
        checked ? 'translate-x-5 bg-on-accent' : 'translate-x-0 bg-ink',
      )} />
    </button>
  )
}

// ── Organic sparkline trend ───────────────────────────────────────────────────
function itemTrend(current: number, isLow: boolean): number[] {
  if (!current) return [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const seeds = isLow
    ? [1.9, 1.7, 1.5, 1.3, 1.2, 1.1, 1.05, 1.02, 1.0]
    : [0.58, 0.65, 0.72, 0.78, 0.84, 0.89, 0.93, 0.97, 1.0]
  return seeds.map((s, i) =>
    Math.max(0, Math.round(current * s * (1 + Math.sin(i * 1.7 + current * 0.01) * 0.05)))
  )
}

const inputCls = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'

// ── Variant type presets ──────────────────────────────────────────────────────
const VARIANT_TYPES = ['Size', 'Color', 'Style', 'Material', 'Weight', 'Pack']

function ItemsPage() {
  const { formatCurrency, formatCurrencyCompact } = useSettings()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(showModal, () => setShowModal(false), modalRef)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [priceMode, setPriceMode] = useState<'any' | 'exact' | 'gt' | 'lt' | 'range'>('any')
  const [priceValue, setPriceValue] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [qtyMode, setQtyMode] = useState<'any' | 'exact' | 'gt' | 'lt' | 'range'>('any')
  const [qtyValue, setQtyValue] = useState('')
  const [qtyMin, setQtyMin] = useState('')
  const [qtyMax, setQtyMax] = useState('')

  // Variant builder state (in modal)
  const [variantInput, setVariantInput] = useState('')
  const [variantSkuInput, setVariantSkuInput] = useState('')
  const [variantStockInput, setVariantStockInput] = useState('')
  const [pendingVariants, setPendingVariants] = useState<{ value: string; sku: string; stock: number }[]>([])

  const queryClient = useQueryClient()

  const { data: items, isLoading } = useQuery<PaginatedResponse<ItemListResponse>>({
    queryKey: ['items', search, page],
    queryFn: () => itemService.list({ search: search || undefined, page, page_size: PAGE_SIZE }),
  })

  const [formData, setFormData] = useState({
    item_name: '',
    brand_name: '',
    sku: '',
    material: '',
    purchase_price: '',
    selling_price_retail: '',
    selling_price_wholesale: '',
    current_stock_quantity: '',
    unit_of_measurement: 'Pcs',
    low_stock_threshold: '',
    enable_low_stock_alert: false,
    has_variants: false,
    variant_type: 'Size',
    hsn_sac_code: '',
    gst_rate: '',
  })

  const resetForm = () => {
    setEditingItem(null)
    setPendingVariants([])
    setVariantInput('')
    setVariantSkuInput('')
    setVariantStockInput('')
    setFormData({
      item_name: '',
      brand_name: '',
      sku: '',
      material: '',
      purchase_price: '',
      selling_price_retail: '',
      selling_price_wholesale: '',
      current_stock_quantity: '',
      unit_of_measurement: 'Pcs',
      low_stock_threshold: '',
      enable_low_stock_alert: false,
      has_variants: false,
      variant_type: 'Size',
      hsn_sac_code: '',
      gst_rate: '',
    })
  }

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const item = await itemService.create(data)
      if (data.has_variants && pendingVariants.length > 0) {
        await Promise.all(
          pendingVariants.map(v =>
            variantService.create(item.id, {
              variant_value: v.value,
              sku: v.sku || undefined,
              stock_quantity: v.stock,
            })
          )
        )
      }
      return item
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowModal(false)
      resetForm()
      toast.success('Item added to inventory.')
    },
    onError: () => toast.error('Failed to create item.'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const item = await itemService.update(id, data)
      // Create any newly added pending variants
      if (data.has_variants && pendingVariants.length > 0) {
        await Promise.all(
          pendingVariants.map(v =>
            variantService.create(id, {
              variant_value: v.value,
              sku: v.sku || undefined,
              stock_quantity: v.stock,
            })
          )
        )
      }
      return item
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowModal(false)
      resetForm()
      toast.success('Item updated.')
    },
    onError: () => toast.error('Failed to update item.'),
  })

  const deleteMutation = useMutation({
    mutationFn: itemService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Item deleted.')
    },
    onError: () => toast.error('Failed to delete item.'),
  })

  const deleteVariantMutation = useMutation({
    mutationFn: ({ itemId, variantId }: { itemId: number; variantId: number }) =>
      variantService.delete(itemId, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Variant removed.')
    },
    onError: () => toast.error('Failed to delete variant.'),
  })

  // Stock adjustment modal state
  const [showStockModal, setShowStockModal] = useState(false)
  const [adjustingItem, setAdjustingItem] = useState<ItemListResponse | null>(null)
  const [stockDelta, setStockDelta] = useState('')
  const [stockReason, setStockReason] = useState('')
  const stockModalRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(showStockModal, () => setShowStockModal(false), stockModalRef)

  const openStockModal = (item: ItemListResponse) => {
    setAdjustingItem(item)
    setStockDelta('')
    setStockReason('')
    setShowStockModal(true)
  }

  const quickAdjustMutation = useMutation({
    mutationFn: ({ id, delta, reason }: { id: number; delta: number; reason?: string }) =>
      itemService.adjustStock(id, { delta, reason } as StockAdjust),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowStockModal(false)
      setAdjustingItem(null)
    },
    onError: () => toast.error('Stock adjustment failed.'),
  })

  const handleStockAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingItem) return
    const delta = parseInt(stockDelta)
    if (isNaN(delta) || delta === 0) { toast.error('Enter a non-zero adjustment.'); return }
    const newQty = (adjustingItem.current_stock_quantity ?? 0) + delta
    if (newQty < 0) { toast.error('Stock cannot go below zero.'); return }
    quickAdjustMutation.mutate({ id: adjustingItem.id, delta, reason: stockReason.trim() || undefined })
  }

  const variantAdjustMutation = useMutation({
    mutationFn: ({ itemId, variantId, delta }: { itemId: number; variantId: number; delta: number }) =>
      variantService.adjustStock(itemId, variantId, { delta }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
    onError: () => toast.error('Variant stock adjustment failed.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      sku: formData.sku || null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      selling_price_retail: parseFloat(formData.selling_price_retail),
      selling_price_wholesale: parseFloat(formData.selling_price_wholesale),
      current_stock_quantity: formData.has_variants ? 0 : parseInt(formData.current_stock_quantity || '0'),
      low_stock_threshold: formData.low_stock_threshold ? parseInt(formData.low_stock_threshold) : null,
      variant_type: formData.has_variants ? formData.variant_type : null,
      gst_rate: formData.gst_rate !== '' ? parseFloat(formData.gst_rate) : null,
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = async (item: ItemListResponse) => {
    const fullItem = await itemService.get(item.id)
    setEditingItem(fullItem)
    setPendingVariants([])
    setFormData({
      item_name: fullItem.item_name,
      brand_name: fullItem.brand_name,
      sku: fullItem.sku || '',
      material: fullItem.material || '',
      purchase_price: fullItem.purchase_price?.toString() || '',
      selling_price_retail: fullItem.selling_price_retail.toString(),
      selling_price_wholesale: fullItem.selling_price_wholesale.toString(),
      current_stock_quantity: fullItem.current_stock_quantity?.toString() || '0',
      unit_of_measurement: fullItem.unit_of_measurement || 'Pcs',
      low_stock_threshold: fullItem.low_stock_threshold?.toString() || '',
      enable_low_stock_alert: fullItem.enable_low_stock_alert ?? false,
      has_variants: fullItem.has_variants ?? false,
      variant_type: fullItem.variant_type || 'Size',
      hsn_sac_code: (fullItem as any).hsn_sac_code || '',
      gst_rate: fullItem.gst_rate?.toString() ?? '',
    })
    setShowModal(true)
  }

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleVariantAdjust = (itemId: number, variant: ItemVariant, delta: 1 | -1) => {
    if (delta === -1 && variant.stock_quantity <= 0) {
      toast.error('Variant stock cannot go below zero.')
      return
    }
    variantAdjustMutation.mutate({ itemId, variantId: variant.id, delta })
  }

  const toggleExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addPendingVariant = () => {
    const val = variantInput.trim()
    if (!val) return
    setPendingVariants(prev => [...prev, {
      value: val,
      sku: variantSkuInput.trim(),
      stock: parseInt(variantStockInput) || 0,
    }])
    setVariantInput('')
    setVariantSkuInput('')
    setVariantStockInput('')
  }

  const pageItems = items?.data ?? []

  const filteredItems = useMemo(() => {
    let result = pageItems
    if (brandFilter.trim()) {
      const q = brandFilter.toLowerCase()
      result = result.filter(i => i.brand_name?.toLowerCase().includes(q))
    }
    if (priceMode !== 'any') {
      result = result.filter(i => {
        const p = i.selling_price_retail
        if (priceMode === 'exact') return p === parseFloat(priceValue)
        if (priceMode === 'gt') return p > parseFloat(priceValue || '0')
        if (priceMode === 'lt') return p < parseFloat(priceValue || '0')
        if (priceMode === 'range') return p >= parseFloat(priceMin || '0') && p <= parseFloat(priceMax || '9999999')
        return true
      })
    }
    if (qtyMode !== 'any') {
      result = result.filter(i => {
        const q = i.current_stock_quantity ?? 0
        if (qtyMode === 'exact') return q === parseInt(qtyValue)
        if (qtyMode === 'gt') return q > parseInt(qtyValue || '0')
        if (qtyMode === 'lt') return q < parseInt(qtyValue || '0')
        if (qtyMode === 'range') return q >= parseInt(qtyMin || '0') && q <= parseInt(qtyMax || '9999999')
        return true
      })
    }
    return result
  }, [pageItems, brandFilter, priceMode, priceValue, priceMin, priceMax, qtyMode, qtyValue, qtyMin, qtyMax])

  const hasActiveFilters = brandFilter.trim() || priceMode !== 'any' || qtyMode !== 'any'

  const lowStockCount = filteredItems.filter(i => i.is_low_stock).length
  const totalValue = filteredItems.reduce(
    (s, i) => s + i.selling_price_retail * (i.current_stock_quantity ?? 0), 0
  )

  // All saved variants of the item being edited
  const savedVariants: ItemVariant[] = editingItem?.variants ?? []

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-display font-bold tracking-tighter uppercase leading-none"
          >
            Inventory
          </motion.h1>
          <p className="text-ink-light font-mono uppercase tracking-widest text-sm mt-3">Stock Management</p>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </div>
        <MagneticButton strength={0.5}>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </MagneticButton>
      </header>

      {/* Controls & Stats */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div className="flex gap-2 xl:w-[32rem]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, brand, or SKU..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full brutal-border bg-surface pl-12 pr-4 py-3 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'px-4 py-3 brutal-border font-mono text-xs uppercase tracking-widest flex items-center gap-2 transition-colors brutal-focus shrink-0',
              showFilters || hasActiveFilters
                ? 'bg-accent text-on-accent border-accent'
                : 'bg-surface hover:border-accent hover:text-accent'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilters ? 'Filtered' : 'Filters'}
          </button>
        </div>
        <div className="flex brutal-border bg-surface divide-x divide-line overflow-x-auto">
          <div className="flex items-center gap-3 px-5 py-3 shrink-0">
            <div className="w-10 h-10 border border-line bg-paper flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-ink" />
            </div>
            <div>
              <p className="text-[10px] text-ink-light font-mono uppercase tracking-widest">Total Items</p>
              <p className="font-display font-bold text-xl">{(items?.total_items ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 shrink-0">
            <div className="w-10 h-10 border border-danger bg-paper flex items-center justify-center shrink-0">
              <span className={cn('w-3 h-3 bg-danger', lowStockCount > 0 && 'animate-pulse')} />
            </div>
            <div>
              <p className="text-[10px] text-ink-light font-mono uppercase tracking-widest">Low Stock</p>
              <p className={cn('font-display font-bold text-xl', lowStockCount > 0 ? 'text-danger' : 'text-ink')}>
                {lowStockCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 shrink-0">
            <div className="w-10 h-10 border border-line bg-ink text-surface flex items-center justify-center font-mono font-bold text-base shrink-0">₹</div>
            <div>
              <p className="text-[10px] text-ink-light font-mono uppercase tracking-widest">Est. Value</p>
              <p className="font-display font-bold text-xl">{formatCurrencyCompact(totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="brutal-border bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-ink-light">Advanced Filters</span>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setBrandFilter(''); setPriceMode('any'); setPriceValue(''); setPriceMin(''); setPriceMax('')
                  setQtyMode('any'); setQtyValue(''); setQtyMin(''); setQtyMax('')
                }}
                className="text-[10px] font-mono uppercase tracking-widest text-danger hover:underline brutal-focus"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Brand filter */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Brand Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-light pointer-events-none" />
                <input
                  type="text"
                  placeholder="Fuzzy search brand..."
                  value={brandFilter}
                  onChange={e => setBrandFilter(e.target.value)}
                  className="w-full brutal-border bg-paper pl-9 pr-3 py-2.5 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Price filter */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light">Retail Price</label>
              <select
                value={priceMode}
                onChange={e => { setPriceMode(e.target.value as any); setPriceValue(''); setPriceMin(''); setPriceMax('') }}
                className="w-full brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="any">Any Price</option>
                <option value="exact">Exact</option>
                <option value="gt">Greater Than</option>
                <option value="lt">Less Than</option>
                <option value="range">Range</option>
              </select>
              {(priceMode === 'exact' || priceMode === 'gt' || priceMode === 'lt') && (
                <input
                  type="number" step="0.01" min="0"
                  placeholder={priceMode === 'exact' ? 'Price = ?' : priceMode === 'gt' ? 'Price > ?' : 'Price < ?'}
                  value={priceValue}
                  onChange={e => setPriceValue(e.target.value)}
                  className="w-full brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                />
              )}
              {priceMode === 'range' && (
                <div className="flex gap-2">
                  <input type="number" step="0.01" min="0" placeholder="Min" value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    className="w-1/2 brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors" />
                  <input type="number" step="0.01" min="0" placeholder="Max" value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    className="w-1/2 brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors" />
                </div>
              )}
            </div>

            {/* Qty filter */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light">Stock Quantity</label>
              <select
                value={qtyMode}
                onChange={e => { setQtyMode(e.target.value as any); setQtyValue(''); setQtyMin(''); setQtyMax('') }}
                className="w-full brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="any">Any Quantity</option>
                <option value="exact">Exact</option>
                <option value="gt">Greater Than</option>
                <option value="lt">Less Than</option>
                <option value="range">Range</option>
              </select>
              {(qtyMode === 'exact' || qtyMode === 'gt' || qtyMode === 'lt') && (
                <input
                  type="number" min="0"
                  placeholder={qtyMode === 'exact' ? 'Qty = ?' : qtyMode === 'gt' ? 'Qty > ?' : 'Qty < ?'}
                  value={qtyValue}
                  onChange={e => setQtyValue(e.target.value)}
                  className="w-full brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                />
              )}
              {qtyMode === 'range' && (
                <div className="flex gap-2">
                  <input type="number" min="0" placeholder="Min" value={qtyMin}
                    onChange={e => setQtyMin(e.target.value)}
                    className="w-1/2 brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors" />
                  <input type="number" min="0" placeholder="Max" value={qtyMax}
                    onChange={e => setQtyMax(e.target.value)}
                    className="w-1/2 brutal-border bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors" />
                </div>
              )}
            </div>
          </div>
          {hasActiveFilters && (
            <p className="text-[10px] font-mono text-ink-light uppercase tracking-widest">
              Showing {filteredItems.length} of {pageItems.length} items on this page
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <Package className="w-10 h-10 text-ink-light mx-auto mb-4" />
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading inventory...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="brutal-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="bg-ink text-surface border-b border-line">
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Item Details</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">SKU</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Stock Level</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Pricing (Ret/WS)</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => {
                  const isExpanded = expandedRows.has(item.id)
                  const stock = item.current_stock_quantity ?? 0
                  const threshold = item.low_stock_threshold ?? 10
                  const percent = Math.max(4, Math.min(100, (stock / Math.max(threshold, 1)) * 100))
                  const trend = itemTrend(stock, item.is_low_stock ?? false)
                  const variants = item.variants ?? []

                  return (
                    <React.Fragment key={item.id}>
                      {/* ── Parent row ─────────────────────────────────────── */}
                      <tr
                        className={cn(
                          'transition-colors border-b border-line group cursor-default',
                          isExpanded ? 'bg-ink text-surface' : 'hover:bg-ink hover:text-surface',
                        )}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base leading-tight">{item.item_name}</span>
                            {item.has_variants && (
                              <span className={cn(
                                'text-[10px] font-mono tracking-widest px-2 py-0.5 border uppercase',
                                isExpanded
                                  ? 'border-surface/40 text-surface/80'
                                  : 'border-line text-ink-light group-hover:border-surface/40 group-hover:text-surface/80',
                              )}>
                                {variants.length} {item.variant_type || 'Variant'}{variants.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className={cn(
                            'font-mono text-xs uppercase tracking-widest mt-0.5',
                            isExpanded ? 'text-surface/60' : 'text-ink-light group-hover:text-surface/60',
                          )}>
                            {item.brand_name}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn(
                            'font-mono text-xs',
                            isExpanded ? 'text-surface/70' : 'text-ink-light group-hover:text-surface/70',
                          )}>
                            {item.sku || <span className="opacity-40">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-4 min-w-[150px]">
                          <div className="font-mono">
                            <span className={cn(
                              'font-bold text-lg',
                              item.is_low_stock
                                ? isExpanded ? 'text-danger' : 'text-danger group-hover:text-surface'
                                : '',
                            )}>
                              {stock}
                            </span>{' '}
                            <span className={cn(
                              'text-xs',
                              isExpanded ? 'text-surface/60' : 'text-ink-light group-hover:text-surface/60',
                            )}>
                              {item.unit_of_measurement}
                            </span>
                          </div>
                          <div className={cn(
                            'h-1.5 w-28 border overflow-hidden mt-2',
                            isExpanded
                              ? 'border-surface/20 bg-surface/10'
                              : 'border-line bg-surface group-hover:border-surface/20 group-hover:bg-surface/10',
                          )}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 1, delay: 0.1 + i * 0.04, ease: 'easeOut' }}
                              className={cn(
                                'h-full',
                                item.is_low_stock
                                  ? isExpanded ? 'bg-accent' : 'bg-danger group-hover:bg-accent'
                                  : isExpanded ? 'bg-surface/40' : 'bg-ink group-hover:bg-surface/40',
                              )}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="font-mono text-sm">
                              <div className="font-bold">{formatCurrency(item.selling_price_retail)}</div>
                              <div className={cn(
                                'text-xs',
                                isExpanded ? 'text-surface/60' : 'text-ink-light group-hover:text-surface/60',
                              )}>
                                {formatCurrency(item.selling_price_wholesale)}
                              </div>
                            </div>
                            {!item.has_variants && <Sparkline data={trend} width={56} height={20} filled />}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn(
                            'inline-block px-3 py-1 text-[10px] font-mono uppercase tracking-widest border',
                            item.is_low_stock
                              ? isExpanded
                                ? 'bg-surface/20 border-surface/30 text-surface'
                                : 'bg-danger text-on-status border-danger group-hover:bg-surface/20 group-hover:border-surface/30 group-hover:text-surface'
                              : isExpanded
                                ? 'border-surface/40'
                                : 'border-line group-hover:border-surface/40',
                          )}>
                            {item.is_low_stock ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEdit(item)}
                              className={cn(
                                'p-2 border border-transparent transition-all brutal-focus',
                                isExpanded
                                  ? 'hover:bg-surface hover:text-ink hover:border-line/20 border-surface/40'
                                  : 'hover:bg-surface hover:text-ink hover:border-line group-hover:border-surface/40',
                              )}
                              title="Edit Item"
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>
                            {item.has_variants ? (
                              <button
                                onClick={() => toggleExpand(item.id)}
                                className={cn(
                                  'p-2 border transition-all brutal-focus',
                                  isExpanded
                                    ? 'border-surface/40 hover:bg-surface hover:text-ink'
                                    : 'border-transparent hover:bg-surface hover:text-ink hover:border-line group-hover:border-surface/40',
                                )}
                                title={isExpanded ? 'Collapse variants' : 'Expand variants'}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            ) : (
                              <button
                                onClick={() => openStockModal(item)}
                                className={cn(
                                  'p-2 border border-transparent hover:bg-accent hover:text-on-accent transition-all brutal-focus',
                                  isExpanded ? 'border-surface/40' : 'group-hover:border-surface/40',
                                )}
                                title="Adjust Stock"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Variant sub-rows ────────────────────────────────── */}
                      <AnimatePresence>
                        {isExpanded && item.has_variants && (
                          <motion.tr
                            key={`${item.id}-variants`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={6} className="p-0 border-b border-line">
                              <div className="bg-paper border-l-4 border-l-accent">
                                {/* Sub-header */}
                                <div className="flex items-center gap-2 px-6 py-2 border-b border-line">
                                  <Layers className="w-3 h-3 text-ink-light" />
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-light">
                                    {item.variant_type || 'Variant'} options
                                  </span>
                                </div>
                                <table className="w-full">
                                  <tbody className="divide-y divide-line/40">
                                    {variants.map(v => (
                                      <tr key={v.id} className="hover:bg-ink hover:text-surface group/sub transition-colors">
                                        <td className="pl-8 pr-4 py-3 min-w-[200px]">
                                          <span className="font-mono font-bold text-sm flex items-center gap-2">
                                            <span className="w-3 h-px bg-ink group-hover/sub:bg-surface opacity-30" />
                                            {v.variant_value}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-ink-light group-hover/sub:text-surface/60">
                                          {v.sku || <span className="opacity-40">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={cn(
                                            'font-mono font-bold text-sm',
                                            v.stock_quantity <= (item.low_stock_threshold ?? 0)
                                              ? 'text-danger group-hover/sub:text-surface'
                                              : '',
                                          )}>
                                            {v.stock_quantity}
                                          </span>
                                          <span className="font-mono text-xs text-ink-light group-hover/sub:text-surface/60 ml-1">
                                            {item.unit_of_measurement}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3" colSpan={2} />
                                        <td className="px-4 py-3">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <button
                                              onClick={() => handleVariantAdjust(item.id, v, -1)}
                                              className="p-1.5 border border-transparent hover:bg-danger hover:text-on-status hover:scale-110 group-hover/sub:border-surface/40 transition-all brutal-focus"
                                              title="Remove 1"
                                            >
                                              <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => handleVariantAdjust(item.id, v, 1)}
                                              className="p-1.5 border border-transparent hover:bg-accent hover:text-on-accent hover:scale-110 group-hover/sub:border-surface/40 transition-all brutal-focus"
                                              title="Add 1"
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => deleteVariantMutation.mutate({ itemId: item.id, variantId: v.id })}
                                              className="p-1.5 border border-transparent hover:bg-danger hover:text-on-status hover:scale-110 group-hover/sub:border-surface/40 transition-all brutal-focus"
                                              title="Delete variant"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                    {variants.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="px-8 py-4 font-mono text-xs text-ink-light uppercase tracking-widest">
                                          No variants yet — add them via the edit modal.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {items && items.total_pages > 1 && (
            <div className="border-t border-line">
              <Pagination
                currentPage={page}
                totalPages={items.total_pages}
                totalItems={items.total_items}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="brutal-border bg-surface p-16 text-center">
          <Package className="w-10 h-10 text-ink-light mx-auto mb-4" />
          <h3 className="font-mono text-sm uppercase tracking-widest text-ink mb-2">No Items Found</h3>
          <p className="font-mono text-xs text-ink-light mb-6">
            {(search || hasActiveFilters) ? 'No items match your search or filters.' : 'Add your first item to get started.'}
          </p>
          {!search && !hasActiveFilters && (
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover brutal-focus transition-all mx-auto"
            >
              <Plus className="w-4 h-4" /> Add First Item
            </button>
          )}
        </div>
      )}

      {/* ── Stock Adjustment Modal ───────────────────────────────────────────── */}
      {showStockModal && adjustingItem && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowStockModal(false) }}>
          <div ref={stockModalRef} className="brutal-border bg-surface w-full max-w-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tighter">Adjust Stock</h2>
                <p className="font-mono text-xs text-surface/60 uppercase tracking-widest mt-0.5 truncate max-w-[220px]">{adjustingItem.item_name}</p>
              </div>
              <button onClick={() => setShowStockModal(false)} className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStockAdjustSubmit} className="p-6 space-y-5">
              <div className="flex items-center justify-between brutal-border bg-paper px-4 py-3">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-light">Current Stock</span>
                <span className="font-display font-bold text-2xl">
                  {adjustingItem.current_stock_quantity ?? 0}
                  <span className="font-mono text-xs text-ink-light ml-1">{adjustingItem.unit_of_measurement}</span>
                </span>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                  Adjustment <span className="text-accent">(+add / −remove)</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStockDelta(d => { const v = parseInt(d || '0') - 1; return v.toString() })}
                    className="px-3 py-2.5 brutal-border bg-paper font-mono font-bold text-lg hover:bg-danger hover:text-on-status transition-colors brutal-focus">−</button>
                  <input
                    type="number"
                    required
                    value={stockDelta}
                    onChange={e => setStockDelta(e.target.value)}
                    placeholder="e.g. 10 or -5"
                    className="flex-1 px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm text-center focus:outline-none focus:border-accent transition-colors"
                    autoFocus
                  />
                  <button type="button" onClick={() => setStockDelta(d => { const v = parseInt(d || '0') + 1; return v.toString() })}
                    className="px-3 py-2.5 brutal-border bg-paper font-mono font-bold text-lg hover:bg-accent hover:text-on-accent transition-colors brutal-focus">+</button>
                </div>
                {stockDelta && !isNaN(parseInt(stockDelta)) && (
                  <p className={cn('font-mono text-xs mt-1.5', parseInt(stockDelta) < 0 ? 'text-danger' : 'text-accent')}>
                    New stock: {Math.max(0, (adjustingItem.current_stock_quantity ?? 0) + parseInt(stockDelta))} {adjustingItem.unit_of_measurement}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Reason <span className="opacity-50">(optional)</span></label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={e => setStockReason(e.target.value)}
                  placeholder="e.g. Physical count, Damaged goods, Received shipment"
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={quickAdjustMutation.isPending}
                className="w-full py-3 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {quickAdjustMutation.isPending ? 'Saving…' : 'Apply Adjustment'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div ref={modalRef} className="brutal-border bg-surface w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tighter">
                  {editingItem ? 'Edit Item' : 'Add Item'}
                </h2>
                <p className="font-mono text-xs text-surface/60 uppercase tracking-widest mt-0.5">
                  Inventory Configuration Base
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} id="item-form" className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">
                {/* Item Name */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Item Name *</label>
                  <input type="text" required value={formData.item_name}
                    onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g., Silk Saree" className={inputCls} />
                </div>

                {/* Brand + SKU */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Brand / Supplier *</label>
                    <input type="text" required value={formData.brand_name}
                      onChange={e => setFormData({ ...formData, brand_name: e.target.value })}
                      placeholder="e.g., Kanjeevaram Silks" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Base SKU</label>
                    <input type="text" value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g., KS-001" className={inputCls} />
                  </div>
                </div>

                {/* Pricing */}
                <div className="border border-line bg-paper p-4 space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light font-bold">Pricing</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Base Retail Price *</label>
                      <input type="number" step="0.01" required value={formData.selling_price_retail}
                        onChange={e => setFormData({ ...formData, selling_price_retail: e.target.value })}
                        placeholder="0.00" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Base Wholesale Price *</label>
                      <input type="number" step="0.01" required value={formData.selling_price_wholesale}
                        onChange={e => setFormData({ ...formData, selling_price_wholesale: e.target.value })}
                        placeholder="0.00" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Purchase Price</label>
                      <input type="number" step="0.01" value={formData.purchase_price}
                        onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                        placeholder="0.00" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Material</label>
                      <input type="text" value={formData.material}
                        onChange={e => setFormData({ ...formData, material: e.target.value })}
                        placeholder="e.g., Silk, Cotton" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">HSN / SAC Code</label>
                      <input type="text" value={formData.hsn_sac_code}
                        onChange={e => setFormData({ ...formData, hsn_sac_code: e.target.value })}
                        placeholder="e.g., 5208, 998311" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">GST Rate</label>
                      <select value={formData.gst_rate}
                        onChange={e => setFormData({ ...formData, gst_rate: e.target.value })}
                        className={inputCls}>
                        <option value="">Select GST Rate</option>
                        <option value="0">0% — Exempt / Nil rated</option>
                        <option value="5">5% — Essential goods</option>
                        <option value="12">12% — Standard goods</option>
                        <option value="18">18% — Standard services</option>
                        <option value="28">28% — Luxury / sin goods</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Variant Engine */}
                <div className="border border-line bg-paper p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                        <Layers className="w-4 h-4 text-accent" />
                        Variant Engine
                      </p>
                      <p className="font-mono text-[10px] text-ink-light mt-0.5">
                        Track sizes, colors, or configurations independently
                      </p>
                    </div>
                    <Toggle
                      checked={formData.has_variants}
                      onChange={v => setFormData({ ...formData, has_variants: v })}
                    />
                  </div>

                  {formData.has_variants && (
                    <div className="space-y-4 border-t border-line pt-4">
                      {/* Variant Type */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Variant Type</label>
                          <div className="flex gap-2 flex-wrap">
                            {VARIANT_TYPES.map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setFormData({ ...formData, variant_type: t })}
                                className={cn(
                                  'px-3 py-1 border font-mono text-xs uppercase tracking-widest transition-colors brutal-focus',
                                  formData.variant_type === t
                                    ? 'bg-accent text-on-accent border-accent'
                                    : 'border-line hover:border-accent hover:text-accent',
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={formData.variant_type}
                            onChange={e => setFormData({ ...formData, variant_type: e.target.value })}
                            placeholder="Custom type..."
                            className={cn(inputCls, 'mt-2')}
                          />
                        </div>
                      </div>

                      {/* Add new variant row */}
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-2">
                          Add {formData.variant_type} Options
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={variantInput}
                            onChange={e => setVariantInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPendingVariant() } }}
                            placeholder={`e.g., ${formData.variant_type === 'Size' ? 'Small' : formData.variant_type === 'Color' ? 'Red' : 'Option'}`}
                            className={inputCls}
                          />
                          <input
                            type="text"
                            value={variantSkuInput}
                            onChange={e => setVariantSkuInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPendingVariant() } }}
                            placeholder="Child SKU (opt.)"
                            className={inputCls}
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={variantStockInput}
                              onChange={e => setVariantStockInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPendingVariant() } }}
                              placeholder="Stock"
                              className={cn(inputCls, 'flex-1')}
                            />
                            <button
                              type="button"
                              onClick={addPendingVariant}
                              className="px-3 bg-accent text-on-accent brutal-border brutal-focus hover:opacity-90 transition-opacity"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="font-mono text-[10px] text-ink-light mt-1">Press Enter or + to add</p>
                      </div>

                      {/* Variant configuration table */}
                      {(savedVariants.length > 0 || pendingVariants.length > 0) && (
                        <div className="border border-line overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-line bg-ink/5">
                                <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-ink-light">Value</th>
                                <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-ink-light">Child SKU</th>
                                <th className="px-3 py-2 text-center text-[10px] font-mono uppercase tracking-widest text-ink-light">Stock</th>
                                <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-widest text-ink-light">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {/* Saved variants (from DB) */}
                              {savedVariants.map(v => (
                                <tr key={v.id} className="hover:bg-paper transition-colors">
                                  <td className="px-3 py-2 font-mono font-bold text-sm">{v.variant_value}</td>
                                  <td className="px-3 py-2 font-mono text-xs text-ink-light">{v.sku || '—'}</td>
                                  <td className="px-3 py-2 font-mono text-sm text-center font-bold">{v.stock_quantity}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => deleteVariantMutation.mutate({ itemId: editingItem!.id, variantId: v.id })}
                                      className="p-1 text-ink-light hover:text-danger transition-colors brutal-focus"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {/* Pending (unsaved) variants */}
                              {pendingVariants.map((v, idx) => (
                                <tr key={`pending-${idx}`} className="hover:bg-paper transition-colors opacity-70">
                                  <td className="px-3 py-2 font-mono font-bold text-sm">
                                    {v.value}
                                    <span className="ml-1 text-[10px] text-accent uppercase">new</span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs text-ink-light">{v.sku || '—'}</td>
                                  <td className="px-3 py-2 font-mono text-sm text-center font-bold">{v.stock}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setPendingVariants(prev => prev.filter((_, i) => i !== idx))}
                                      className="p-1 text-ink-light hover:text-danger transition-colors brutal-focus"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Stock (only when no variants) */}
                {!formData.has_variants && (
                  <div className="border border-line bg-paper p-4 space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light font-bold">Stock</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Current Stock *</label>
                        <input type="number" required value={formData.current_stock_quantity}
                          onChange={e => setFormData({ ...formData, current_stock_quantity: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Unit of Measurement</label>
                        <input type="text" value={formData.unit_of_measurement}
                          onChange={e => setFormData({ ...formData, unit_of_measurement: e.target.value })}
                          placeholder="Pcs" className={inputCls} />
                      </div>
                    </div>
                    {/* Low stock toggle */}
                    <div className="border-t border-line pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-widest font-bold">Low Stock Notifications</p>
                          <p className="font-mono text-[10px] text-ink-light mt-0.5">Alert when stock drops below threshold</p>
                        </div>
                        <Toggle
                          checked={formData.enable_low_stock_alert}
                          onChange={v => setFormData({ ...formData, enable_low_stock_alert: v })}
                        />
                      </div>
                      {formData.enable_low_stock_alert && (
                        <div className="mt-3">
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Alert Threshold</label>
                          <input type="number" value={formData.low_stock_threshold}
                            onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                            placeholder="e.g., 10" className={inputCls} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Unit (when variants enabled) */}
                {formData.has_variants && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Unit of Measurement</label>
                    <input type="text" value={formData.unit_of_measurement}
                      onChange={e => setFormData({ ...formData, unit_of_measurement: e.target.value })}
                      placeholder="Pcs" className={inputCls} />
                  </div>
                )}

                {/* Danger zone — editing only */}
                {editingItem && (
                  <div className="border border-danger/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-danger mb-3">Danger Zone</p>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); handleDelete(editingItem.id, editingItem.item_name) }}
                      className="flex items-center gap-2 px-4 py-2 border border-danger text-danger font-mono text-xs uppercase tracking-wider hover:bg-danger hover:text-on-status transition-colors brutal-focus"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete This Item
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Footer */}
            <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
                Cancel
              </button>
              <button type="submit" form="item-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50">
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Inventory'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default ItemsPage
