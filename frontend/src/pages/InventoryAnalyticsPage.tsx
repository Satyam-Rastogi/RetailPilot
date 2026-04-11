import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip as RTooltip,
  ResponsiveContainer, Cell, BarChart, Bar, CartesianGrid,
} from 'recharts'
import { ArrowLeft, X, Package, AlertTriangle, TrendingDown, ArchiveX } from 'lucide-react'
import { analyticsService } from '../services/api'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number
  item_name: string
  brand_name: string
  category: string
  current_stock: number
  purchase_price: number
  selling_price_retail: number
  selling_price_wholesale: number
  value_at_cost: number
  value_at_retail: number
  units_sold_30d: number
  low_stock_threshold: number | null
  unit: string
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

// ── Quadrant filter options ────────────────────────────────────────────────────

type Quadrant = 'all' | 'stars' | 'overstocked' | 'at_risk' | 'dead'

function classifyItem(item: InventoryItem, medianStock: number, medianSold: number): Quadrant {
  const highStock = item.current_stock >= medianStock
  const highSold  = item.units_sold_30d >= medianSold
  if (highStock && highSold)   return 'stars'
  if (highStock && !highSold)  return 'overstocked'
  if (!highStock && highSold)  return 'at_risk'
  return 'dead'
}

// ── Item Detail Modal ─────────────────────────────────────────────────────────

function ItemDetailModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { formatCurrency } = useSettings()
  const statusColors = { in_stock: 'success', low_stock: 'warning', out_of_stock: 'danger' } as const
  const statusLabels = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="brutal-border bg-surface w-full max-w-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-line bg-ink text-surface">
          <div>
            <h3 className="font-display font-bold text-lg uppercase">{item.item_name}</h3>
            <p className="font-mono text-xs text-surface/60 mt-0.5">{item.brand_name} · {item.category}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-danger/20 transition-colors brutal-focus">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-line">
          {[
            { label: 'Current Stock',   value: `${item.current_stock} ${item.unit}` },
            { label: 'Value at Cost',   value: formatCurrency(item.value_at_cost) },
            { label: 'Sold (30d)',       value: `${item.units_sold_30d} ${item.unit}` },
            { label: 'Retail Price',    value: formatCurrency(item.selling_price_retail) },
            { label: 'Purchase Price',  value: item.purchase_price ? formatCurrency(item.purchase_price) : '—' },
            { label: 'Wholesale Price', value: formatCurrency(item.selling_price_wholesale) },
          ].map(s => (
            <div key={s.label} className="p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">{s.label}</p>
              <p className="font-mono font-bold text-lg mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Status + margin */}
        <div className="p-4 border-t border-line flex items-center justify-between">
          <span className={cn(
            'px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border',
            item.stock_status === 'in_stock'     && 'border-success text-success',
            item.stock_status === 'low_stock'    && 'border-warning text-warning',
            item.stock_status === 'out_of_stock' && 'bg-danger text-on-status border-danger',
          )}>
            {statusLabels[item.stock_status]}
          </span>
          {item.purchase_price && item.selling_price_retail > 0 && (
            <span className="font-mono text-sm text-ink-light">
              Margin:{' '}
              <span className="font-bold text-success">
                {Math.round(((item.selling_price_retail - item.purchase_price) / item.selling_price_retail) * 100)}%
              </span>
            </span>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Waffle Chart ──────────────────────────────────────────────────────────────

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

const WAFFLE_COLORS: Record<StockStatus, string> = {
  in_stock:     'var(--theme-success)',
  low_stock:    'var(--theme-warning)',
  out_of_stock: 'var(--theme-danger)',
}

function WaffleChart({ inStock, lowStock, outOfStock, activeStatus, onStatusClick }: {
  inStock: number; lowStock: number; outOfStock: number
  activeStatus: string | null; onStatusClick: (s: string | null) => void
}) {
  const total = inStock + lowStock + outOfStock
  if (total === 0) return null

  const cells: StockStatus[] = [
    ...Array(inStock).fill('in_stock'),
    ...Array(lowStock).fill('low_stock'),
    ...Array(outOfStock).fill('out_of_stock'),
  ]

  const cols = Math.min(Math.ceil(Math.sqrt(total * 1.6)), 10)

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}
      className="w-full"
    >
      {cells.map((status, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: !activeStatus || activeStatus === status ? 0.85 : 0.15,
          }}
          transition={{ delay: Math.min(i * 0.012, 0.45), duration: 0.18 }}
          onClick={() => onStatusClick(activeStatus === status ? null : status)}
          className="cursor-pointer"
          style={{ aspectRatio: '1', backgroundColor: WAFFLE_COLORS[status] }}
          title={status.replace(/_/g, ' ')}
          whileHover={{ scale: 1.2, transition: { duration: 0.1, delay: 0 } }}
        />
      ))}
    </div>
  )
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function BrandTooltip({ active, payload, label }: any) {
  const { formatCurrency } = useSettings()
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div
      className="p-3 text-xs font-mono pointer-events-none"
      style={{ backgroundColor: 'rgba(8,8,8,0.93)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
    >
      <p className="font-bold uppercase tracking-wider mb-1.5" style={{ color: '#F59E0B' }}>{label}</p>
      <p style={{ color: 'rgba(240,240,240,0.6)' }}>Value at Cost</p>
      <p className="font-bold text-sm mt-0.5">{formatCurrency(value)}</p>
    </div>
  )
}

function ScatterTooltip({ active, payload }: any) {
  const { formatCurrency } = useSettings()
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as InventoryItem
  if (!d) return null
  return (
    <div
      className="p-3 text-xs font-mono space-y-1 pointer-events-none"
      style={{ backgroundColor: 'rgba(8,8,8,0.93)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
    >
      <p className="font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>{d.item_name}</p>
      <p style={{ color: 'rgba(240,240,240,0.55)' }}>{d.brand_name}</p>
      <div className="pt-1 mt-1 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <p>Stock: <span className="font-bold">{d.current_stock} {d.unit}</span></p>
        <p>Sold 30d: <span className="font-bold">{d.units_sold_30d} {d.unit}</span></p>
        <p>Value: <span className="font-bold">{formatCurrency(d.value_at_cost)}</span></p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryAnalyticsPage() {
  const navigate = useNavigate()
  const { formatCurrency, formatCurrencyCompact } = useSettings()

  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant>('all')
  const [activeCat,      setActiveCat]      = useState<string | null>(null)
  const [activeStatus,   setActiveStatus]   = useState<string | null>(null)
  const [selectedItem,   setSelectedItem]   = useState<InventoryItem | null>(null)
  const [search,         setSearch]         = useState('')
  const [sortKey,        setSortKey]        = useState<'value_at_cost' | 'current_stock' | 'units_sold_30d'>('value_at_cost')
  const [sortDir,        setSortDir]        = useState<'desc' | 'asc'>('desc')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-value'],
    queryFn: () => analyticsService.getInventoryValue(),
    staleTime: 3 * 60_000,
  })

  const summary    = data?.summary
  const items: InventoryItem[] = data?.items ?? []
  const byCategory = data?.by_category ?? []
  const byBrand    = data?.by_brand ?? []

  // Medians for scatter quadrant classification
  const medianStock = useMemo(() => {
    const sorted = [...items].map(i => i.current_stock).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 0
  }, [items])
  const medianSold = useMemo(() => {
    const sorted = [...items].map(i => i.units_sold_30d).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 0
  }, [items])

  // Filtered + sorted table items
  const filteredItems = useMemo(() => {
    let list = items
    if (activeCat)      list = list.filter(i => i.category === activeCat)
    if (activeStatus)   list = list.filter(i => i.stock_status === activeStatus)
    if (activeQuadrant !== 'all') {
      list = list.filter(i => classifyItem(i, medianStock, medianSold) === activeQuadrant)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i => i.item_name.toLowerCase().includes(q) || i.brand_name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortDir === 'desc' ? -diff : diff
    })
  }, [items, activeCat, activeStatus, activeQuadrant, search, sortKey, sortDir, medianStock, medianSold])

  // Scatter data — colour by quadrant
  const scatterData = useMemo(() => items.map(i => ({
    ...i,
    quadrant: classifyItem(i, medianStock, medianSold),
  })), [items, medianStock, medianSold])

  const QUADRANT_COLORS: Record<Quadrant, string> = {
    all:         'var(--theme-accent)',
    stars:       'var(--theme-success)',
    overstocked: 'var(--theme-warning)',
    at_risk:     'var(--theme-danger)',
    dead:        'var(--theme-ink-light)',
  }

  const donutData = summary ? [
    { name: 'In Stock',    value: summary.in_stock_count,    color: 'var(--theme-success)' },
    { name: 'Low Stock',   value: summary.low_stock_count,   color: 'var(--theme-warning)' },
    { name: 'Out of Stock',value: summary.out_of_stock_count,color: 'var(--theme-danger)'  },
  ] : []

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortTh = ({ label, k }: { label: string; k: typeof sortKey }) => (
    <th
      onClick={() => toggleSort(k)}
      className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest cursor-pointer hover:text-accent transition-colors select-none"
    >
      {label}{sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  const activeFilters = [
    activeCat    && { label: activeCat,                        clear: () => setActiveCat(null) },
    activeStatus && { label: activeStatus.replace('_', ' '),   clear: () => setActiveStatus(null) },
    activeQuadrant !== 'all' && { label: activeQuadrant.replace('_', ' '), clear: () => setActiveQuadrant('all') },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-light animate-pulse">Loading inventory data…</p>
    </div>
  )

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Breadcrumb + header */}
      <header className="border-b border-line pb-6">
        <button onClick={() => navigate('/analytics')} className="flex items-center gap-1.5 text-ink-light hover:text-accent font-mono text-xs uppercase tracking-widest mb-3 transition-colors brutal-focus">
          <ArrowLeft className="w-3.5 h-3.5" /> Analytics
        </button>
        <h1 className="type-display">Stock Intelligence</h1>
        <p className="text-ink-light font-mono text-sm mt-2">Inventory valuation, stock health, and fast/slow movers.</p>
        <div className="w-12 h-0.5 bg-accent mt-4" />
      </header>

      {/* ── Summary tiles ────────────────────────────────────────────────────── */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Total Value at Cost',  value: formatCurrencyCompact(summary.total_value_at_cost),  sub: `${formatCurrencyCompact(summary.total_value_at_retail)} at retail`, color: 'text-ink', border: '' },
            { label: 'Items In Stock',       value: summary.in_stock_count,   sub: `of ${summary.total_items} total`,   color: 'text-success', border: 'border-success/40' },
            { label: 'Low Stock',            value: summary.low_stock_count,  sub: 'need restocking',                   color: 'text-warning', border: 'border-warning/40' },
            { label: 'Dead Stock',           value: summary.dead_stock_count, sub: 'no sales in 30 days',               color: 'text-danger',  border: 'border-danger/40' },
          ].map(t => (
            <div key={t.label} className={cn('p-5 brutal-border bg-surface', t.border && `border-2 ${t.border}`)}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">{t.label}</p>
              <p className={cn('font-display font-bold text-3xl mt-2', t.color)}>{t.value}</p>
              <p className="font-mono text-xs text-ink-light mt-1">{t.sub}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Charts row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Category / Brand bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-2 brutal-border bg-surface p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-lg uppercase">Value by Brand</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mt-0.5">Click a bar to filter the table</p>
            </div>
            {activeCat && (
              <button onClick={() => setActiveCat(null)} className="text-xs font-mono text-accent hover:underline">Clear filter</button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byBrand.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-line-subtle)" />
              <XAxis type="number" tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="brand_name" width={120} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false} />
              <RTooltip
                content={<BrandTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Bar
                dataKey="value_at_cost"
                radius={[0, 2, 2, 0]}
                maxBarSize={18}
                animationDuration={1200}
                cursor="pointer"
                onClick={(d: any) => setActiveCat(prev => prev === d.brand_name ? null : d.brand_name)}
              >
                {byBrand.slice(0, 12).map((entry: any) => (
                  <Cell
                    key={entry.brand_name}
                    fill="var(--theme-accent)"
                    opacity={!activeCat || activeCat === entry.brand_name ? 0.85 : 0.25}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Stock status donut */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="brutal-border bg-surface p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg uppercase">Stock Status</h3>
            {activeStatus && (
              <button onClick={() => setActiveStatus(null)} className="text-xs font-mono text-accent hover:underline">Clear</button>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] py-3">
            {summary && (
              <WaffleChart
                inStock={summary.in_stock_count}
                lowStock={summary.low_stock_count}
                outOfStock={summary.out_of_stock_count}
                activeStatus={activeStatus}
                onStatusClick={setActiveStatus}
              />
            )}
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light mt-3">
              {summary?.total_items ?? 0} items · click to filter
            </p>
          </div>
          <div className="space-y-2 mt-2">
            {donutData.map(d => (
              <div
                key={d.name}
                onClick={() => {
                  const key = d.name.toLowerCase().replace(' ', '_')
                  setActiveStatus(prev => prev === key ? null : key)
                }}
                className="flex items-center justify-between text-sm font-mono border-b border-line pb-2 last:border-0 cursor-pointer hover:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5" style={{ backgroundColor: d.color }} />
                  <span className="text-xs uppercase tracking-wider">{d.name}</span>
                </div>
                <span className="font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Scatter plot ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="brutal-border bg-surface p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="font-display font-bold text-lg uppercase">Fast Movers vs Slow Movers</h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mt-0.5">
              X = units sold (30d) · Y = stock level · Click a dot for detail · Click a quadrant label to filter
            </p>
          </div>
          {/* Quadrant filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'stars', 'overstocked', 'at_risk', 'dead'] as Quadrant[]).map(q => (
              <button
                key={q}
                onClick={() => setActiveQuadrant(q)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest border brutal-focus transition-colors',
                  activeQuadrant === q
                    ? 'bg-ink text-surface border-ink'
                    : 'border-line text-ink-light hover:border-accent hover:text-accent',
                )}
              >
                {q === 'at_risk' ? 'At Risk' : q === 'all' ? 'All' : q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Quadrant background labels */}
        <div className="relative">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-10" style={{ top: 10, bottom: 10, left: 45, right: 10 }}>
            {[
              { label: 'OVERSTOCKED', color: 'text-warning',   q: 'overstocked' as Quadrant },
              { label: 'STARS ★',     color: 'text-success',   q: 'stars'       as Quadrant },
              { label: 'DEAD WEIGHT', color: 'text-ink-light', q: 'dead'        as Quadrant },
              { label: 'AT RISK ⚠',   color: 'text-danger',    q: 'at_risk'     as Quadrant },
            ].map(({ label, color, q }) => (
              <div key={label} className="flex items-center justify-center">
                <span
                  className={cn('text-[9px] font-mono uppercase tracking-widest hover:opacity-100 transition-opacity', color)}
                  style={{ opacity: 0.55, cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={() => setActiveQuadrant(q)}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          {/* Crosshair at median */}
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-line-subtle)" opacity={0.5} />
              <XAxis
                type="number" dataKey="units_sold_30d" name="Units Sold (30d)"
                tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false}
              />
              <YAxis
                type="number" dataKey="current_stock" name="Stock Level"
                tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false}
              />
              <ZAxis type="number" dataKey="value_at_cost" range={[60, 500]} />
              <RTooltip
                content={<ScatterTooltip />}
                cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Scatter
                data={scatterData}
                animationDuration={1000}
                onClick={(d: any) => setSelectedItem(d as InventoryItem)}
                style={{ cursor: 'pointer' }}
              >
                {scatterData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={QUADRANT_COLORS[d.quadrant]}
                    opacity={activeQuadrant === 'all' || activeQuadrant === d.quadrant ? 0.75 : 0.15}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Active filters strip ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Filtering by:</span>
            {activeFilters.map(f => (
              <button
                key={f.label}
                onClick={f.clear}
                className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 border border-accent text-accent font-mono text-[10px] uppercase tracking-wider hover:bg-danger/10 hover:border-danger hover:text-danger transition-colors brutal-focus"
              >
                {f.label} <X className="w-3 h-3" />
              </button>
            ))}
            <button
              onClick={() => { setActiveCat(null); setActiveStatus(null); setActiveQuadrant('all') }}
              className="font-mono text-[10px] uppercase tracking-wider text-ink-light hover:text-danger transition-colors"
            >
              Clear all
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stock Statement table ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="brutal-border bg-surface overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-line bg-ink text-surface">
          <div>
            <h3 className="font-display font-bold text-lg uppercase">Stock Statement</h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface/50 mt-0.5">
              {filteredItems.length} items
            </p>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="px-3 py-2 bg-surface/10 border border-surface/20 text-surface placeholder:text-surface/40 font-mono text-sm focus:outline-none focus:border-accent transition-colors w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-line text-ink-light">
                <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Item</th>
                <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Brand / Cat</th>
                <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Status</th>
                <SortTh label="Stock" k="current_stock" />
                <SortTh label="Sold 30d" k="units_sold_30d" />
                <SortTh label="Value" k="value_at_cost" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center font-mono text-xs uppercase tracking-widest text-ink-light">No items match current filters</td></tr>
              ) : filteredItems.map(item => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="hover:bg-ink hover:text-surface transition-colors cursor-pointer group"
                  style={{ borderLeft: `3px solid ${WAFFLE_COLORS[item.stock_status as StockStatus] ?? 'transparent'}` }}
                >
                  <td className="px-3 py-3 font-medium text-sm">{item.item_name}</td>
                  <td className="px-3 py-3">
                    <div className="text-sm">{item.brand_name}</div>
                    <div className="text-[10px] font-mono text-ink-light group-hover:text-surface/60 uppercase">{item.category}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      'px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest border',
                      item.stock_status === 'in_stock'     && 'border-success text-success',
                      item.stock_status === 'low_stock'    && 'border-warning text-warning',
                      item.stock_status === 'out_of_stock' && 'bg-danger text-on-status border-danger',
                    )}>
                      {item.stock_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm">{item.current_stock} <span className="text-ink-light group-hover:text-surface/60 text-xs">{item.unit}</span></td>
                  <td className="px-3 py-3 text-right font-mono text-sm">{item.units_sold_30d}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-sm">{formatCurrency(item.value_at_cost)}</td>
                </tr>
              ))}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot className="border-t-2 border-line bg-paper">
                <tr>
                  <td colSpan={5} className="px-3 py-3 font-mono text-xs uppercase tracking-widest text-ink-light text-right">Total ({filteredItems.length} items)</td>
                  <td className="px-3 py-3 text-right font-mono font-bold">{formatCurrency(filteredItems.reduce((s, i) => s + i.value_at_cost, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </motion.div>

      {/* Item detail modal */}
      <AnimatePresence>
        {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
    </div>
  )
}
