import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/customers', label: 'Customers', icon: '👥' },
  { path: '/customers/wholesale-ledgers', label: 'Ledgers', icon: '📒' },
  { path: '/suppliers', label: 'Suppliers', icon: '🏢' },
  { path: '/items', label: 'Inventory', icon: '📦' },
  { path: '/invoices', label: 'Invoices', icon: '📄' },
]

const returnsItems = [
  { path: '/returns', label: 'Returns', icon: '↩️' },
]

const settingsItems = [
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

interface NavigationProps {
  isExpanded: boolean
}

export default function Navigation({ isExpanded }: NavigationProps) {
  const location = useLocation()

  return (
    <nav 
      className={`
        fixed left-0 top-0 h-full z-30 transition-all duration-300 ease-out
        bg-slate-950/90 backdrop-blur-xl border-r-2 border-slate-800/30
      `}
      style={{ width: isExpanded ? '280px' : '80px' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative h-full flex flex-col p-4">
        <div className="mb-8 mt-16">
          <h1 className={`
            text-2xl font-display font-bold gradient-text transition-all duration-300
            ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}
          `}>
            Shop Manager
          </h1>
          {!isExpanded && (
            <div className="text-center">
              <span className="text-3xl">🏪</span>
            </div>
          )}
        </div>

        <ul className="space-y-2 flex-1">
          {navItems.map((item) => (
            <li key={item.path} className="group">
              <Link
                to={item.path}
                className={`
                  relative flex items-center gap-4 px-4 py-3 rounded-xl
                  transition-all duration-300 ease-out
                  ${location.pathname === item.path
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] text-white'
                    : 'text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 light:hover:text-slate-900 hover:bg-slate-800/30 dark:hover:bg-slate-800/30 light:hover:bg-slate-200/30 border-2 border-transparent'
                  }
                  ${isExpanded ? 'justify-start' : 'justify-center px-0'}
                `}
              >
                <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
                  {item.icon}
                </span>
                
                {isExpanded && (
                  <>
                    <span className="font-semibold font-body transition-opacity duration-300">
                      {item.label}
                    </span>
                    
                    {location.pathname === item.path && (
                      <span className="absolute right-4 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse-glow" />
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
          
          {isExpanded && (
            <li className="pt-4 pb-2">
              <span className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Returns</span>
            </li>
          )}
          
          {returnsItems.map((item) => (
            <li key={item.path} className="group">
              <Link
                to={item.path}
                className={`
                  relative flex items-center gap-4 px-4 py-3 rounded-xl
                  transition-all duration-300 ease-out
                  ${location.pathname === item.path
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] text-white'
                    : 'text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 light:hover:text-slate-900 hover:bg-slate-800/30 dark:hover:bg-slate-800/30 light:hover:bg-slate-200/30 border-2 border-transparent'
                  }
                  ${isExpanded ? 'justify-start' : 'justify-center px-0'}
                `}
              >
                <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
                  {item.icon}
                </span>
                
                {isExpanded && (
                  <>
                    <span className="font-semibold font-body transition-opacity duration-300">
                      {item.label}
                    </span>
                    
                    {location.pathname === item.path && (
                      <span className="absolute right-4 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse-glow" />
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
          
          {isExpanded && (
            <li className="pt-4 pb-2">
              <span className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Settings</span>
            </li>
          )}
          
          {settingsItems.map((item) => (
            <li key={item.path} className="group">
              <Link
                to={item.path}
                className={`
                  relative flex items-center gap-4 px-4 py-3 rounded-xl
                  transition-all duration-300 ease-out
                  ${location.pathname === item.path
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] text-white'
                    : 'text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 light:hover:text-slate-900 hover:bg-slate-800/30 dark:hover:bg-slate-800/30 light:hover:bg-slate-200/30 border-2 border-transparent'
                  }
                  ${isExpanded ? 'justify-start' : 'justify-center px-0'}
                `}
              >
                <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
                  {item.icon}
                </span>
                
                {isExpanded && (
                  <>
                    <span className="font-semibold font-body transition-opacity duration-300">
                      {item.label}
                    </span>
                    
                    {location.pathname === item.path && (
                      <span className="absolute right-4 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse-glow" />
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {isExpanded && (
          <div className="pt-6 border-t-2 border-slate-800/50">
            <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-slate-800/30 border-2 border-slate-700/50">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-base">S</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-200">Admin User</div>
                <div className="text-xs text-slate-500">admin@shop.com</div>
              </div>
            </div>
          </div>
        )}
        {!isExpanded && (
          <div className="pt-6 border-t-2 border-slate-800/50 flex justify-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">S</span>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
