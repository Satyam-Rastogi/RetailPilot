import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Lock } from 'lucide-react'
import { analyticsService, reportService } from '../services/api'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'

// ── Stagger variants ──────────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const fromLeft  = { hidden: { opacity: 0, x: -24 }, visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] } } }
const fromBelow = { hidden: { opacity: 0, y: 24  }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] } } }
const scaleUp   = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.8, 0.25, 1] } } }
const fadeIn    = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.45 } } }

// ── Vintage shop-counter SVG ──────────────────────────────────────────────────
// Line-art cash register with operator. Uses stroke-based drawing + fixed accent
// colours so it stays visible in dark mode regardless of currentColor.

function ShopCounterSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 160" className={className} aria-hidden fill="none">

      {/* ── Floor / counter surface ─── */}
      <rect x="0" y="118" width="320" height="9" rx="1"
        fill="currentColor" fillOpacity={0.08}
        stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.2} />
      {/* Front fascia */}
      <rect x="8" y="127" width="304" height="26" rx="1"
        fill="currentColor" fillOpacity={0.05}
        stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.12} />
      {/* Fascia panel lines */}
      {[134, 140, 146].map(y => (
        <line key={y} x1="30" y1={y} x2="290" y2={y}
          stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.08} />
      ))}

      {/* ── Cash register body ─── */}
      <rect x="110" y="50" width="100" height="70" rx="3"
        fill="currentColor" fillOpacity={0.08}
        stroke="currentColor" strokeWidth="1.5" strokeOpacity={0.3} />
      {/* Top curve highlight */}
      <rect x="110" y="50" width="100" height="5" rx="3"
        fill="currentColor" fillOpacity={0.06} />

      {/* Register display */}
      <rect x="116" y="57" width="88" height="24" rx="1.5"
        fill="#1e1e2e" fillOpacity={0.7}
        stroke="#6366F1" strokeWidth="1" strokeOpacity={0.5} />
      {/* Screen glow */}
      <rect x="118" y="59" width="84" height="20" rx="1"
        fill="#6366F1" fillOpacity={0.12} />
      {/* Display text */}
      <text x="160" y="68" textAnchor="middle" fontSize="6.5" fill="#818CF8"
        fontFamily="monospace" letterSpacing="0.5" opacity={0.8}>TOTAL AMOUNT</text>
      <text x="160" y="77" textAnchor="middle" fontSize="9" fill="#A5B4FC"
        fontFamily="monospace" fontWeight="bold" letterSpacing="1">₹ 2,840.00</text>

      {/* Key grid: 4 cols × 3 rows */}
      {[0, 1, 2, 3].map(col =>
        [0, 1, 2].map(row => {
          const isEnter = col === 3 && row === 2
          return (
            <rect
              key={`${col}-${row}`}
              x={118 + col * 21} y={86 + row * 10}
              width={isEnter ? 17 : 17} height={isEnter ? 8 : 8}
              rx="1.5"
              fill={isEnter ? '#10B981' : 'currentColor'}
              fillOpacity={isEnter ? 0.35 : 0.1}
              stroke={isEnter ? '#10B981' : 'currentColor'}
              strokeWidth="0.5"
              strokeOpacity={isEnter ? 0.6 : 0.18}
            />
          )
        })
      )}
      <text x="205" y="112" textAnchor="middle" fontSize="5" fill="#10B981"
        fontFamily="monospace" fontWeight="bold" opacity={0.8}>ENT</text>

      {/* Register feet */}
      <rect x="122" y="118" width="20" height="4" rx="0.5"
        fill="currentColor" fillOpacity={0.14} />
      <rect x="178" y="118" width="20" height="4" rx="0.5"
        fill="currentColor" fillOpacity={0.14} />

      {/* Receipt slot */}
      <rect x="143" y="49" width="34" height="3" rx="0.5"
        fill="currentColor" fillOpacity={0.2}
        stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.25} />
      {/* Receipt paper */}
      <rect x="149" y="24" width="22" height="27" rx="0.5"
        fill="white" fillOpacity={0.06}
        stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.18} />
      {[28, 32, 36, 40, 44].map(y => (
        <line key={y} x1="152" y1={y} x2="169" y2={y}
          stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.14} />
      ))}
      {/* Receipt logo mark */}
      <rect x="154" y="26" width="12" height="3" rx="0.3"
        fill="#6366F1" fillOpacity={0.3} />
      {/* Paper curl at bottom */}
      <path d="M 149 51 Q 160 55 171 51"
        stroke="currentColor" strokeWidth="0.7" strokeOpacity={0.15} />

      {/* ── Operator silhouette ─── */}
      {/* Head */}
      <circle cx="62" cy="68" r="16"
        fill="currentColor" fillOpacity={0.1}
        stroke="currentColor" strokeWidth="1.2" strokeOpacity={0.22} />
      {/* Hair */}
      <path d="M 46 63 Q 62 50 78 63"
        fill="currentColor" fillOpacity={0.1}
        stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.15} />
      {/* Neck */}
      <rect x="57" y="83" width="10" height="10" rx="1"
        fill="currentColor" fillOpacity={0.08}
        stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.12} />
      {/* Shoulders/torso */}
      <path d="M 22 118 Q 25 90 62 86 Q 99 90 102 118"
        fill="currentColor" fillOpacity={0.08}
        stroke="currentColor" strokeWidth="1.2" strokeOpacity={0.18} />
      {/* Collar V */}
      <path d="M 54 86 L 62 98 L 70 86"
        stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.18} />
      {/* Left arm reaching toward register */}
      <path d="M 32 100 Q 60 95 105 90"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity={0.12} />
      <path d="M 32 100 Q 60 95 105 90"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity={0.2} />
      {/* Hand */}
      <circle cx="107" cy="89" r="5"
        fill="currentColor" fillOpacity={0.1}
        stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.18} />
      {/* Fingers */}
      {[-3, 0, 3].map((offset, i) => (
        <line key={i}
          x1={107 + offset * 0.5} y1="84"
          x2={107 + offset} y2="80"
          stroke="currentColor" strokeWidth="0.7" strokeOpacity={0.14} />
      ))}

      {/* ── Counter accessories ─── */}
      {/* Card terminal */}
      <rect x="238" y="100" width="26" height="18" rx="2"
        fill="currentColor" fillOpacity={0.09}
        stroke="currentColor" strokeWidth="1" strokeOpacity={0.2} />
      <rect x="240" y="102" width="22" height="10" rx="1"
        fill="currentColor" fillOpacity={0.07}
        stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.12} />
      {/* NFC symbol */}
      {[3, 5, 7].map((r, i) => (
        <path key={i}
          d={`M ${251 - r} ${107 + r * 0.5} Q 251 ${105} ${251 + r} ${107 + r * 0.5}`}
          stroke="#6366F1" strokeWidth="0.7" strokeOpacity={0.5 - i * 0.1} />
      ))}
      {/* Card slot */}
      <rect x="242" y="115" width="18" height="2" rx="0.5"
        fill="currentColor" fillOpacity={0.15} />

      {/* Coin stack */}
      {[0, 1, 2].map(i => (
        <ellipse key={i}
          cx="280" cy={116 - i * 2.5}
          rx="9" ry="3.5"
          fill={i === 2 ? '#F59E0B' : 'currentColor'}
          fillOpacity={i === 2 ? 0.35 : 0.08}
          stroke={i === 2 ? '#F59E0B' : 'currentColor'}
          strokeWidth="0.7"
          strokeOpacity={i === 2 ? 0.6 : 0.14}
        />
      ))}
      <text x="280" y="116" textAnchor="middle" fontSize="5"
        fill="#F59E0B" fontFamily="monospace" opacity={0.7}>₹</text>

      {/* Shopping bag leaning on counter */}
      <path d="M 290 105 L 288 118 L 302 118 L 300 105 Z"
        fill="currentColor" fillOpacity={0.07}
        stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.18} />
      <path d="M 292 105 Q 292 100 296 100 Q 300 100 300 105"
        stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.18} />
      <line x1="288" y1="110" x2="302" y2="110"
        stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.1} />
    </svg>
  )
}

