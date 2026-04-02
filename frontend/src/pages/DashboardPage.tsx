import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, ArrowRight, X, AlertCircle,
  Users, Building2, Package, FileText, Plus,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useTheme } from '../components/ThemeProvider'
import { useSettings } from '../components/SettingsProvider'
import { CypherCounter } from '../components/CypherCounter'
import { Sparkline } from '../components/Sparkline'
import { itemService, invoiceService } from '../services/api'
import api from '../services/api'
import { cn } from '../lib/utils'
import type { InvoiceListResponse, ItemListResponse } from '../types/api'
import { CreateInvoiceModal } from '../components/CreateInvoiceModal'
import { MagneticButton } from '../components/MagneticButton'

// ── Static placeholder for revenue chart (no reporting endpoint yet) ──────────
// Dates: last 14 days ending today (2026-03-28), formatted as 'Mar 14' etc.
function buildRevenueData() {
  const amounts = [12400, 9800, 15200, 8900, 21000, 18500, 24300, 19700, 28100, 22400, 31500, 27800, 35200, 29600]
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const today = new Date()
  return amounts.map((amount, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (13 - i))
    const label = i === 13 ? 'Today' : `${months[d.getMonth()]} ${d.getDate()}`
    return { date: label, amount }
  })
}
const revenueData = buildRevenueData()

// ── Chart container — defers rendering until parent has positive dimensions ───
function ChartContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.clientWidth > 0 && el.clientHeight > 0) { setReady(true); return }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setReady(true)
          observer.disconnect()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn('w-full h-full', className)}>
      {ready && children}
    </div>
  )
}

