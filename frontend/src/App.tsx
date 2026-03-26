import { Routes, Route } from 'react-router-dom'
import Layout from './ui/Layout'
import CustomersPage from './pages/CustomersPage'
import SuppliersPage from './pages/SuppliersPage'
import ItemsPage from './pages/ItemsPage'
import DashboardPage from './pages/DashboardPage'
import CompanyProfilePage from './pages/CompanyProfilePage'
import SalesInvoicesPage from './pages/SalesInvoicesPage'
import LedgerPage from './pages/LedgerPage'
import LedgerListPage from './pages/LedgerListPage'
import InvoiceDetailPage from './pages/InvoiceDetailPage'
import ReturnsListPage from './pages/ReturnsListPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/wholesale-ledgers" element={<LedgerListPage />} />
        <Route path="/customers/:customerId/ledger" element={<LedgerPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/settings" element={<CompanyProfilePage />} />
        <Route path="/invoices" element={<SalesInvoicesPage />} />
        <Route path="/returns" element={<ReturnsListPage />} />
      </Routes>
    </Layout>
  )
}

export default App
