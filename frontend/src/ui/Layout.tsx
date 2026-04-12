import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeProvider } from '../components/ThemeProvider'
import { SettingsProvider } from '../components/SettingsProvider'
import { Sidebar } from '../components/Sidebar'
import { ToastProvider } from '../components/ToastProvider'
import { ErrorBoundary } from '../components/ErrorBoundary'

interface LayoutProps {
  children: React.ReactNode
}

function LayoutInner({ children }: LayoutProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen flex bg-paper text-ink relative overflow-hidden">
      {/* Film Grain */}
      <div className="fixed inset-0 bg-noise z-0 pointer-events-none" />

      {/* Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(var(--theme-line-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--theme-line-subtle) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <Sidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-10">
        {/* Mobile Header */}
        <div className="md:hidden print:hidden flex items-center p-4 border-b border-line bg-surface sticky top-0 z-30">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-2 border border-transparent hover:border-accent hover:text-accent text-ink transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-2 font-display font-bold text-lg uppercase tracking-tight">RetailPilot</span>
        </div>

        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full print:p-0 print:max-w-none print:mx-0">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="print:!opacity-100 print:!transform-none"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </div>
      </main>

    </div>
  )
}

function Layout({ children }: LayoutProps) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <ToastProvider>
          <LayoutInner>{children}</LayoutInner>
        </ToastProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}

export default Layout