function DashboardPage() {
  const { theme } = useTheme()
  const { formatCurrency, formatCurrencyCompact, numberSystem } = useSettings()
  const navigate = useNavigate()
  const [expandedChart, setExpandedChart] = useState<'revenue' | 'status' | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [hoveredStatusIndex, setHoveredStatusIndex] = useState<number | null>(null)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)

  const getPeriod = (h: number) =>
    h >= 21 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'noon' : 'evening'

  const greetings = {
    morning: [
      'Good Morning — let\'s make today count.',
      'A fresh day at the shop. Welcome back.',
      'Morning. The ledger awaits.',
      'Good Morning. Your store is ready to go.',
      'Early start — that\'s the spirit.',
      'Rise and open the shutters.',
      'Morning check-in. Everything\'s in order.',
      'A new day, a new opportunity to sell.',
    ],
    noon: [
      'Good Afternoon. How\'s business looking?',
      'Mid-day check-in. Keep the momentum going.',
      'Afternoon. Any pending invoices to clear?',
      'Good Afternoon — half the day done.',
      'The afternoon rush — stay on top of it.',
      'Afternoon overview. Numbers looking good?',
      'Good Afternoon. Stock holding steady.',
      'Mid-day. A good time to review your ledger.',
    ],
    evening: [
      'Good Evening. Winding down for the day?',
      'Evening overview — what did the day bring?',
      'Almost closing time. Let\'s tally up.',
      'Good Evening. Review today\'s transactions.',
      'The day\'s work is nearly done.',
      'Evening. Time to settle the accounts.',
      'Good Evening — a solid day\'s trading.',
      'Closing hour. Reconcile before you rest.',
    ],
    night: [
      'Working late tonight?',
      'Night shift — the books don\'t close themselves.',
      'Late hours. The dedicated shop owner.',
      'Quiet hours — good time for a stock review.',
      'Burning the midnight lamp.',
      'Late night check-in. All systems running.',
    ],
  }

  // Pick a random greeting on load; re-randomise when the time period changes
  const [greetingIdx, setGreetingIdx] = useState(() => Math.floor(Math.random() * 100))
  const prevPeriodRef = useRef(getPeriod(new Date().getHours()))

  // ── Live clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      // Re-randomise greeting when time period changes (morning → noon → evening → night)
      const newPeriod = getPeriod(now.getHours())
      if (newPeriod !== prevPeriodRef.current) {
        prevPeriodRef.current = newPeriod
        setGreetingIdx(Math.floor(Math.random() * 100))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Escape key closes modals ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedChart(null) }
    if (expandedChart) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset'; window.removeEventListener('keydown', onKey) }
  }, [expandedChart])

  const getGreeting = () => {
    const period = getPeriod(currentTime.getHours())
    const opts = greetings[period]
    return opts[greetingIdx % opts.length]
  }

  // ── API Queries ────────────────────────────────────────────────────────────
  const thisMonthStart = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  const { data: customerCount } = useQuery<number>({
    queryKey: ['invoices-this-month', thisMonthStart],
    queryFn: () => api.get(`/invoices/?page_size=1&date_from=${thisMonthStart}`).then(r => r.data.total_items as number),
  })

  const { data: supplierCount } = useQuery<number>({
    queryKey: ['suppliers-count'],
    queryFn: () => api.get('/suppliers/?page_size=1').then(r => r.data.total_items as number),
  })

  const { data: itemCount } = useQuery<number>({
    queryKey: ['items-count'],
    queryFn: () => api.get('/items/?page_size=1').then(r => r.data.total_items as number),
  })

  const { data: unpaidCount } = useQuery<number>({
    queryKey: ['invoices-unpaid-count'],
    queryFn: () => api.get('/invoices/?page_size=1&payment_status=unpaid').then(r => r.data.total_items as number),
  })

  const { data: outstandingAmount } = useQuery<number>({
    queryKey: ['invoices-outstanding-amount'],
    queryFn: async () => {
      const [unpaidRes, partialRes] = await Promise.all([
        api.get('/invoices/?page_size=500&payment_status=unpaid'),
        api.get('/invoices/?page_size=500&payment_status=partial'),
      ])
      const all: { total_amount: number; amount_paid?: number }[] = [
        ...(unpaidRes.data.data ?? []),
        ...(partialRes.data.data ?? []),
      ]
      return all.reduce((sum, inv) => sum + (inv.total_amount - (inv.amount_paid ?? 0)), 0)
    },
  })

  const { data: paidCount } = useQuery<number>({
    queryKey: ['invoices-paid-count'],
    queryFn: () => api.get('/invoices/?page_size=1&payment_status=paid').then(r => r.data.total_items as number),
  })

  const { data: partialCount } = useQuery<number>({
    queryKey: ['invoices-partial-count'],
    queryFn: () => api.get('/invoices/?page_size=1&payment_status=partial').then(r => r.data.total_items as number),
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-recent'],
    queryFn: () => invoiceService.list({ page_size: 5 }),
  })

  const { data: itemsData } = useQuery({
    queryKey: ['items-all-dashboard'],
    queryFn: () => itemService.list({ page_size: 100 }),
  })

  const recentInvoices: InvoiceListResponse[] = invoicesData?.data ?? []
  const lowStockItems: ItemListResponse[] = (itemsData?.data ?? []).filter((item: ItemListResponse) => item.is_low_stock)

  const totalInvoices = (paidCount ?? 0) + (unpaidCount ?? 0) + (partialCount ?? 0)

  const rawStatusData = [
    { name: 'Paid',    value: paidCount    ?? 0, color: 'var(--theme-success)' },
    { name: 'Partial', value: partialCount ?? 0, color: 'var(--theme-warning)' },
    { name: 'Unpaid',  value: unpaidCount  ?? 0, color: 'var(--theme-danger)' },
  ]
  // Recharts PieChart renders blank if all values are 0 — use placeholder slice while loading
  const hasStatusData = rawStatusData.some(s => s.value > 0)
  const statusData = hasStatusData
    ? rawStatusData
    : [{ name: 'Loading', value: 1, color: 'var(--theme-line)' }]

  // ── Organic sparkline builder — simulates realistic growth curve ───────────
  function organicSpark(current: number, volatility = 0.18): number[] {
    if (!current || current === 0) return [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const pts: number[] = []
    const seeds = [0.62, 0.71, 0.66, 0.78, 0.74, 0.83, 0.88, 0.95, 1.0]
    for (let i = 0; i < 9; i++) {
      const noise = 1 + (Math.sin(i * 2.3 + current * 0.01) * volatility)
      pts.push(Math.max(0, Math.round(current * seeds[i] * noise)))
    }
    pts[8] = current
    return pts
  }

  // ── KPI definitions ────────────────────────────────────────────────────────
  const kpis = [
    {
      title: 'Bills This Month',
      value: customerCount ?? 0,
      icon: Users,
      trend: 'invoices',
      up: true,
      negative: false,
      isCurrency: false,
      sparkData: organicSpark(customerCount ?? 0, 0.12),
    },
    {
      title: 'Total Suppliers',
      value: supplierCount ?? 0,
      icon: Building2,
      trend: '+5%',
      up: true,
      negative: false,
      isCurrency: false,
      sparkData: organicSpark(supplierCount ?? 0, 0.08),
    },
    {
      title: 'Inventory Items',
      value: itemCount ?? 0,
      icon: Package,
      trend: '+3%',
      up: true,
      negative: false,
      isCurrency: false,
      sparkData: organicSpark(itemCount ?? 0, 0.1),
    },
    {
      title: 'Outstanding Amount',
      value: outstandingAmount ?? 0,
      icon: FileText,
      trend: '',
      up: false,
      negative: true,
      isCurrency: true,
      sparkData: organicSpark(outstandingAmount ?? 0, 0.22),
    },
  ]

  // ── Y-axis formatter ───────────────────────────────────────────────────────
  const formatYAxis = (value: number) => formatCurrencyCompact(value)

  // ── Revenue chart (inline & modal) ────────────────────────────────────────
  const renderRevenueChart = () => (
    <ChartContainer>
      <ResponsiveContainer width="100%" height="100%">
        {theme === 'light' ? (
          <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-line)', borderRadius: '0', color: 'var(--theme-ink)' }}
              itemStyle={{ color: 'var(--theme-accent)', fontFamily: 'JetBrains Mono', fontSize: '14px', fontWeight: 'bold' }}
              labelStyle={{ color: 'var(--theme-ink-light)', marginBottom: '4px', fontFamily: 'Inter', fontSize: '12px', textTransform: 'uppercase' }}
              cursor={{ fill: 'var(--theme-line-subtle)' }}
              formatter={(value: number) => [formatCurrency(value), 'Revenue']}
            />
            <Bar dataKey="amount" fill="var(--theme-accent)" radius={[2, 2, 0, 0]} maxBarSize={40} animationDuration={1500} />
          </BarChart>
        ) : (
          <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--theme-accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--theme-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-line)', borderRadius: '0', color: 'var(--theme-ink)' }}
              itemStyle={{ color: 'var(--theme-accent)', fontFamily: 'JetBrains Mono', fontSize: '14px' }}
              labelStyle={{ color: 'var(--theme-ink-light)', marginBottom: '4px', fontFamily: 'Inter', fontSize: '12px', textTransform: 'uppercase' }}
              cursor={{ stroke: 'var(--theme-line)', strokeWidth: 1, strokeDasharray: '4 4' }}
              formatter={(value: number) => [formatCurrency(value), 'Revenue']}
            />
            <Area type="monotone" dataKey="amount" stroke="var(--theme-accent)" strokeWidth={2} fill="url(#colorAmount)" activeDot={{ r: 6, fill: 'var(--theme-accent)', stroke: 'var(--theme-surface)', strokeWidth: 2 }} animationDuration={1500} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </ChartContainer>
  )

  const renderRevenueChartModal = () => (
    <ResponsiveContainer width="100%" height={400}>
      {theme === 'light' ? (
        <BarChart data={revenueData} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-line-subtle)" />
          <XAxis dataKey="date" stroke="var(--theme-ink-light)" fontSize={12} tickLine={false} axisLine={false} tickMargin={12} minTickGap={20} label={{ value: 'DAYS -->', position: 'insideBottom', offset: -25, fill: 'var(--theme-ink-light)', fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 'bold' }} />
          <YAxis stroke="var(--theme-ink-light)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatYAxis} tickMargin={12} label={{ value: 'Revenue -->', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--theme-ink-light)', fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 'bold', style: { textAnchor: 'middle' } }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-line)', borderRadius: '0', color: 'var(--theme-ink)' }}
            itemStyle={{ color: 'var(--theme-accent)', fontFamily: 'JetBrains Mono', fontSize: '14px', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--theme-ink-light)', marginBottom: '4px', fontFamily: 'Inter', fontSize: '12px', textTransform: 'uppercase' }}
            cursor={{ fill: 'var(--theme-line-subtle)' }}
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          />
          <Bar dataKey="amount" fill="var(--theme-accent)" radius={[2, 2, 0, 0]} maxBarSize={60} animationDuration={1500} />
        </BarChart>
      ) : (
        <AreaChart data={revenueData} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-line)" />
          <XAxis dataKey="date" stroke="var(--theme-ink-light)" fontSize={12} tickLine={false} axisLine={false} tickMargin={12} minTickGap={20} label={{ value: 'DAYS -->', position: 'insideBottom', offset: -25, fill: 'var(--theme-ink-light)', fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 'bold' }} />
          <YAxis stroke="var(--theme-ink-light)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatYAxis} tickMargin={12} label={{ value: 'Revenue -->', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--theme-ink-light)', fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 'bold', style: { textAnchor: 'middle' } }} />
          <defs>
            <linearGradient id="colorAmountModal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--theme-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--theme-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-line)', borderRadius: '0', color: 'var(--theme-ink)' }}
            itemStyle={{ color: 'var(--theme-accent)', fontFamily: 'JetBrains Mono', fontSize: '14px' }}
            labelStyle={{ color: 'var(--theme-ink-light)', marginBottom: '4px', fontFamily: 'Inter', fontSize: '12px', textTransform: 'uppercase' }}
            cursor={{ stroke: 'var(--theme-line)', strokeWidth: 1, strokeDasharray: '4 4' }}
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          />
          <Area type="monotone" dataKey="amount" stroke="var(--theme-accent)" strokeWidth={2} fill="url(#colorAmountModal)" activeDot={{ r: 8, fill: 'var(--theme-accent)', stroke: 'var(--theme-surface)', strokeWidth: 2 }} animationDuration={1500} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  )

  // ── Status chart (inline & modal) ─────────────────────────────────────────
  const renderStatusChart = () => (
    <ChartContainer>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={statusData}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={5}
            dataKey="value"
            stroke="var(--theme-surface)"
            strokeWidth={4}
            cornerRadius={4}
            onMouseEnter={(_, index) => setHoveredStatusIndex(index)}
            onMouseLeave={() => setHoveredStatusIndex(null)}
          >
            {statusData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={hoveredStatusIndex === null || hoveredStatusIndex === index ? 1 : 0.35}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )

  const renderStatusChartModal = () => (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={statusData}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="75%"
          paddingAngle={5}
          dataKey="value"
          stroke="var(--theme-surface)"
          strokeWidth={6}
          cornerRadius={4}
          onMouseEnter={(_, index) => setHoveredStatusIndex(index)}
          onMouseLeave={() => setHoveredStatusIndex(null)}
        >
          {statusData.map((entry, index) => (
            <Cell
              key={`cell-modal-${index}`}
              fill={entry.color}
              opacity={hoveredStatusIndex === null || hoveredStatusIndex === index ? 1 : 0.35}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )

  // ── Payment status badge ───────────────────────────────────────────────────
  const statusBadge = (status: string, hovered = false) => cn(
    'px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border text-center shrink-0',
    status === 'paid'    && (hovered ? 'bg-surface/20 text-surface border-surface/20' : 'bg-success text-on-status border-success'),
    status === 'partial' && (hovered ? 'border-surface/60 text-surface/80'            : 'border-warning text-warning'),
    status === 'unpaid'  && (hovered ? 'bg-surface/20 text-surface border-surface/20' : 'bg-danger text-on-status border-danger'),
  )

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-line pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="type-display"
          >
            {getGreeting()}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 text-ink-light font-mono uppercase tracking-widest text-sm"
          >
            <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <span className="hidden sm:block">/</span>
            <span className="text-accent font-bold">{currentTime.toLocaleTimeString('en-US', { hour12: false })} LIVE</span>
          </motion.div>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </div>
        <MagneticButton strength={0.5}>
          <button
            onClick={() => setShowCreateInvoice(true)}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all shrink-0"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </MagneticButton>
      </header>

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
        }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.title}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className={cn(
                'p-5 brutal-border bg-surface relative group overflow-hidden brutal-shadow-hover',
                kpi.negative && 'border-2 border-danger bg-surface dark:border dark:bg-paper',
              )}
            >
              {/* top accent line on hover */}
              <div className={cn(
                'absolute top-0 left-0 w-full h-1 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300',
                kpi.negative ? 'bg-danger' : 'bg-accent',
              )} />

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4 shrink-0', kpi.negative ? 'text-danger' : 'text-ink-light')} />
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest leading-tight', kpi.negative ? 'text-danger' : 'text-ink-light')}>
                    {kpi.title}
                  </p>
                </div>
                {kpi.trend && (
                  <div className={cn(
                    'flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 border shrink-0',
                    kpi.negative
                      ? 'border-danger text-danger'
                      : 'border-line text-ink-light group-hover:border-accent group-hover:text-accent transition-colors',
                    kpi.up && 'animate-[pulse_3s_ease-in-out_infinite]',
                  )}>
                    {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpi.trend}
                  </div>
                )}
              </div>

              <div className={cn('transition-transform duration-300 group-hover:translate-x-2 w-full', kpi.negative ? 'text-danger' : 'text-ink')}>
                <CypherCounter
                  value={kpi.value}
                  formatter={(v) => kpi.isCurrency ? formatCurrencyCompact(v) : v.toLocaleString(numberSystem)}
                />
              </div>

              <div className="mt-3 pt-3 border-t border-line/50">
                <Sparkline data={kpi.sparkData} width={120} height={24} filled />
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* ── Charts Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="xl:col-span-2 brutal-border bg-surface p-6 flex flex-col group/card relative overflow-hidden"
        >
          <div className="flex justify-between items-center border-b border-line pb-4 mb-6">
            <div>
              <h3 className="text-xl font-display font-bold uppercase">Revenue Trajectory</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mt-1">Placeholder — reporting endpoint coming soon</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs uppercase tracking-widest text-ink-light hidden sm:block">Last 14 Days</span>
              <button
                onClick={() => setExpandedChart('revenue')}
                className="group/expand hidden md:flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-widest px-3 py-1.5 border border-line hover:border-accent hover:text-accent transition-colors brutal-focus outline-none"
              >
                Expand <ArrowRight className="w-3 h-3 group-hover/expand:-rotate-45 transition-transform duration-200" />
              </button>
            </div>
          </div>
          <div
            className="h-[280px] w-full min-h-[280px] min-w-[100px] cursor-pointer md:cursor-auto"
            onClick={() => window.innerWidth < 768 ? setExpandedChart('revenue') : undefined}
          >
            {renderRevenueChart()}
          </div>
        </motion.div>

        {/* Payment Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="brutal-border bg-surface p-6 flex flex-col group/card relative overflow-hidden"
        >
          <div className="flex justify-between items-center border-b border-line pb-4 mb-6">
            <h3 className="text-xl font-display font-bold uppercase">Payment Status</h3>
            <button
              onClick={() => setExpandedChart('status')}
              className="group/expand hidden md:flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-widest px-3 py-1.5 border border-line hover:border-accent hover:text-accent transition-colors brutal-focus outline-none"
            >
              Expand <ArrowRight className="w-3 h-3 group-hover/expand:-rotate-45 transition-transform duration-200" />
            </button>
          </div>
          <div
            className="relative flex items-center justify-center h-[220px] min-w-[100px] cursor-pointer md:cursor-auto"
            onClick={() => window.innerWidth < 768 ? setExpandedChart('status') : undefined}
          >
            {renderStatusChart()}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hoveredStatusIndex !== null ? (
                <>
                  <span
                    className="text-4xl font-display font-bold transition-all duration-150"
                    style={{ color: statusData[hoveredStatusIndex]?.color }}
                  >
                    {statusData[hoveredStatusIndex]?.value}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light mt-0.5">
                    {statusData[hoveredStatusIndex]?.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-display font-bold">{totalInvoices.toLocaleString(numberSystem)}</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Invoices</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {rawStatusData.map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm font-mono border-b border-line pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-ink" style={{ backgroundColor: s.color }} />
                  <span className="uppercase">{s.name}</span>
                </div>
                <span className="font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Invoices */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="brutal-border bg-surface"
        >
          <div className="flex justify-between items-center p-4 border-b border-line bg-ink text-surface">
            <h3 className="text-lg font-display font-bold uppercase">Recent Invoices</h3>
            <button
              onClick={() => navigate('/invoices')}
              className="text-xs font-mono uppercase tracking-widest hover:opacity-60 transition-opacity flex items-center gap-1 brutal-focus outline-none"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-line">
            {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => navigate('/invoices')}
                className="p-4 hover:bg-ink hover:text-surface transition-colors group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono font-bold text-sm">{inv.invoice_number || `INV-${inv.id}`}</span>
                  <div className={statusBadge(inv.payment_status)}>{inv.payment_status}</div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm">{inv.customer_name}</span>
                    <span className="text-xs font-mono uppercase tracking-widest text-ink-light group-hover:text-surface/70">
                      {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-lg">{formatCurrency(inv.total_amount)}</span>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-ink-light font-mono uppercase tracking-widest text-xs">
                No invoices yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Low Stock */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="brutal-border bg-surface"
        >
          {lowStockItems.length > 0 ? (
            <>
              <div className="flex justify-between items-center p-4 border-b border-line bg-danger text-on-status">
                <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" /> Critical Stock
                </h3>
                <button
                  onClick={() => navigate('/items')}
                  className="text-xs font-mono uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity brutal-focus outline-none"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-line">
                {lowStockItems.slice(0, 6).map((item, i) => {
                  const threshold = item.low_stock_threshold ?? 10
                  const stock = item.current_stock_quantity ?? 0
                  const percent = Math.max(5, Math.min(100, (stock / threshold) * 100))
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate('/items')}
                      className="p-4 hover:bg-ink hover:text-surface transition-colors group cursor-pointer"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium truncate mr-4">{item.item_name}</span>
                        <span className="font-mono font-bold text-danger group-hover:text-surface text-lg shrink-0">
                          {stock}{' '}
                          <span className="text-ink-light group-hover:text-surface/70 text-xs font-normal">
                            {item.unit_of_measurement ?? 'pcs'}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full border border-line bg-surface relative group-hover:border-surface/20 group-hover:bg-surface/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
                          className="absolute top-0 left-0 bottom-0 bg-danger border-r border-line group-hover:bg-accent group-hover:border-accent/50"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center p-4 border-b border-line bg-success text-on-status">
                <h3 className="text-lg font-display font-bold uppercase">Stock Health</h3>
                <span className="text-xs font-mono uppercase tracking-widest">All Clear</span>
              </div>
              <div className="p-12 text-center text-ink-light font-mono uppercase tracking-widest text-xs">
                No items below threshold
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Fullscreen Chart Modals ─────────────────────────────────────────── */}
      {createPortal(
        <AnimatePresence mode="wait">
          {expandedChart && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden pointer-events-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setExpandedChart(null)}
                className="absolute inset-0 bg-ink/20 backdrop-blur-md cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={cn(
                  'brutal-border bg-surface w-fit max-w-[95vw] max-h-[90vh] flex flex-col relative z-50 shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden',
                  expandedChart === 'revenue' ? 'lg:max-w-6xl' : 'lg:max-w-5xl',
                )}
              >
                <div className="flex justify-between items-center p-6 border-b border-line bg-ink text-surface shrink-0">
                  <h3 className="text-2xl font-display font-bold uppercase tracking-tighter">
                    {expandedChart === 'revenue' ? 'Revenue Trajectory & Insights' : 'Payment Status & Aging'}
                  </h3>
                  <button
                    onClick={() => { setExpandedChart(null); setHoveredStatusIndex(null) }}
                    className="p-2 border border-transparent hover:bg-danger hover:text-paper transition-colors brutal-focus outline-none"
                    title="Close (Esc)"
                  >
                    <X className="w-6 h-6 md:w-8 md:h-8" />
                  </button>
                </div>

                <div className="flex-1 w-full p-6 md:p-10 bg-surface overflow-y-auto">
                  {expandedChart === 'revenue' && (
                    <div className="w-full flex flex-col lg:flex-row gap-10 items-stretch">
                      <div className="w-full lg:w-[600px] xl:w-[700px] p-6 border border-line bg-paper brutal-shadow flex flex-col">
                        {renderRevenueChartModal()}
                      </div>
                      <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-8">
                        <h4 className="font-display text-3xl font-bold uppercase border-b border-line pb-4">Performance Insights</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 border border-line bg-paper flex flex-col gap-2">
                            <span className="text-[10px] uppercase font-mono tracking-widest text-ink-light">Absolute Peak</span>
                            <span className="text-2xl font-display font-bold text-success">Mar 27</span>
                            <span className="font-mono text-sm">{formatCurrency(35200)}</span>
                          </div>
                          <div className="p-4 border border-line bg-paper flex flex-col gap-2">
                            <span className="text-[10px] uppercase font-mono tracking-widest text-ink-light">Absolute Low</span>
                            <span className="text-2xl font-display font-bold text-danger">Mar 18</span>
                            <span className="font-mono text-sm">{formatCurrency(8900)}</span>
                          </div>
                        </div>
                        <div className="p-6 border border-line bg-paper brutal-shadow-hover transition-transform hover:-translate-y-1 cursor-default">
                          <span className="text-xs uppercase font-mono tracking-widest text-ink-light block mb-3">Projected Trajectory</span>
                          <p className="text-3xl font-display font-bold text-accent mb-1">{formatCurrencyCompact(revenueData[13].amount * 1.18)}</p>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-4">Estimated next 7 days</p>
                          <div className="space-y-2">
                            <div className="flex justify-between font-mono text-xs text-ink-light border-b border-line pb-2">
                              <span>Avg Daily (14d)</span>
                              <span className="font-bold text-ink">{formatCurrencyCompact(revenueData.reduce((s, d) => s + d.amount, 0) / revenueData.length)}</span>
                            </div>
                            <div className="flex justify-between font-mono text-xs text-ink-light">
                              <span>7-Day Forecast</span>
                              <span className="font-bold text-success">+18% growth</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {expandedChart === 'status' && (
                    <div className="w-full flex flex-col lg:flex-row items-stretch justify-center gap-10">
                      <div className="w-full lg:w-[500px] relative flex flex-col items-center justify-center p-8 border border-line bg-paper brutal-shadow">
                        <div className="w-full max-w-[400px] relative">
                          {renderStatusChartModal()}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {hoveredStatusIndex !== null ? (
                              <>
                                <span
                                  className="text-7xl font-display font-bold transition-all duration-150"
                                  style={{ color: statusData[hoveredStatusIndex]?.color }}
                                >
                                  {statusData[hoveredStatusIndex]?.value}
                                </span>
                                <span className="text-lg font-mono uppercase tracking-widest text-ink-light mt-2">
                                  {statusData[hoveredStatusIndex]?.name}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-7xl font-display font-bold">{totalInvoices}</span>
                                <span className="text-lg font-mono uppercase tracking-widest text-ink-light mt-2">Total Invoices</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-8">
                        <h4 className="font-display text-3xl font-bold uppercase border-b border-line pb-4">Status & Risk Vectors</h4>
                        <div className="flex flex-col gap-4">
                          {rawStatusData.map(s => (
                            <div key={s.name} className="flex justify-between items-center p-4 border border-line hover:border-ink transition-colors brutal-shadow-hover cursor-default bg-paper">
                              <div className="flex items-center gap-4">
                                <div className="w-6 h-6 border-[3px] border-ink rounded-sm" style={{ backgroundColor: s.color }} />
                                <span className="text-lg font-mono uppercase tracking-widest font-bold">{s.name} volume</span>
                              </div>
                              <span className="text-4xl font-display font-bold">{s.value}</span>
                            </div>
                          ))}
                        </div>
                        {(unpaidCount ?? 0) > 0 && (
                          <div className="mt-2 p-6 border-2 border-danger bg-danger/5">
                            <h5 className="font-display text-xl font-bold text-danger uppercase mb-4 flex items-center gap-2">
                              <AlertCircle className="w-6 h-6" /> Action Required
                            </h5>
                            <p className="font-mono text-sm leading-relaxed mb-6 opacity-90">
                              You have <strong>{unpaidCount}</strong> unpaid invoice{unpaidCount !== 1 ? 's' : ''} currently floating. Review and follow up on overdue accounts.
                            </p>
                            <button
                              onClick={() => { setExpandedChart(null); navigate('/invoices') }}
                              className="brutal-border bg-danger text-on-status px-6 py-4 font-mono text-sm font-bold uppercase tracking-widest brutal-focus hover:bg-surface hover:text-danger hover:border-danger transition-all outline-none w-full sm:w-auto"
                            >
                              View Unpaid Invoices
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <CreateInvoiceModal open={showCreateInvoice} onClose={() => setShowCreateInvoice(false)} />
    </div>
  )
}

export default DashboardPage
