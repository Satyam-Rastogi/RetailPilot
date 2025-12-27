import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { wholesaleLedgerService } from '../services/api'

export interface WholesaleLedgerSummary {
  customer_id: number
  customer_name: string
  customer_type: string
  total_invoiced: number
  total_paid: number
  total_unpaid: number
  last_activity: string | null
  invoice_count: number
  payment_count: number
}

export default function LedgerListPage() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: ledgers, isLoading, error } = useQuery<WholesaleLedgerSummary[]>({
    queryKey: ['wholesaleLedgers'],
    queryFn: () => wholesaleLedgerService.getWholesaleLedgers(),
  })

  const handleCustomerClick = (customerId: number) => {
    navigate(`/customers/${customerId}/ledger`)
  }

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <button
                onClick={() => navigate('/customers')}
                className="text-slate-400 hover:text-amber-400 transition-colors mb-2"
              >
                ← Back to Customers
              </button>
              <h1 className="text-5xl font-display font-bold gradient-text mb-2">
                Wholesale Ledgers
              </h1>
              <p className="text-xl text-slate-400">
                View aggregated invoiced, paid, and unpaid amounts for all wholesale customers
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2 text-slate-300">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2 text-slate-300">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="btn btn-secondary h-[42px] px-6"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400">Loading ledgers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-24 card p-16 rounded-2xl">
              <div className="text-8xl mb-6">❌</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">Error Loading Ledgers</h3>
              <p className="text-slate-400 text-lg mb-6">
                {(error as Error).message || 'Failed to load ledger data'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary px-8"
              >
                Retry
              </button>
            </div>
          ) : !ledgers || ledgers.length === 0 ? (
            <div className="text-center py-24 card p-16 rounded-2xl">
              <div className="text-8xl mb-6">📒</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">No Wholesale Ledgers Found</h3>
              <p className="text-slate-400 text-lg mb-6">
                No wholesale customers available. Please create a customer first.
              </p>
              <button
                onClick={() => navigate('/customers')}
                className="btn btn-primary px-8"
              >
                Go to Customers
              </button>
            </div>
          ) : (
            <div className="card rounded-2xl overflow-hidden">
              <div className="p-6 border-b-2 border-slate-800/30">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-display font-semibold">Wholesale Ledger Summary</h2>
                  <button
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="btn btn-secondary px-4"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                      <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Customer</th>
                      <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Type</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Total Invoiced</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Total Paid</th>
                      <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Total Unpaid</th>
                      <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Last Activity</th>
                      <th className="text-center px-8 py-4 font-display font-semibold text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgers.map((ledger) => (
                      <tr
                        key={ledger.customer_id}
                        className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300 cursor-pointer"
                        onClick={() => handleCustomerClick(ledger.customer_id)}
                      >
                        <td className="px-8 py-4 font-semibold text-slate-100">
                          {ledger.customer_name}
                        </td>
                        <td className="px-8 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm
                            ${ledger.customer_type === 'Wholesale'
                              ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 border-2 border-indigo-500/50 text-indigo-400'
                              : 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                            }`}>
                            🏢 {ledger.customer_type}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right text-slate-100">
                          {ledger.total_invoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-4 text-right text-green-400">
                          {ledger.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-4 text-right text-amber-400">
                          {ledger.total_unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-4 text-slate-400">
                          {ledger.last_activity ? new Date(ledger.last_activity).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-8 py-4 text-center">
                          <button
                            onClick={() => handleCustomerClick(ledger.customer_id)}
                            className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/50 text-amber-400 font-semibold transition-all duration-300 hover:scale-105"
                          >
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-6 bg-slate-800/30 border-2 border-slate-700/50 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-slate-100 mb-2">
                      {ledgers.length}
                    </div>
                    <div className="text-sm text-slate-400">Customers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-slate-100 mb-2">
                      {ledgers.reduce((sum, l) => sum + l.total_invoiced, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-slate-400">Total Invoiced</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-400 mb-2">
                      {ledgers.reduce((sum, l) => sum + l.total_paid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-slate-400">Total Paid</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-amber-400 mb-2">
                      {ledgers.reduce((sum, l) => sum + l.total_unpaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-slate-400">Total Unpaid</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
