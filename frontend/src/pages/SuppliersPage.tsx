import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { supplierService } from '../services/api'
import type { Supplier, SupplierListResponse, PaginatedResponse } from '../types/api'
import Pagination from '../components/Pagination'
import { MagneticButton } from '../components/MagneticButton'

const PAGE_SIZE = 20

function SuppliersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const page   = parseInt(searchParams.get('page') ?? '1')
  const setSearch = (v: string) => setSearchParams(p => { const n = new URLSearchParams(p); v ? n.set('q', v) : n.delete('q'); n.set('page', '1'); return n }, { replace: true })
  const setPage   = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })

  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(showModal, () => setShowModal(false), modalRef)
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone_number: '',
    address: '',
    gstin: '',
    supplier_bank_name: '',
    supplier_bank_account_number: '',
    supplier_bank_ifsc_code: '',
    notes: '',
  })

  const queryClient = useQueryClient()

  const { data: suppliers, isLoading } = useQuery<PaginatedResponse<SupplierListResponse>>({
    queryKey: ['suppliers', search, page],
    queryFn: () => supplierService.list({ search: search || undefined, page, page_size: PAGE_SIZE }),
  })

  const createMutation = useMutation({
    mutationFn: supplierService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setShowModal(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => supplierService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setShowModal(false)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: supplierService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone_number: '',
      address: '',
      gstin: '',
      supplier_bank_name: '',
      supplier_bank_account_number: '',
      supplier_bank_ifsc_code: '',
      notes: '',
    })
    setEditingSupplier(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = async (supplier: SupplierListResponse) => {
    const fullSupplier: Supplier = await supplierService.get(supplier.id)
    setEditingSupplier(fullSupplier)
    setFormData({
      name: fullSupplier.name,
      contact_person: fullSupplier.contact_person || '',
      phone_number: fullSupplier.phone_number || '',
      address: fullSupplier.address || '',
      gstin: fullSupplier.gstin || '',
      supplier_bank_name: fullSupplier.supplier_bank_name || '',
      supplier_bank_account_number: fullSupplier.supplier_bank_account_number || '',
      supplier_bank_ifsc_code: fullSupplier.supplier_bank_ifsc_code || '',
      notes: fullSupplier.notes || '',
    })
    setShowModal(true)
  }

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const rows = suppliers?.data ?? []

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tighter uppercase">Suppliers</h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-2">
            {suppliers?.total_items ?? 0} total
          </p>
        </div>
        <MagneticButton strength={0.5}>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </MagneticButton>
      </header>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light font-mono text-xs">//</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-4 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
          placeholder="SEARCH SUPPLIERS..."
        />
      </div>

      {/* Table / States */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading...</p>
        </div>
      ) : rows.length > 0 ? (
        <div className="brutal-border bg-surface overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface text-ink-light border-b border-line">
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Name</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Phone</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">GSTIN</th>
                <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((supplier: SupplierListResponse) => (
                <tr key={supplier.id} className="hover:bg-ink hover:text-surface transition-colors group">
                  <td className="px-4 py-3 font-mono text-sm font-medium">{supplier.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-ink-light group-hover:text-surface">
                    {supplier.phone_number || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-ink-light group-hover:text-surface">
                    {supplier.gstin || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id, supplier.name)}
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
          <Pagination
            currentPage={page}
            totalPages={suppliers?.total_pages ?? 1}
            totalItems={suppliers?.total_items ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-1">No suppliers found</p>
          <p className="font-mono text-xs text-ink-light opacity-60">
            {search ? 'No suppliers match your search' : 'Add your first supplier to get started'}
          </p>
          {!search && (
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="mt-6 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
            >
              Add Supplier
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div ref={modalRef} className="brutal-border bg-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <h2 className="font-display font-bold text-xl uppercase tracking-tighter">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form id="supplier-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder="Enter supplier name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="Contact person name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                  rows={3}
                  placeholder="Enter supplier address"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder="Enter GSTIN number"
                />
              </div>

              {/* Bank Details Section */}
              <div className="brutal-border bg-paper p-4 space-y-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Bank Details</p>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_bank_name}
                    onChange={(e) => setFormData({ ...formData, supplier_bank_name: e.target.value })}
                    className="w-full px-3 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="Bank name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.supplier_bank_account_number}
                      onChange={(e) => setFormData({ ...formData, supplier_bank_account_number: e.target.value })}
                      className="w-full px-3 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={formData.supplier_bank_ifsc_code}
                      onChange={(e) => setFormData({ ...formData, supplier_bank_ifsc_code: e.target.value })}
                      className="w-full px-3 py-2.5 brutal-border bg-surface text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                      placeholder="IFSC code"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                  rows={3}
                  placeholder="Additional notes about this supplier"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="supplier-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}

export default SuppliersPage
