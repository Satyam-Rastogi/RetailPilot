import { useState } from 'react'
import Navigation from './components/Navigation'
import CompanyProfile from './components/CompanyProfile'
import CustomerManagement from './components/CustomerManagement'
import SupplierManagement from './components/SupplierManagement'
import InventoryManagement from './components/InventoryManagement'
import BillManagement from './components/BillManagement'
import PaymentManagement from './components/PaymentManagement'
import ChatBot from './components/ChatBot'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('company-profile')
  const [viewParams, setViewParams] = useState({})

  const handleNavigation = (view, params = {}) => {
    setCurrentView(view)
    setViewParams(params)
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'company-profile':
        return <CompanyProfile />
      case 'customers':
        return <CustomerManagement onNavigate={handleNavigation} />
      case 'suppliers':
        return <SupplierManagement />
      case 'inventory':
        return <InventoryManagement />
      case 'bills':
        return <BillManagement customerFilter={viewParams} />
      case 'payments':
        return <PaymentManagement />
      case 'chat':
        return <ChatBot />
      case 'analytics':
        return <div className="p-8 text-center text-muted-foreground">Analytics dashboard coming soon...</div>
      default:
        return <CompanyProfile />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex gap-6 p-6">
        <Navigation currentView={currentView} onViewChange={handleNavigation} />
        <div className="flex-1">
          {renderCurrentView()}
        </div>
      </div>
    </div>
  )
}

export default App