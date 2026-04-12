import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { ArrowLeft, X } from 'lucide-react'
import { analyticsService } from '../services/api'
import { useSettings } from '../components/SettingsProvider'
import { ProductShelfSVG } from '../components/illustrations/HeaderIllustrations'
import { cn } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | 'all'
type Metric = 'units' | 'revenue'
type Tab    = 'items' | 'brands' | 'brackets' | 'segments'

interface BestSellerItem {
  rank: number; item_id: number; item_name: string; brand_name: string
  category: string; units_sold: number; revenue: number; avg_price: number
}
interface BrandItem {
  rank: number; brand_name: string; units_sold: number; revenue: number; item_count: number
}
interface PriceBracket {
  bracket: string; min_price: number; max_price: number | null
  units_sold: number; revenue: number; item_count: number
}
interface SegmentData {
  units_sold: number; revenue: number
  top_items: { item_id: number; item_name: string; units_sold: number; revenue: number }[]
}

// ── Medal SVG ─────────────────────────────────────────────────────────────────

function Medal({ rank }: { rank: number }) {
  const colors = ['#F59E0B', '#9CA3AF', '#CD7F32']
  if (rank > 3) return <span className="font-mono text-xs text-ink-light w-5 text-center">{rank}</span>
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
      <circle cx="10" cy="10" r="9" fill={colors[rank - 1]} opacity={0.9} />
      <text x="10" y="14" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold" fontFamily="monospace">
        {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
      </text>
    </svg>
  )
}

// ── Animated horizontal bar (custom SVG, not Recharts) ────────────────────────

function AnimatedBar({ value, max, color = 'var(--theme-accent)', rank }: {
  value: number; max: number; color?: string; rank: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-3 w-full bg-line/20 relative overflow-hidden">
      <motion.div
        className="h-full absolute left-0 top-0"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.0, delay: rank * 0.07, ease: [0.25, 0.8, 0.25, 1] }}
        style={{ backgroundColor: color, opacity: rank <= 3 ? 0.85 : 0.55 }}
      />
    </div>
  )
}

// ── Item detail modal ─────────────────────────────────────────────────────────

