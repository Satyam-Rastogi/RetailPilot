import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, FileText, Users, BookOpen, Building2,
  Package, RotateCcw, Search, Settings, ChevronLeft, Sun, Moon, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from './ThemeProvider'
import { useSettings } from './SettingsProvider'
import api from '../services/api'

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Invoices', path: '/invoices', icon: FileText },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Ledgers', path: '/customers/wholesale-ledgers', icon: BookOpen },
  { name: 'Suppliers', path: '/suppliers', icon: Building2 },
  { name: 'Inventory', path: '/items', icon: Package },
  { name: 'Returns', path: '/returns', icon: RotateCcw },
  { name: 'Stock Audit', path: '/stock-audit', icon: Search },
  { name: 'Settings', path: '/settings', icon: Settings },
]

interface SidebarProps {
  isExpanded: boolean
  setIsExpanded: (val: boolean) => void
  isMobileOpen: boolean
  setIsMobileOpen: (val: boolean) => void
}

export function Sidebar({ isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const { userName, userDesignation } = useSettings()

  const { data: lowStockCount } = useQuery<number>({
    queryKey: ['low-stock-count'],
    queryFn: () => api.get('/items/?page_size=1&low_stock_only=true').then(r => r.data.total_items as number),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const sidebarContent = (
    <div className="flex flex-col h-full bg-paper border-r border-line">
      {/* Header */}
      <div className={cn('flex items-center border-b border-line h-20', isExpanded ? 'justify-between p-4' : 'justify-center p-0')}>
        <div className={cn('flex items-center overflow-hidden', isExpanded ? 'gap-3' : 'gap-0')}>
          <div className="w-8 h-8 bg-ink flex items-center justify-center shrink-0 brutal-shadow">
            <Package className="w-5 h-5 text-surface" />
          </div>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-display font-bold text-xl tracking-tight uppercase whitespace-nowrap"
            >
              RetailPilot
            </motion.span>
          )}
        </div>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden flex p-1.5 border border-transparent hover:border-line text-ink transition-colors brutal-focus outline-none"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className={cn('flex-1 py-6 space-y-1 overflow-y-auto', isExpanded ? 'px-3' : 'px-2')}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' &&
             location.pathname.startsWith(item.path + '/') &&
             !NAV_ITEMS.some(other => other.path !== item.path && location.pathname === other.path))
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              title={!isExpanded ? item.name : undefined}
              className={cn(
                'relative flex items-center gap-3 py-2.5 transition-all group border-l-[3px] brutal-focus outline-none',
                isExpanded ? 'justify-start px-3' : 'justify-center px-0',
                isActive
                  ? 'border-l-accent bg-accent-subtle text-ink'
                  : 'border-l-transparent text-ink-light hover:border-l-accent hover:text-accent hover:bg-accent-subtle'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0 transition-colors', isActive ? 'text-accent' : 'text-ink-light group-hover:text-accent')} />
              {isExpanded && (
                <span className="font-mono text-sm uppercase tracking-wider whitespace-nowrap flex-1">{item.name}</span>
              )}
              {item.path === '/items' && (lowStockCount ?? 0) > 0 && (
                <span className={cn(
                  'flex items-center justify-center text-[10px] font-mono font-bold min-w-[18px] h-[18px] px-1 bg-danger text-on-status',
                  !isExpanded && 'absolute top-1 right-1',
                )}>
                  {lowStockCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-line bg-surface flex flex-col gap-4', isExpanded ? 'p-4' : 'p-3')}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'flex items-center gap-3 py-2 border border-line transition-all group brutal-shadow-hover brutal-focus outline-none',
            isExpanded ? 'justify-start px-3' : 'justify-center px-0'
          )}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-ink-light group-hover:text-accent shrink-0" />
          ) : (
            <Moon className="w-5 h-5 text-ink-light group-hover:text-accent shrink-0" />
          )}
          {isExpanded && (
            <span className="font-mono text-xs uppercase tracking-wider text-ink-light group-hover:text-accent">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        <div className={cn('flex items-center overflow-hidden', isExpanded ? 'gap-3 justify-start' : 'gap-0 justify-center')}>
          <div className="w-10 h-10 bg-paper border border-line flex items-center justify-center shrink-0 brutal-shadow">
            <span className="font-display font-bold text-sm">{(userName || 'S')[0].toUpperCase()}</span>
          </div>
          {isExpanded && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="font-mono text-sm font-bold uppercase truncate">{userName || 'Shop Owner'}</span>
              <span className="text-xs text-ink-light font-mono uppercase truncate">{userDesignation || 'Admin'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block relative h-screen sticky top-0 z-40 shrink-0">
        <motion.aside
          initial={false}
          animate={{ width: isExpanded ? 280 : 72 }}
          transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
          className="h-full overflow-hidden"
        >
          {sidebarContent}
        </motion.aside>

        {/* Desktop Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-7 -right-3 w-6 h-6 bg-paper border border-line flex items-center justify-center text-ink hover:text-accent hover:border-accent transition-all z-50 brutal-shadow-hover outline-none"
        >
          <ChevronLeft className={cn('w-3.5 h-3.5 transition-transform', !isExpanded && 'rotate-180')} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-[280px] h-full bg-paper"
          >
            {sidebarContent}
          </motion.aside>
        </div>
      )}
    </>
  )
}
