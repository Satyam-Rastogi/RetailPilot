import { Routes, Route } from 'react-router-dom'
import Layout from './ui/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import CustomersPage from './pages/CustomersPage'
import SuppliersPage from './pages/SuppliersPage'
import ItemsPage from './pages/ItemsPage'
import DashboardPage from './pages/DashboardPage'
import CompanyProfilePage from './pages/CompanyProfilePage'
import SettingsPage from './pages/SettingsPage'
import SalesInvoicesPage from './pages/SalesInvoicesPage'
import LedgerPage from './pages/LedgerPage'
import LedgerListPage from './pages/LedgerListPage'
import InvoiceDetailPage from './pages/InvoiceDetailPage'
import ReturnsListPage from './pages/ReturnsListPage'
import StockAuditPage from './pages/StockAuditPage'
import AgingReportPage from './pages/AgingReportPage'
import DailySummaryPage from './pages/DailySummaryPage'
import RevenueAnalyticsPage from './pages/RevenueAnalyticsPage'
import CustomerStatementPage from './pages/CustomerStatementPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/wholesale-ledgers" element={<LedgerListPage />} />
          <Route path="/customers/:customerId/ledger" element={<LedgerPage />} />
          <Route path="/customers/:customerId/statement" element={<CustomerStatementPage />} />
          <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<CompanyProfilePage />} />
          <Route path="/invoices" element={<SalesInvoicesPage />} />
          <Route path="/returns" element={<ReturnsListPage />} />
          <Route path="/stock-audit" element={<StockAuditPage />} />
          <Route path="/reports/aging" element={<AgingReportPage />} />
          <Route path="/reports/daily" element={<DailySummaryPage />} />
          <Route path="/reports/revenue" element={<RevenueAnalyticsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}

export default App
