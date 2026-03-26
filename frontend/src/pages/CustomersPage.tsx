import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerService } from '../services/api'
import type { CustomerListResponse, Customer } from '../types/api'

interface CustomerFormData {
  name: string
  phone_number: string
  email: string
  address: string
  gstin: string
  customer_type: string
  credit_days: number
  notes: string
}

const emptyForm: CustomerFormData = {
  name: '',
  phone_number: '',
  email: '',
  address: '',
  gstin: '',
  customer_type: 'Retail',
  credit_days: 0,
  notes: '',
}

function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [formError, setFormError] = useState('')

  const queryClient = useQueryClient()

  const { data: customers, isLoading } = useQuery<CustomerListResponse[]>({
    queryKey: ['customers'],
    queryFn: () => customerService.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => customerService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowCreateModal(false)
      setFormData(emptyForm)
      setFormError('')
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.detail || 'Failed to create customer')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowEditModal(false)
      setEditingCustomer(null)
      setFormData(emptyForm)
      setFormError('')
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.detail || 'Failed to update customer')
    },
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

  const handleEdit = async (customer: CustomerListResponse) => {
    const detail: Customer = await customerService.get(customer.id)
    setEditingCustomer(detail)
    setFormData({
      name: detail.name || '',
      phone_number: detail.phone_number || '',
      email: detail.email || '',
      address: detail.address || '',
      gstin: detail.gstin || '',
      customer_type: detail.customer_type || 'Retail',
      credit_days: detail.credit_days || 0,
      notes: detail.notes || '',
    })
    setFormError('')
    setShowEditModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Customer name is required')
      return
    }
    const payload = {
      ...formData,
      credit_days: Number(formData.credit_days) || 0,
      phone_number: formData.phone_number || undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      gstin: formData.gstin || undefined,
      notes: formData.notes || undefined,
    }
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filteredCustomers = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const CustomerForm = () => (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {formError && (
        <div className="p-4 rounded-lg bg-red-500/10 border-2 border-red-500/30 text-red-400">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input"
            placeholder="Customer name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">Customer Type</label>
          <select
            value={formData.customer_type}
            onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
            className="input"
          >
            <option value="Retail">Retail</option>
            <option value="Wholesale">Wholesale</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">Phone Number</label>
          <input
            type="tel"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            className="input"
            placeholder="Phone number"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input"
            placeholder="Email address"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">GSTIN</label>
          <input
            type="text"
            value={formData.gstin}
            onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            className="input"
            placeholder="GST identification number"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">
            Credit Days
            <span className="ml-2 text-xs text-slate-500 font-normal">(0 = immediate payment)</span>
          </label>
          <input
            type="number"
            min="0"
            max="365"
            value={formData.credit_days}
            onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
            className="input"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-slate-300">Address</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="input resize-none"
          rows={2}
          placeholder="Business address"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-slate-300">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="input resize-none"
          rows={2}
          placeholder="Internal notes"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => { setShowCreateModal(false); setShowEditModal(false) }}
          className="btn btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="btn btn-primary flex-1"
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Saving...'
            : editingCustomer ? 'Update Customer' : 'Create Customer'}
        </button>
      </div>
    </form>
  )

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
              <button
                onClick={() => { setFormData(emptyForm); setFormError(''); setShowCreateModal(true) }}
                className="btn btn-primary px-6 flex items-center gap-2 whitespace-nowrap"
              >
                <span>+</span> New Customer
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">Loading customers...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="card rounded-2xl overflow-hidden slide-up">
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Customer Name
                      </th>
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Phone / Email
                      </th>
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Type
                      </th>
                      <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                        Credit
                      </th>
                      <th className="text-right px-8 py-6 font-display font-semibold text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer: CustomerListResponse, index: number) => (
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
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          <div>{customer.phone_number || '-'}</div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                            ${customer.customer_type === 'Retail'
                              ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                              : 'bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 border-2 border-indigo-500/50 text-indigo-400'
                            }`}>
                            <span>{customer.customer_type === 'Retail' ? '🏪' : '🏢'}</span>
                            {customer.customer_type}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-slate-400">
                          {customer.credit_days && customer.credit_days > 0
                            ? <span className="text-indigo-400 font-semibold">Net-{customer.credit_days}</span>
                            : <span className="text-slate-600">Immediate</span>
                          }
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-amber-500/20 border-2 border-slate-700/50 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 font-semibold transition-all duration-300 hover:scale-105"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id, customer.name)}
                              className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 hover:text-red-300 font-semibold transition-all duration-300 hover:scale-105"
                            >
                              Delete
                            </button>
                          </div>
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
                {search ? 'No customers match your search' : 'No customers yet — create your first one'}
              </p>
              {!search && (
                <button
                  onClick={() => { setFormData(emptyForm); setFormError(''); setShowCreateModal(true) }}
                  className="btn btn-primary px-8"
                >
                  + New Customer
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b-2 border-slate-800/30">
              <h2 className="text-2xl font-display font-semibold">New Customer</h2>
            </div>
            <CustomerForm />
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b-2 border-slate-800/30">
              <h2 className="text-2xl font-display font-semibold">Edit Customer</h2>
              <p className="text-slate-400 text-sm mt-1">{editingCustomer?.name}</p>
            </div>
            <CustomerForm />
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomersPage
