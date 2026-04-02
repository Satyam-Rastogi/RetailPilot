import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { customerService } from '../services/api'
import type { CustomerListResponse, Customer, PaginatedResponse } from '../types/api'
import Pagination from '../components/Pagination'
import { MagneticButton } from '../components/MagneticButton'
import { cn } from '../lib/utils'

const PAGE_SIZE = 20

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
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [formError, setFormError] = useState('')

  const queryClient = useQueryClient()

  useEffect(() => { setPage(1) }, [search])

  const { data: customers, isLoading } = useQuery<PaginatedResponse<CustomerListResponse>>({
    queryKey: ['customers', search, page],
    queryFn: () => customerService.list({ search: search || undefined, page, page_size: PAGE_SIZE }),
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

  const closeModal = () => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setFormError('')
  }

  const typeBadge = (type: string) => cn(
    'px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border',
    type === 'Retail' && 'border-line text-ink-light',
    type === 'Wholesale' && 'bg-accent text-on-accent border-accent',
  )

  const rows = customers?.data ?? []

  const CustomerModal = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    useModalKeyboard(true, closeModal, containerRef)
    return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
      <div ref={containerRef} className="brutal-border bg-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
          <h2 className="font-display font-bold text-xl uppercase tracking-tighter">
            {editingCustomer ? 'Edit Customer' : 'New Customer'}
          </h2>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="customer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {formError && (
            <div className="px-4 py-3 border border-danger text-danger font-mono text-xs uppercase tracking-wider">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cust-name" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                Name *
              </label>
              <input
                id="cust-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="Customer name"
                required
                aria-required="true"
              />
            </div>
            <div>
              <label htmlFor="cust-type" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                Customer Type
              </label>
              <select
                id="cust-type"
                name="customer_type"
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cust-phone" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                Phone Number
              </label>
              <input
                id="cust-phone"
                name="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label htmlFor="cust-email" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                Email
              </label>
              <input
                id="cust-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="Email address"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cust-gstin" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                GSTIN
              </label>
              <input
                id="cust-gstin"
                name="gstin"
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="GST identification number"
              />
            </div>
            <div>
              <label htmlFor="cust-credit-days" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                Credit Days <span className="normal-case tracking-normal">(0 = immediate)</span>
              </label>
              <input
                id="cust-credit-days"
                name="credit_days"
                type="number"
                min="0"
                max="365"
                value={formData.credit_days}
                onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cust-address" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
              Address
            </label>
            <textarea
              id="cust-address"
              name="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors resize-none"
              rows={2}
              placeholder="Business address"
            />
          </div>

          <div>
            <label htmlFor="cust-notes" className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
              Notes
            </label>
            <textarea
              id="cust-notes"
              name="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors resize-none"
              rows={2}
              placeholder="Internal notes"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
          <button
            type="button"
            onClick={closeModal}
            className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : editingCustomer ? 'Update Customer' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  , document.body)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tighter uppercase">Customers</h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">
            {customers?.total_items ?? 0} total
          </p>
        </div>
        <MagneticButton strength={0.5}>
          <button
            onClick={() => { setFormData(emptyForm); setFormError(''); setEditingCustomer(null); setShowCreateModal(true) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </MagneticButton>
      </header>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light font-mono text-xs" aria-hidden="true">//</span>
        <label htmlFor="customer-search" className="sr-only">Search customers</label>
        <input
          id="customer-search"
          name="customer-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-4 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
          placeholder="SEARCH CUSTOMERS..."
          aria-label="Search customers"
        />
      </div>

      {/* Table / States */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading...</p>
        </div>
      ) : rows.length > 0 ? (
        <div className="brutal-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-[540px] w-full" aria-label="Customer list">
            <thead>
              <tr className="bg-surface text-ink-light border-b border-line">
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Phone</th>
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Type</th>
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Credit Days</th>
                <th scope="col" className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((customer: CustomerListResponse) => (
                <tr key={customer.id} className="hover:bg-ink hover:text-surface transition-colors group">
                  <td className="px-4 py-3 font-mono text-sm font-medium">{customer.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-ink-light group-hover:text-surface">
                    {customer.phone_number || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={typeBadge(customer.customer_type)}>
                      {customer.customer_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-ink-light group-hover:text-surface">
                    {customer.credit_days && customer.credit_days > 0
                      ? `Net-${customer.credit_days}`
                      : <span className="opacity-40">Immediate</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id, customer.name)}
                        className="p-1.5 brutal-border hover:bg-danger hover:text-paper hover:border-danger transition-colors brutal-focus"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={customers?.total_pages ?? 1}
            totalItems={customers?.total_items ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-1">No customers found</p>
          <p className="font-mono text-xs text-ink-light opacity-60">
            {search ? 'No customers match your search' : 'Create your first customer to get started'}
          </p>
          {!search && (
            <button
              onClick={() => { setFormData(emptyForm); setFormError(''); setEditingCustomer(null); setShowCreateModal(true) }}
              className="mt-6 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
            >
              Add Customer
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {(showCreateModal || showEditModal) && <CustomerModal />}
    </div>
  )
}

export default CustomersPage