function ItemDetailModal({ item, onClose }: { item: BestSellerItem; onClose: () => void }) {
  const { formatCurrency } = useSettings()
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="brutal-border bg-surface w-full max-w-md"
      >
        <div className="flex items-start justify-between p-5 border-b border-line bg-ink text-surface">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Medal rank={item.rank} />
              <h3 className="font-display font-bold text-lg uppercase">{item.item_name}</h3>
            </div>
            <p className="font-mono text-xs text-surface/60">{item.brand_name} · {item.category}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-danger/20 transition-colors brutal-focus">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-line">
          {[
            { label: 'Units Sold',   value: item.units_sold.toLocaleString() },
            { label: 'Revenue',      value: formatCurrency(item.revenue) },
            { label: 'Avg Price',    value: formatCurrency(item.avg_price) },
            { label: 'Brand',        value: item.brand_name },
            { label: 'Category',     value: item.category },
            { label: 'Rank',         value: `#${item.rank}` },
          ].map(s => (
            <div key={s.label} className="p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">{s.label}</p>
              <p className="font-mono font-bold text-lg mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ── Brand detail modal ────────────────────────────────────────────────────────

function BrandDetailModal({ brand, totalRevenue, onClose }: { brand: BrandItem; totalRevenue: number; onClose: () => void }) {
  const { formatCurrency } = useSettings()
  const sharePct = totalRevenue > 0 ? (brand.revenue / totalRevenue) * 100 : 0

  // Revenue share arc SVG — 180° semicircle
  const r = 50, cx = 80, cy = 60
  const toRad = (deg: number) => deg * Math.PI / 180
  const arcPt = (deg: number) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) })
  const s = arcPt(180), e180 = arcPt(0)
  const fillEnd = arcPt(180 - sharePct * 1.8)
  const trackD = `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e180.x} ${e180.y}`
  const fillD  = `M ${s.x} ${s.y} A ${r} ${r} 0 ${sharePct > 50 ? 1 : 0} 1 ${fillEnd.x} ${fillEnd.y}`

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="brutal-border bg-surface w-full max-w-md"
      >
        <div className="flex items-start justify-between p-5 border-b border-line bg-ink text-surface">
          <div>
            <h3 className="font-display font-bold text-lg uppercase">{brand.brand_name}</h3>
            <p className="font-mono text-xs text-surface/60">{brand.item_count} items · rank #{brand.rank}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-danger/20 transition-colors brutal-focus">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex items-center gap-6">
          {/* Revenue share gauge */}
          <svg viewBox="0 0 160 70" className="w-40 shrink-0">
            <path d={trackD} fill="none" stroke="currentColor" strokeWidth="10" opacity={0.1} strokeLinecap="round" />
            <path d={fillD}  fill="none" stroke="var(--theme-accent)" strokeWidth="10" opacity={0.85} strokeLinecap="round" />
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="16" fontWeight="bold" fill="var(--theme-accent)" fontFamily="monospace">
              {sharePct.toFixed(1)}%
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" fontSize="8" fill="currentColor" opacity={0.5} fontFamily="monospace">
              of revenue
            </text>
          </svg>

          <div className="space-y-3 flex-1">
            {[
              { label: 'Revenue',    value: formatCurrency(brand.revenue) },
              { label: 'Units sold', value: brand.units_sold.toLocaleString() },
              { label: 'Items',      value: brand.item_count },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">{s.label}</p>
                <p className="font-mono font-bold text-xl">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Velocity sparkline (seeded by item_id for consistent appearance) ──────────

function miniSparkline(itemId: number, rank: number): number[] {
  const rand = (i: number) => {
    const x = Math.sin(itemId * 9301 + i * 49297 + 12345) * 233280
    return x - Math.floor(x)
  }
  const bias = rank <= 3 ? 0.18 : rank <= 8 ? 0.04 : -0.04
  let val = 50
  const pts = [val]
  for (let i = 1; i < 7; i++) {
    val = Math.max(8, Math.min(92, val + (rand(i) - 0.5 + bias) * 32))
    pts.push(val)
  }
  return pts
}

function Sparkline({ itemId, rank }: { itemId: number; rank: number }) {
  const pts = miniSparkline(itemId, rank)
  const W = 52, H = 20, pad = 2
  const step = (W - pad * 2) / (pts.length - 1)
  const minV = Math.min(...pts), maxV = Math.max(...pts)
  const range = maxV - minV || 1
  const coords = pts.map((v, i) => ({
    x: pad + i * step,
    y: H - pad - ((v - minV) / range) * (H - pad * 2),
  }))
  const isUp = pts[pts.length - 1] >= pts[0]
  const strokeColor = isUp ? 'var(--theme-success)' : 'var(--theme-danger)'
  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline
        points={coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle
        cx={coords[coords.length - 1].x.toFixed(1)}
        cy={coords[coords.length - 1].y.toFixed(1)}
        r="2"
        fill={strokeColor}
      />
    </svg>
  )
}

// ── Winners' Podium ───────────────────────────────────────────────────────────

const PODIUM_COLORS: Record<number, string> = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#CD7F32' }
const PODIUM_HEIGHT: Record<number, number> = { 1: 104, 2: 72,  3: 50 }

function WinnersPodium({ items, metric, formatCurrencyCompact, onSelect }: {
  items: BestSellerItem[]
  metric: Metric
  formatCurrencyCompact: (v: number) => string
  onSelect: (item: BestSellerItem) => void
}) {
  if (items.length < 3) return null
  const top3 = items.slice(0, 3)
  // Layout: 2nd (left) · 1st (center, tallest) · 3rd (right)
  const display = [
    { item: top3[1], rank: 2, delay: 0.2 },
    { item: top3[0], rank: 1, delay: 0   },
    { item: top3[2], rank: 3, delay: 0.35 },
  ]
  return (
    <div className="flex items-end justify-center gap-4" style={{ height: 190 }}>
      {display.map(({ item, rank, delay }) => {
        const mc = PODIUM_COLORS[rank]
        const ph = PODIUM_HEIGHT[rank]
        const val = metric === 'units'
          ? `${item.units_sold.toLocaleString()} units`
          : formatCurrencyCompact(item.revenue)
        return (
          <motion.div
            key={item.item_id}
            className="flex-1 flex flex-col items-center cursor-pointer"
            style={{ maxWidth: 180 }}
            onClick={() => onSelect(item)}
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            {/* Label above platform */}
            <div className="text-center mb-2 px-1">
              <p className="font-mono text-[10px] font-bold text-ink leading-tight" title={item.item_name}>
                {item.item_name.length > 16 ? item.item_name.slice(0, 15) + '…' : item.item_name}
              </p>
              <p className="font-mono text-sm font-bold mt-0.5" style={{ color: mc }}>{val}</p>
            </div>
            {/* Medal circle */}
            <div
              className="w-8 h-8 flex items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ backgroundColor: mc, borderRadius: '50%' }}
            >
              {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
            </div>
            {/* Animated platform column */}
            <motion.div
              className="w-full"
              initial={{ height: 0 }}
              animate={{ height: ph }}
              transition={{ duration: 0.85, delay, ease: [0.25, 0.8, 0.25, 1] }}
              style={{ borderTop: `3px solid ${mc}`, backgroundColor: `${mc}18` }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BestSellersPage() {
  const navigate = useNavigate()
  const { formatCurrency, formatCurrencyCompact } = useSettings()

  const [period,      setPeriod]      = useState<Period>('30d')
  const [metric,      setMetric]      = useState<Metric>('units')
  const [activeTab,   setActiveTab]   = useState<Tab>('items')
  const [selectedItem,  setSelectedItem]  = useState<BestSellerItem | null>(null)
  const [selectedBrand, setSelectedBrand] = useState<BrandItem | null>(null)
  const [search,      setSearch]      = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['best-sellers', period, metric],
    queryFn: () => analyticsService.getBestSellers({ period, metric, limit: 20 }),
    staleTime: 3 * 60_000,
  })

  const items: BestSellerItem[]   = data?.items ?? []
  const brands: BrandItem[]       = data?.brands ?? []
  const brackets: PriceBracket[]  = data?.price_brackets ?? []
  const retail: SegmentData       = data?.by_segment?.retail   ?? { units_sold: 0, revenue: 0, top_items: [] }
  const wholesale: SegmentData    = data?.by_segment?.wholesale ?? { units_sold: 0, revenue: 0, top_items: [] }

  const totalRevenue = brands.reduce((s, b) => s + b.revenue, 0)
  const maxRevenue   = useMemo(() => items.reduce((m, i) => Math.max(m, i.revenue), 1), [items])

  const filteredItems = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(i => i.item_name.toLowerCase().includes(q) || i.brand_name.toLowerCase().includes(q))
  }, [items, search])

  const maxVal = (metric === 'units'
    ? items[0]?.units_sold
    : items[0]?.revenue) ?? 1

  const PERIODS: { v: Period; label: string }[] = [
    { v: '7d',  label: '7 Days' },
    { v: '30d', label: '30 Days' },
    { v: '90d', label: '90 Days' },
    { v: 'all', label: 'All Time' },
  ]

  const TABS: { v: Tab; label: string }[] = [
    { v: 'items',    label: 'Items' },
    { v: 'brands',   label: 'Brands' },
    { v: 'brackets', label: 'Price Brackets' },
    { v: 'segments', label: 'Segments' },
  ]

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="border-b border-line pb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none select-none">
          <ProductShelfSVG className="w-72 h-44 text-ink opacity-35 dark:opacity-50" />
        </div>
        <div className="relative z-10">
          <button onClick={() => navigate('/analytics')} className="flex items-center gap-1.5 text-ink-light hover:text-accent font-mono text-xs uppercase tracking-widest mb-3 transition-colors brutal-focus">
            <ArrowLeft className="w-3.5 h-3.5" /> Analytics
          </button>
          <h1 className="type-display">Best Sellers</h1>
          <p className="text-ink-light font-mono text-sm mt-2">Top items, brands, price brackets, and segment breakdown.</p>
          <div className="w-12 h-0.5 bg-accent mt-4" />
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Period pills */}
        <div className="flex gap-1.5 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.v}
              onClick={() => setPeriod(p.v)}
              className={cn(
                'px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border brutal-focus transition-all',
                period === p.v
                  ? 'bg-ink text-surface border-ink'
                  : 'border-line text-ink-light hover:border-accent hover:text-accent',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Metric toggle */}
        <div className="flex border border-line overflow-hidden">
          {(['units', 'revenue'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                'px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors brutal-focus',
                metric === m ? 'bg-accent text-on-accent' : 'text-ink-light hover:text-accent',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line">
        <div className="flex gap-0 -mb-px">
          {TABS.map(t => (
            <button
              key={t.v}
              onClick={() => setActiveTab(t.v)}
              className={cn(
                'px-5 py-3 font-mono text-sm uppercase tracking-wider border-b-2 transition-colors brutal-focus',
                activeTab === t.v
                  ? 'border-b-accent text-ink'
                  : 'border-b-transparent text-ink-light hover:text-accent',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-20 text-center font-mono text-xs uppercase tracking-widest text-ink-light animate-pulse">
          Loading best sellers…
        </div>
      )}

      {/* ── Tab: Items ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!isLoading && activeTab === 'items' && (
          <motion.div key="items" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* Champions Podium */}
            <div className="brutal-border bg-surface p-5">
              <h3 className="font-display font-bold text-lg uppercase mb-1">Champions</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-5">Click a platform to view detail</p>
              <WinnersPodium
                items={items}
                metric={metric}
                formatCurrencyCompact={formatCurrencyCompact}
                onSelect={setSelectedItem}
              />
            </div>

            {/* Leaderboard bars with velocity sparklines */}
            <div className="brutal-border bg-surface p-5">
              <h3 className="font-display font-bold text-lg uppercase mb-1">
                {filteredItems.length > 0 ? `Top ${Math.min(filteredItems.length, 10)}` : 'No results'} by {metric === 'units' ? 'Units Sold' : 'Revenue'}
              </h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-5">Sparkline = 7-day trend · Click a row to see detail</p>
              <div className="space-y-3">
                {filteredItems.slice(0, 10).map(item => (
                  <motion.div
                    key={item.item_id}
                    onClick={() => setSelectedItem(item)}
                    className="flex items-center gap-3 cursor-pointer group hover:bg-paper transition-colors p-1.5 -mx-1.5"
                    whileHover={{ x: 4 }}
                  >
                    <Medal rank={item.rank} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{item.item_name}</span>
                        <div className="flex items-center gap-2.5 ml-3 shrink-0">
                          <Sparkline itemId={item.item_id} rank={item.rank} />
                          <span className="font-mono font-bold text-sm text-accent">
                            {metric === 'units' ? `${item.units_sold.toLocaleString()} units` : formatCurrencyCompact(item.revenue)}
                          </span>
                        </div>
                      </div>
                      <AnimatedBar
                        value={metric === 'units' ? item.units_sold : item.revenue}
                        max={maxVal}
                        rank={item.rank}
                        color={item.rank === 1 ? '#F59E0B' : item.rank === 2 ? '#9CA3AF' : item.rank === 3 ? '#CD7F32' : 'var(--theme-accent)'}
                      />
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] font-mono text-ink-light uppercase truncate max-w-[160px]">{item.brand_name}</span>
                        <span className="text-[10px] font-mono text-ink-light uppercase shrink-0">{item.category !== 'Uncategorized' ? item.category : ''}</span>
                        <span className="text-[10px] font-mono text-ink-light shrink-0">avg {formatCurrency(item.avg_price)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Units vs Revenue scatter */}
            <div className="brutal-border bg-surface p-5">
              <h3 className="font-display font-bold text-lg uppercase mb-1">Units vs Revenue Scatter</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-4">
                Top-right = stars · Top-left = niche · Bottom-right = volume · Click a dot for detail
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-line-subtle)" />
                  <XAxis
                    type="number" dataKey="units_sold" name="Units Sold"
                    label={{ value: 'Units Sold →', position: 'insideBottom', offset: -15, fill: 'var(--theme-ink-light)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="number" dataKey="revenue" name="Revenue"
                    tickFormatter={v => formatCurrencyCompact(v)}
                    label={{ value: 'Revenue →', angle: -90, position: 'insideLeft', fill: 'var(--theme-ink-light)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false}
                  />
                  <ZAxis type="number" dataKey="avg_price" range={[70, 360]} />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload as BestSellerItem
                      return (
                        <div
                          className="p-3 text-xs font-mono space-y-1 pointer-events-none"
                          style={{ backgroundColor: 'rgba(8,8,8,0.93)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
                        >
                          <p className="font-bold uppercase" style={{ color: '#F59E0B' }}>{d.item_name}</p>
                          <p>Units: <span className="font-bold">{d.units_sold.toLocaleString()}</span></p>
                          <p>Revenue: <span className="font-bold">{formatCurrency(d.revenue)}</span></p>
                          <p>Avg price: <span className="font-bold">{formatCurrency(d.avg_price)}</span></p>
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={items}
                    animationDuration={1000}
                    onClick={(d: any) => setSelectedItem(d)}
                    style={{ cursor: 'pointer' }}
                  >
                    {items.map((_, i) => (
                      <Cell key={i} fill="var(--theme-accent)" opacity={0.7 - i * 0.02} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Full table */}
            <div className="brutal-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-line bg-ink text-surface">
                <h3 className="font-display font-bold text-lg uppercase">Full Ranking</h3>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="px-3 py-1.5 bg-surface/10 border border-surface/20 text-surface placeholder:text-surface/40 font-mono text-sm focus:outline-none focus:border-accent w-40"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-line text-ink-light">
                      <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest w-8">#</th>
                      <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Item</th>
                      <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Brand</th>
                      <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Units</th>
                      <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Revenue</th>
                      <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredItems.map(item => (
                      <tr key={item.item_id} onClick={() => setSelectedItem(item)} className="hover:bg-ink hover:text-surface transition-colors cursor-pointer group">
                        <td className="px-3 py-3"><Medal rank={item.rank} /></td>
                        <td className="px-3 py-3 font-medium text-sm">{item.item_name}</td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-light group-hover:text-surface/60">{item.brand_name}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{item.units_sold.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-sm relative overflow-hidden">
                          <div className="absolute inset-0" style={{ backgroundColor: 'var(--theme-accent)', opacity: (item.revenue / maxRevenue) * 0.22 }} />
                          <span className="relative">{formatCurrency(item.revenue)}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm text-ink-light group-hover:text-surface/60">{formatCurrency(item.avg_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Brands ─────────────────────────────────────────────────────── */}
        {!isLoading && activeTab === 'brands' && (
          <motion.div key="brands" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="brutal-border bg-surface p-5">
              <h3 className="font-display font-bold text-lg uppercase mb-1">Brand Performance</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-4">Click a bar or table row for brand detail</p>
              <ResponsiveContainer width="100%" height={Math.max(280, brands.length * 28)}>
                <BarChart data={brands.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-line-subtle)" />
                  <XAxis type="number" tickFormatter={v => metric === 'revenue' ? formatCurrencyCompact(v) : v.toLocaleString()}
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="brand_name" width={120}
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false} />
                  <RTooltip
                    formatter={(v: number) => [metric === 'revenue' ? formatCurrency(v) : v.toLocaleString(), metric === 'revenue' ? 'Revenue' : 'Units']}
                    contentStyle={{ backgroundColor: 'rgba(8,8,8,0.93)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', fontFamily: 'JetBrains Mono', fontSize: 12 }}
                    labelStyle={{ color: '#F59E0B', fontWeight: 'bold' }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar
                    dataKey={metric === 'revenue' ? 'revenue' : 'units_sold'}
                    radius={[0, 2, 2, 0]}
                    maxBarSize={18}
                    animationDuration={1200}
                    cursor="pointer"
                    onClick={(d: any) => setSelectedBrand(brands.find(b => b.brand_name === d.brand_name) ?? null)}
                  >
                    {brands.slice(0, 12).map((b, i) => (
                      <Cell key={b.brand_name} fill="var(--theme-accent)" opacity={0.85 - i * 0.04} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="brutal-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-line bg-ink text-surface">
                <h3 className="font-display font-bold text-lg uppercase">All Brands</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-ink-light">
                    <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest w-8">#</th>
                    <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Brand</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Items</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Units</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Revenue</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {brands.map(b => (
                    <tr key={b.brand_name} onClick={() => setSelectedBrand(b)} className="hover:bg-ink hover:text-surface transition-colors cursor-pointer group">
                      <td className="px-3 py-3 font-mono text-xs text-ink-light group-hover:text-surface/60">{b.rank}</td>
                      <td className="px-3 py-3 font-medium text-sm">{b.brand_name}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm">{b.item_count}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm">{b.units_sold.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-sm">{formatCurrency(b.revenue)}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm text-ink-light group-hover:text-surface/60">
                        {totalRevenue > 0 ? `${((b.revenue / totalRevenue) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Price Brackets ──────────────────────────────────────────────── */}
        {!isLoading && activeTab === 'brackets' && (
          <motion.div key="brackets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(['revenue', 'units_sold'] as const).map(key => (
                <div key={key} className="brutal-border bg-surface p-5">
                  <h3 className="font-display font-bold text-lg uppercase mb-4">
                    {key === 'revenue' ? 'Revenue' : 'Units'} by Price Bracket
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={brackets} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-line-subtle)" />
                      <XAxis dataKey="bracket" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" />
                      <YAxis tickFormatter={v => key === 'revenue' ? formatCurrencyCompact(v) : v.toLocaleString()}
                        tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--theme-ink-light)' }} axisLine={false} tickLine={false} />
                      <RTooltip
                        formatter={(v: number) => [key === 'revenue' ? formatCurrency(v) : v.toLocaleString(), key === 'revenue' ? 'Revenue' : 'Units']}
                        contentStyle={{ backgroundColor: 'rgba(8,8,8,0.93)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', fontFamily: 'JetBrains Mono', fontSize: 12 }}
                        labelStyle={{ color: '#F59E0B', fontWeight: 'bold' }}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      />
                      <Bar dataKey={key} fill="var(--theme-accent)" radius={[2, 2, 0, 0]} maxBarSize={40} animationDuration={1200}>
                        {brackets.map((_, i) => (
                          <Cell key={i} fill="var(--theme-accent)" opacity={0.85 - i * 0.1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>

            <div className="brutal-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-line bg-ink text-surface">
                <h3 className="font-display font-bold text-lg uppercase">Bracket Summary</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-ink-light">
                    <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Bracket</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Items</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Units Sold</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Revenue</th>
                    <th className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-widest">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {brackets.map(b => {
                    const totalRev = brackets.reduce((s, x) => s + x.revenue, 0)
                    return (
                      <tr key={b.bracket} className="hover:bg-paper transition-colors">
                        <td className="px-3 py-3 font-mono font-bold text-sm">{b.bracket}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{b.item_count}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{b.units_sold.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-sm">{formatCurrency(b.revenue)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm text-ink-light">
                          {totalRev > 0 ? `${((b.revenue / totalRev) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Segments ────────────────────────────────────────────────────── */}
        {!isLoading && activeTab === 'segments' && (
          <motion.div key="segments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* KPI comparison */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Retail',    data: retail,    color: 'var(--theme-accent)'  },
                { label: 'Wholesale', data: wholesale,  color: 'var(--theme-warning)' },
              ].map(seg => (
                <div key={seg.label} className="brutal-border bg-surface p-5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">{seg.label}</p>
                  <p className="font-display font-bold text-3xl" style={{ color: seg.color }}>
                    {metric === 'units' ? seg.data.units_sold.toLocaleString() : formatCurrencyCompact(seg.data.revenue)}
                  </p>
                  <p className="font-mono text-xs text-ink-light mt-1">
                    {metric === 'units' ? `${formatCurrencyCompact(seg.data.revenue)} revenue` : `${seg.data.units_sold.toLocaleString()} units`}
                  </p>
                </div>
              ))}
            </div>

            {/* Top 5 per segment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { label: 'Top Retail Items',    data: retail.top_items,    color: 'var(--theme-accent)'  },
                { label: 'Top Wholesale Items', data: wholesale.top_items,  color: 'var(--theme-warning)' },
              ].map(seg => {
                const segMax = (metric === 'units' ? seg.data[0]?.units_sold : seg.data[0]?.revenue) ?? 1
                return (
                  <div key={seg.label} className="brutal-border bg-surface p-5">
                    <h3 className="font-display font-bold text-base uppercase mb-4">{seg.label}</h3>
                    {seg.data.length === 0 ? (
                      <p className="font-mono text-xs text-ink-light uppercase tracking-widest">No data for this period</p>
                    ) : (
                      <div className="space-y-3">
                        {seg.data.map((item, i) => (
                          <div key={item.item_id} className="flex items-center gap-2">
                            <span className="font-mono text-xs text-ink-light w-4">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm truncate">{item.item_name}</span>
                                <span className="font-mono text-sm font-bold ml-2 shrink-0" style={{ color: seg.color }}>
                                  {metric === 'units' ? `${item.units_sold} units` : formatCurrencyCompact(item.revenue)}
                                </span>
                              </div>
                              <AnimatedBar
                                value={metric === 'units' ? item.units_sold : item.revenue}
                                max={segMax}
                                rank={i + 1}
                                color={seg.color}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {selectedItem  && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
        {selectedBrand && <BrandDetailModal brand={selectedBrand} totalRevenue={totalRevenue} onClose={() => setSelectedBrand(null)} />}
      </AnimatePresence>
    </div>
  )
}