// ── Card SVG illustrations ────────────────────────────────────────────────────

function BestSellersSVG({ items }: { items?: { item_name: string; units_sold: number }[] }) {
  const top3   = (items ?? []).slice(0, 3)
  const max    = top3[0]?.units_sold || 1
  const medals = ['#F59E0B', '#9CA3AF', '#CD7F32']
  const labels = ['1st', '2nd', '3rd']
  return (
    <svg viewBox="0 0 200 110" className="w-full h-full" aria-hidden>
      {top3.length === 0
        ? <text x="100" y="60" textAnchor="middle" fontSize="11" fill="currentColor" opacity={0.4} fontFamily="monospace">No data yet</text>
        : top3.map((item, i) => {
            const w = Math.round((item.units_sold / max) * 160)
            return (
              <g key={i}>
                <circle cx="12" cy={20 + i * 32} r="8" fill={medals[i]} opacity={0.9} />
                <text x="12" y={20 + i * 32 + 4} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">{labels[i]}</text>
                <rect x="26" y={13 + i * 32} width="165" height="14" fill="currentColor" opacity={0.07} rx="1" />
                <rect x="26" y={13 + i * 32} width={w} height="14"
                  fill={medals[i]} opacity={i === 0 ? 0.85 : 0.55} rx="1"
                  style={{ transition: 'width 1.2s cubic-bezier(0.25,0.8,0.25,1)' }} />
                <text x="30" y={23 + i * 32} fontSize="8" fill="currentColor" opacity={0.8} fontFamily="monospace">
                  {item.item_name.length > 20 ? item.item_name.slice(0, 19) + '…' : item.item_name}
                </text>
                <text x="195" y={23 + i * 32} fontSize="8" textAnchor="end" fill="currentColor" opacity={0.6} fontFamily="monospace">
                  {item.units_sold}u
                </text>
              </g>
            )
          })
      }
    </svg>
  )
}

function StockHealthBarsSVG({ invData }: { invData: any }) {
  const s = invData?.summary ?? {}
  const bars = [
    { label: 'IN STOCK',  count: s.in_stock_count   ?? 0, color: '#10B981' },
    { label: 'LOW STOCK', count: s.low_stock_count  ?? 0, color: '#F59E0B' },
    { label: 'OUT',       count: s.out_of_stock_count ?? 0, color: '#EF4444' },
  ]
  const max = Math.max(...bars.map(b => b.count), 1)
  return (
    <svg viewBox="0 0 200 90" className="w-full h-full" aria-hidden>
      {bars.map((b, i) => {
        const w = Math.max(Math.round((b.count / max) * 130), b.count > 0 ? 2 : 0)
        const y = 10 + i * 28
        return (
          <g key={b.label}>
            <text x="0" y={y + 11} fontSize="8" fill="currentColor" opacity={0.5} fontFamily="monospace">{b.label}</text>
            <rect x="58" y={y} width="130" height="14" fill="currentColor" opacity={0.07} rx="1" />
            <rect x="58" y={y} width={w} height="14" fill={b.color} opacity={0.82} rx="1"
              style={{ transition: 'width 1s cubic-bezier(0.25,0.8,0.25,1)' }} />
            <text x="194" y={y + 11} fontSize="9" fill={b.color} opacity={0.9} textAnchor="end" fontFamily="monospace" fontWeight="bold">
              {b.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Self-drawing revenue area chart
function RevenueMiniSVG({ months, wide }: { months?: { total: number }[]; wide?: boolean }) {
  const lineRef = useRef<SVGPolylineElement>(null)
  const [lineLen, setLineLen] = useState(0)
  const [drawn, setDrawn]     = useState(false)

  useEffect(() => {
    setDrawn(false)
    if (!lineRef.current) return
    const l = lineRef.current.getTotalLength()
    setLineLen(l)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(id)
  }, [months])

  if (!months || months.length === 0) return null

  const vals = months.slice(-12).map(m => m.total)
  const max  = Math.max(...vals, 1)
  // Wide hero: viewBox 400×120 for a landscape chart
  const W = wide ? 400 : 200
  const H = wide ? 120 : 80
  const pad = 8
  const step = (W - pad * 2) / Math.max(vals.length - 1, 1)
  const pts  = vals.map((v, i) => `${pad + i * step},${H - pad - (v / max) * (H - pad * 2)}`)
  const area = `M ${pts[0]} ${pts.slice(1).map(p => `L ${p}`).join(' ')} L ${pad + (vals.length - 1) * step},${H} L ${pad},${H} Z`
  const lastX = pad + (vals.length - 1) * step
  const lastY = H - pad - (vals[vals.length - 1] / max) * (H - pad * 2)

  // Month labels (show every 3rd)
  const monthLabels = months.slice(-12)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor="var(--theme-accent)" stopOpacity="0.45" />
          <stop offset="95%" stopColor="var(--theme-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rg)"
        style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.7s 0.8s' }} />
      <polyline
        ref={lineRef}
        points={pts.join(' ')}
        fill="none"
        stroke="var(--theme-accent)"
        strokeWidth={wide ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: lineLen > 0 ? lineLen : undefined,
          strokeDashoffset: drawn ? 0 : lineLen,
          transition: drawn ? 'stroke-dashoffset 1.8s cubic-bezier(0.25,0.8,0.25,1)' : 'none',
        }}
      />
      {/* Data points on peak values */}
      {wide && vals.map((v, i) => {
        const x = pad + i * step
        const y = H - pad - (v / max) * (H - pad * 2)
        const isPeak = v === max
        return isPeak ? (
          <circle key={i} cx={x} cy={y} r="4" fill="var(--theme-accent)"
            style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.3s 1.6s' }} />
        ) : null
      })}
      {/* Last point dot */}
      <circle cx={lastX} cy={lastY} r={wide ? 4 : 3.5} fill="var(--theme-accent)"
        style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.3s 1.6s' }} />
      {/* Month labels for wide view */}
      {wide && monthLabels.map((m: any, i) => {
        if (i % 3 !== 0 && i !== monthLabels.length - 1) return null
        const x = pad + i * step
        return (
          <text key={i} x={x} y={H - 0} textAnchor="middle" fontSize="7"
            fill="currentColor" opacity={0.3} fontFamily="monospace">
            {m.month_label?.slice(0, 3) ?? ''}
          </text>
        )
      })}
    </svg>
  )
}

// Collections: debtor bars or empty state
function CollectionsSVG({ customers }: { customers?: { customer_name: string; total_outstanding: number }[] }) {
  const top3 = (customers ?? []).slice(0, 3)
  const max  = top3[0]?.total_outstanding || 1

  if (top3.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-2 py-2 opacity-60">
        <svg viewBox="0 0 80 50" className="w-20 h-12" aria-hidden fill="none">
          {/* Mini checkmark in a circle */}
          <circle cx="40" cy="25" r="20" stroke="#10B981" strokeWidth="2" strokeOpacity={0.6} />
          <path d="M 30 25 L 37 32 L 52 18" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.8} />
        </svg>
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light">No outstanding balances</span>
      </div>
    )
  }

  return (
    <svg viewBox="0 0 200 90" className="w-full h-full" aria-hidden>
      {top3.map((c, i) => {
        const w = Math.round((c.total_outstanding / max) * 160)
        return (
          <g key={i}>
            <rect x="0" y={5 + i * 28} width="200" height="20" fill="currentColor" opacity={0.04} rx="1" />
            <rect x="0" y={5 + i * 28} width={w} height="20"
              fill="#EF4444" opacity={0.65 - i * 0.12} rx="1"
              style={{ transition: 'width 1s cubic-bezier(0.25,0.8,0.25,1)' }} />
            <text x="5" y={19 + i * 28} fontSize="8" fill="currentColor" opacity={0.9} fontFamily="monospace">
              {c.customer_name.length > 24 ? c.customer_name.slice(0, 23) + '…' : c.customer_name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── HubCard ───────────────────────────────────────────────────────────────────

interface HubCardProps {
  title: string
  description: string
  kpi?: string
  kpiLabel?: string
  href?: string
  onClick?: () => void
  locked?: boolean
  wide?: boolean        // col-span-2 hero — larger viz area
  children: React.ReactNode
  accentColor?: string
}

function HubCard({ title, description, kpi, kpiLabel, href, onClick, locked, wide, children, accentColor }: HubCardProps) {
  const navigate = useNavigate()
  const handleClick = locked ? undefined : (onClick ?? (href ? () => navigate(href) : undefined))
  return (
    <motion.div
      whileHover={locked ? {} : { y: -2 }}
      onClick={handleClick}
      className={cn(
        'brutal-border bg-surface flex flex-col overflow-hidden transition-shadow relative h-full',
        locked ? 'opacity-60 cursor-default' : 'cursor-pointer group brutal-shadow-hover',
      )}
    >
      {!locked && (
        <div className="absolute inset-0 bg-accent/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}
      {!locked && (
        <div className="h-0.5 w-0 group-hover:w-full transition-all duration-300 origin-left relative z-10"
          style={{ backgroundColor: accentColor ?? 'var(--theme-accent)' }} />
      )}
      <div className={cn('flex-1 p-4 pb-2 flex items-center relative z-10', wide ? 'min-h-[160px]' : 'min-h-[118px]')}>
        {children}
      </div>
      <div className="px-4 py-3 border-t border-line flex items-end justify-between relative z-10">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">{title}</p>
          <p className="text-xs text-ink-light/70 mt-0.5 font-mono">{description}</p>
          {kpi && (
            <p className="font-display font-bold text-xl mt-1" style={{ color: accentColor ?? 'var(--theme-ink)' }}>
              {kpi} <span className="text-xs text-ink-light font-mono font-normal">{kpiLabel}</span>
            </p>
          )}
        </div>
        {!locked && <ArrowRight className="w-4 h-4 text-ink-light opacity-0 group-hover:opacity-100 group-hover:-rotate-45 transition-all duration-200 shrink-0 mb-1" />}
        {locked  && <Lock className="w-4 h-4 text-ink-light shrink-0 mb-1" />}
      </div>
    </motion.div>
  )
}

// ── GST data strip (compact, not a card) ─────────────────────────────────────

const SLAB_COLORS: Record<number, string> = { 5: '#10B981', 12: '#6366F1', 18: '#F59E0B', 28: '#EF4444' }

function GstDataStrip({ gstData, formatCurrencyCompact }: { gstData: any; formatCurrencyCompact: (n: number) => string }) {
  const navigate = useNavigate()
  const slabs: any[] = gstData?.slabs ?? []
  const totals = gstData?.totals

  return (
    <motion.div variants={fadeIn}
      className="brutal-border bg-surface overflow-hidden cursor-pointer group brutal-shadow-hover"
      onClick={() => navigate('/reports/gst')}
      whileHover={{ y: -1 }}
    >
      {/* Strip header */}
      <div className="px-4 py-2.5 border-b border-line flex items-center gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Tax / GST Summary</p>
          <p className="text-[9px] font-mono text-ink-light/50 mt-0.5">
            {gstData?.from_date ?? '—'} to {gstData?.to_date ?? '—'} · CGST + SGST split (intrastate)
          </p>
        </div>
        {totals && (
          <div className="ml-auto text-right shrink-0">
            <p className="text-[9px] font-mono text-ink-light uppercase tracking-wider">Total tax collected</p>
            <p className="font-display font-bold text-lg" style={{ color: '#6366F1' }}>
              {formatCurrencyCompact(totals.total_tax)}
            </p>
          </div>
        )}
        <ArrowRight className="w-4 h-4 text-ink-light opacity-0 group-hover:opacity-100 group-hover:-rotate-45 transition-all duration-200 shrink-0" />
      </div>

      {/* Slab columns */}
      <div className={cn('grid divide-x divide-line', slabs.length === 3 ? 'grid-cols-3' : slabs.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {slabs.map(s => {
          const color = SLAB_COLORS[s.rate] ?? '#9CA3AF'
          return (
            <div key={s.rate} className="px-5 py-4">
              {/* Slab rate badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-display font-bold" style={{ color }}>{s.rate}%</span>
                <span className="text-[9px] font-mono text-ink-light">GST · {s.invoice_count} invoices</span>
              </div>
              {/* Mini bar showing tax proportion */}
              <div className="h-1.5 bg-line/30 mb-3 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${(s.total_tax / (totals?.total_tax || 1)) * 100}%`, backgroundColor: color, opacity: 0.8 }} />
              </div>
              {/* Data rows */}
              <div className="space-y-1.5">
                {[
                  { label: 'Taxable value', val: formatCurrencyCompact(s.taxable_value) },
                  { label: 'CGST',          val: formatCurrencyCompact(s.cgst) },
                  { label: 'SGST',          val: formatCurrencyCompact(s.sgst) },
                  { label: 'Total tax',     val: formatCurrencyCompact(s.total_tax), bold: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-ink-light uppercase tracking-wider">{row.label}</span>
                    <span className={cn('text-[10px] font-mono tabular-nums', row.bold ? 'font-bold' : '')}
                      style={row.bold ? { color } : undefined}>
                      {row.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {slabs.length === 0 && (
          <div className="px-5 py-4 text-[10px] font-mono text-ink-light">No tax data available</div>
        )}
      </div>
    </motion.div>
  )
}

// ── KPI pulse strip ───────────────────────────────────────────────────────────

function KpiStrip({ formatCurrencyCompact, invData, agingData, revenueData }: {
  formatCurrencyCompact: (n: number) => string
  invData: any; agingData: any; revenueData: any
}) {
  const months      = revenueData?.months ?? []
  const thisMonth   = months[months.length - 1]?.total ?? 0
  const stockValue  = invData?.summary?.total_value_at_cost ?? 0
  const outstanding = agingData?.totals?.total_outstanding ?? 0
  const lowStock    = invData?.summary?.low_stock_count ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="brutal-border bg-surface grid grid-cols-2 xl:grid-cols-4 divide-x divide-y xl:divide-y-0 divide-line"
    >
      {[
        { label: 'Revenue — This Month', value: thisMonth > 0 ? formatCurrencyCompact(thisMonth) : '—', color: '#6366F1' },
        { label: 'Stock Value at Cost',  value: stockValue  > 0 ? formatCurrencyCompact(stockValue)  : '—', color: '#10B981' },
        { label: 'Outstanding Balance',  value: outstanding > 0 ? formatCurrencyCompact(outstanding) : '₹0', color: '#EF4444' },
        { label: 'Low Stock Items',      value: String(lowStock), color: '#F59E0B' },
      ].map(k => (
        <div key={k.label} className="px-5 py-3.5">
          <p className="text-[9px] font-mono uppercase tracking-widest text-ink-light">{k.label}</p>
          <p className="font-display font-bold text-2xl mt-1 tabular-nums" style={{ color: k.color }}>{k.value}</p>
        </div>
      ))}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsHubPage() {
  const navigate = useNavigate()
  const { formatCurrencyCompact } = useSettings()

  const { data: invData } = useQuery({
    queryKey: ['analytics-inventory-value'],
    queryFn: () => analyticsService.getInventoryValue(),
    staleTime: 5 * 60_000,
  })
  const { data: bsData } = useQuery({
    queryKey: ['analytics-best-sellers-hub'],
    queryFn: () => analyticsService.getBestSellers({ period: '30d', metric: 'units', limit: 5 }),
    staleTime: 5 * 60_000,
  })
  const { data: revenueData } = useQuery({
    queryKey: ['revenue-dashboard'],
    queryFn: () => reportService.getRevenue(12),
    staleTime: 5 * 60_000,
  })
  const { data: agingData } = useQuery({
    queryKey: ['aging-hub'],
    queryFn: () => reportService.getAging(),
    staleTime: 5 * 60_000,
  })
  const { data: gstData } = useQuery({
    queryKey: ['gst-summary-hub'],
    queryFn: () => reportService.getGstSummary(),
    staleTime: 10 * 60_000,
  })

  const healthPct   = invData?.summary?.stock_health_pct ?? 0
  const totalValue  = invData?.summary?.total_value_at_cost ?? 0
  const bsItems     = bsData?.items ?? []
  const agingTotals = agingData?.totals

  // Top debtors from aging rows — consistent with AR Aging card
  const topDebtors = (agingData?.rows ?? []).slice(0, 3) as { customer_name: string; total_outstanding: number }[]

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-line pb-5 relative overflow-hidden">
        {/* Decorative counter — right side, large */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none select-none">
          <ShopCounterSVG className="w-72 h-36 text-ink dark:text-amber-400 opacity-30 dark:opacity-50" />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1">Analytics</p>
          <h1 className="type-display">Intelligence Hub</h1>
          <p className="text-ink-light font-mono text-xs mt-2 max-w-sm">
            Sales, inventory, collections, and tax — all your reports in one place.
          </p>
          <div className="w-12 h-0.5 bg-accent mt-3" />
        </div>
      </header>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <KpiStrip
        formatCurrencyCompact={formatCurrencyCompact}
        invData={invData}
        agingData={agingData}
        revenueData={revenueData}
      />

      {/* ── Card grid ──────────────────────────────────────────────────────── */}
      {/*
        Layout (xl / 3-col):
          Row 1: [Revenue wide hero — col 1-2] | [Best Sellers — col 3]
          Row 2: [Stock Intel — col 1] | [AR Aging — col 2] | [Collections — col 3]
      */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
      >
        {/* Revenue — wide hero: cols 1-2, row 1 */}
        <motion.div variants={scaleUp} className="sm:col-span-2 xl:col-span-2 xl:col-start-1 xl:row-start-1">
          <HubCard
            title="Revenue Trends"
            description="Monthly revenue · last 12 months"
            kpi={revenueData?.summary?.grand_total ? formatCurrencyCompact(revenueData.summary.grand_total) : '—'}
            kpiLabel="12-month total"
            href="/reports/revenue"
            wide
          >
            <RevenueMiniSVG months={revenueData?.months} wide />
          </HubCard>
        </motion.div>

        {/* Best Sellers — col 3, row 1 */}
        <motion.div variants={fromLeft} className="xl:col-start-3 xl:row-start-1">
          <HubCard
            title="Best Sellers"
            description="Top items by units · last 30 days"
            kpi={bsItems[0]?.item_name ? `#1 ${bsItems[0].item_name.split(' ')[0]}` : '—'}
            kpiLabel={bsItems[0] ? `${bsItems[0].units_sold} units` : ''}
            href="/analytics/best-sellers"
          >
            <BestSellersSVG items={bsItems} />
          </HubCard>
        </motion.div>

        {/* Stock Intelligence — col 1, row 2 */}
        <motion.div variants={fromBelow} className="xl:col-start-1 xl:row-start-2">
          <HubCard
            title="Stock Intelligence"
            description="Inventory health & value"
            kpi={totalValue > 0 ? formatCurrencyCompact(totalValue) : '—'}
            kpiLabel="at cost"
            href="/analytics/inventory"
            accentColor={healthPct >= 70 ? '#10B981' : healthPct >= 40 ? '#F59E0B' : '#EF4444'}
          >
            <StockHealthBarsSVG invData={invData} />
          </HubCard>
        </motion.div>

        {/* AR Aging — col 2, row 2 */}
        <motion.div variants={fromBelow} className="xl:col-start-2 xl:row-start-2">
          <HubCard
            title="AR Aging"
            description="Outstanding by overdue bucket"
            kpi={agingTotals?.total_outstanding ? formatCurrencyCompact(agingTotals.total_outstanding) : '—'}
            kpiLabel="outstanding"
            accentColor="#EF4444"
            href="/reports/aging"
          >
            <div className="w-full" onClick={e => e.stopPropagation()}>
              {agingTotals && (() => {
                const buckets = [
                  { label: 'Current', key: 'current',      value: agingTotals.current,      color: '#10B981', param: 'current' },
                  { label: '1–30d',   key: 'days_1_30',    value: agingTotals.days_1_30,    color: '#F59E0B', param: '1_30'    },
                  { label: '31–60d',  key: 'days_31_60',   value: agingTotals.days_31_60,   color: '#F59E0B', param: '31_60'   },
                  { label: '61–90d',  key: 'days_61_90',   value: agingTotals.days_61_90,   color: '#EF4444', param: '61_90'   },
                  { label: '90d+',    key: 'days_over_90', value: agingTotals.days_over_90, color: '#EF4444', param: 'over_90' },
                ]
                const mx = Math.max(...buckets.map(b => b.value), 1)
                return (
                  <div className="w-full space-y-1.5">
                    {buckets.map(b => (
                      <div key={b.key} className="flex items-center gap-2 cursor-pointer group/bar"
                        onClick={() => navigate(`/reports/aging?bucket=${b.param}`)}>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-light w-14 shrink-0 group-hover/bar:text-ink transition-colors">{b.label}</span>
                        <div className="flex-1 h-3 bg-line/30 relative overflow-hidden">
                          <div className="h-full transition-all duration-700"
                            style={{ width: `${(b.value / mx) * 100}%`, backgroundColor: b.color, opacity: 0.7 }} />
                        </div>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover/bar:opacity-60 transition-opacity shrink-0" style={{ color: b.color }} />
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </HubCard>
        </motion.div>

        {/* Collections — col 3, row 2 */}
        <motion.div variants={fromBelow} className="xl:col-start-3 xl:row-start-2">
          <HubCard
            title="Collections"
            description="Top outstanding customers"
            kpi={topDebtors.length > 0 ? formatCurrencyCompact(topDebtors[0].total_outstanding) : '₹0'}
            kpiLabel={topDebtors.length > 0 ? `${topDebtors[0].customer_name.split(' ')[0]} owes most` : 'all settled'}
            accentColor="#EF4444"
            href="/reports/aging"
          >
            <CollectionsSVG customers={topDebtors} />
          </HubCard>
        </motion.div>
      </motion.div>

      {/* ── GST data strip ─────────────────────────────────────────────────── */}
      <motion.div variants={container} initial="hidden" animate="visible">
        <GstDataStrip gstData={gstData} formatCurrencyCompact={formatCurrencyCompact} />
      </motion.div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-line pt-5 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mr-1 self-center">Reports:</p>
          {[
            { label: 'Daily Summary',       path: '/reports/daily' },
            { label: 'Customer Statements', path: '/customers'     },
            { label: 'Stock Audit Log',     path: '/stock-audit'   },
          ].map(l => (
            <button key={l.path} onClick={() => navigate(l.path)}
              className="px-3 py-1.5 brutal-border font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-surface transition-colors brutal-focus">
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 border border-dashed border-line/50">
          <p className="text-[9px] font-mono uppercase tracking-widest text-ink-light shrink-0">Coming soon</p>
          {['Customer Buying Profiles', 'Returns Analytics', 'Period Comparison', 'Stock Turnover', 'Collection Rate Trend'].map(m => (
            <span key={m} className="flex items-center gap-1.5 text-[10px] font-mono text-ink-light/50">
              <Lock className="w-2.5 h-2.5 shrink-0" />{m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
