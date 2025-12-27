import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { customerService, supplierService, itemService, invoiceService } from '../services/api'

function DashboardPage() {
  const navigate = useNavigate()

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerService.list(),
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.list(),
  })

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => itemService.list(),
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceService.list(),
  })

  const lowStockItems = items?.filter((item: any) => item.is_low_stock) || []

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div 
              className="card p-8 rounded-2xl hover:scale-105 transition-all duration-500 hover:shadow-[0_0_40px_rgba(245,158,11,0.3)] group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse-glow" />
              </div>
              <div className="text-5xl font-display font-bold gradient-text mb-2">
                {customers?.length || 0}
              </div>
              <div className="text-lg text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                Total Customers
              </div>
              <div className="mt-4 h-1 bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full animate-pulse" />
              </div>
            </div>

            <div 
              className="card p-8 rounded-2xl hover:scale-105 transition-all duration-500 hover:shadow-[0_0_40px_rgba(99,102,241,0.3)] group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">🏢</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)] animate-pulse-glow" />
              </div>
              <div className="text-5xl font-display font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                {suppliers?.length || 0}
              </div>
              <div className="text-lg text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                Total Suppliers
              </div>
              <div className="mt-4 h-1 bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" />
              </div>
            </div>

            <div 
              className="card p-8 rounded-2xl hover:scale-105 transition-all duration-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse-glow" />
              </div>
              <div className="text-5xl font-display font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
                {items?.length || 0}
              </div>
              <div className="text-lg text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                Inventory Items
              </div>
              <div className="mt-4 h-1 bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card p-8 rounded-2xl slide-up">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <h2 className="text-3xl font-display font-bold gradient-text">
                  Quick Actions
                </h2>
              </div>
              <div className="space-y-4">
                <div 
                  onClick={() => navigate('/invoices')}
                  className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/30 border-2 border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-lg">📄</span>
                  </div>
                  <span className="font-medium text-slate-300 dark:text-slate-300 light:text-slate-700 group-hover:text-slate-100 transition-colors">Create a new sales invoice</span>
                </div>
                <div 
                  onClick={() => navigate('/customers')}
                  className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/30 border-2 border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-lg">👤</span>
                  </div>
                  <span className="font-medium text-slate-300 dark:text-slate-300 light:text-slate-700 group-hover:text-slate-100 transition-colors">Add a new customer</span>
                </div>
                <div 
                  onClick={() => navigate('/items')}
                  className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/30 border-2 border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-lg">📦</span>
                  </div>
                  <span className="font-medium text-slate-300 dark:text-slate-300 light:text-slate-700 group-hover:text-slate-100 transition-colors">Update inventory</span>
                </div>
              </div>
            </div>

            <div className="card p-8 rounded-2xl slide-up">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center">
                  <span className="text-2xl">📈</span>
                </div>
                <h2 className="text-3xl font-display font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Recent Activity
                </h2>
              </div>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.slice(0, 5).map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border-2 border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center">
                          <span className="text-lg">📄</span>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">
                            {invoice.invoice_number || `INV-${invoice.id}`}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400">
                            {invoice.customer_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold gradient-text">
                          {(invoice.total_amount || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-500 light:text-slate-400">
                          {invoice.payment_status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 dark:text-slate-500 light:text-slate-400 text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-lg">No recent activity</p>
                  <p className="text-sm mt-2">Your recent actions will appear here</p>
                </div>
              )}
            </div>
          </div>

          {lowStockItems.length > 0 && (
            <div className="mt-8 card p-6 rounded-2xl border-2 border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent slide-up">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse-glow">
                  <span className="text-xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-400 dark:text-red-400 light:text-red-600">Low Stock Alert</h3>
                  <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-sm">
                    {lowStockItems.length} item(s) are below their low stock threshold
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockItems.slice(0, 6).map((item: any) => (
                  <div key={item.id} className="p-3 rounded-lg bg-slate-800/50 border-2 border-red-500/30">
                    <div className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800 mb-1">
                      {item.item_name}
                    </div>
                    <div className="text-sm text-red-400 dark:text-red-400 light:text-red-600">
                      Stock: {item.current_stock_quantity} {item.unit_of_measurement}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 card p-6 rounded-2xl border-2 border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse-glow">
                <span className="text-xl">💡</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold gradient-text">Getting Started</h3>
                <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-sm">
                  {customers && customers.length === 0 && suppliers && suppliers.length === 0 && items && items.length === 0
                    ? 'Welcome! Start by setting up your company profile, then add customers, suppliers, and inventory items.'
                    : 'Your dashboard is ready. Use the navigation menu to manage your business operations.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
