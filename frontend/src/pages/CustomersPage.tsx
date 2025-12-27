import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerService } from '../services/api'
import type { CustomerListResponse } from '../types/api'

function CustomersPage() {
  const [search, setSearch] = useState('')

  const queryClient = useQueryClient()

  const { data: customers, isLoading } = useQuery<CustomerListResponse[]>({
    queryKey: ['customers'],
    queryFn: () => customerService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: customerService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12">
            <div>
              <h1 className="text-5xl font-display font-bold gradient-text mb-2">
                Customers
              </h1>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                Manage your customer database
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search customers by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">Loading customers...</p>
            </div>
          ) : customers && customers.length > 0 ? (
            <div className="card rounded-2xl overflow-hidden slide-up">
              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Customer Name
                      </th>
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Phone Number
                      </th>
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Type
                      </th>

                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer: CustomerListResponse, index: number) => (
                      <tr
                        key={customer.id}
                        className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300 group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                              <span className="text-lg">{customer.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100 dark:text-slate-100 light:text-slate-900 group-hover:text-amber-400 transition-colors">
                                {customer.name}
                              </div>
                              <div className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">
                                {customer.customer_type}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          {customer.phone_number || '-'}
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                            ${customer.customer_type === 'Retail'
                              ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                              : 'bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 border-2 border-indigo-500/50 text-indigo-400'
                            }`}>
                            <span className="text-base">
                              {customer.customer_type === 'Retail' ? '🏪' : '🏢'}
                            </span>
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => handleDelete(customer.id, customer.name)}
                            className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 hover:text-red-300 font-semibold transition-all duration-300 hover:scale-105"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
             <div className="text-center py-24 slide-up card p-16 rounded-2xl">
              <div className="text-8xl mb-6">👤</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">No customers found</h3>
              <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-lg mb-6">
                No customers available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomersPage
