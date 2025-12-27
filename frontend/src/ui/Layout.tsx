import { useState } from 'react'
import Header from '../components/Header'
import Navigation from '../components/Navigation'
import { ThemeProvider } from '../components/ThemeProvider'

interface LayoutProps {
  children: React.ReactNode
}

function Layout({ children }: LayoutProps) {
  const [isRailExpanded, setIsRailExpanded] = useState(false)

  const toggleRail = () => {
    setIsRailExpanded(prev => !prev)
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-950 transition-colors duration-300">
        <Navigation isExpanded={isRailExpanded} />
        <div className={`transition-all duration-300 ${isRailExpanded ? 'ml-[280px]' : 'ml-[80px]'}`}>
          <Header 
            onToggleRail={toggleRail} 
            isRailExpanded={isRailExpanded} 
          />
          <main className="pt-20">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default Layout
