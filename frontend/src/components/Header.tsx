import { useTheme } from './ThemeProvider'

interface HeaderProps {
  onToggleRail: () => void
  isRailExpanded: boolean
}

export default function Header({ onToggleRail, isRailExpanded }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 right-0 left-0 h-16 z-40 border-b-2 border-slate-800/30 backdrop-blur-xl bg-slate-950/80 dark:bg-slate-950/80 light:bg-white/80">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleRail}
            className="w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-700/50 hover:border-slate-600/50 flex items-center justify-center transition-all duration-200 hover:scale-105"
            aria-label={isRailExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={isRailExpanded}
          >
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h1 className="text-xl font-display font-semibold text-slate-100 hidden sm:block">
            Shop Manager
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-700/50 hover:border-amber-500/50 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 0 6l-6-11a2 2 0 0 1 0 4m0 0 9l5 3m12 3a2 9 0 0 4 0 0 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg border-2 border-amber-400/30">
            <span className="text-white font-bold text-sm">S</span>
          </div>
        </div>
      </div>
    </header>
  )
}
