import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supplierService } from '../services/api'
import type { Supplier, SupplierListResponse } from '../types/api'

function SuppliersPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
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

  const { data: suppliers, isLoading } = useQuery<SupplierListResponse[]>({
    queryKey: ['suppliers', search],
    queryFn: () => supplierService.list({ search: search || undefined }),
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

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone_number: supplier.phone_number || '',
      address: supplier.address || '',
      gstin: supplier.gstin || '',
      supplier_bank_name: supplier.supplier_bank_name || '',
      supplier_bank_account_number: supplier.supplier_bank_account_number || '',
      supplier_bank_ifsc_code: supplier.supplier_bank_ifsc_code || '',
      notes: supplier.notes || '',
    })
    setShowModal(true)
  }

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner">
          <header className="mb-12 slide-up">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] float">
                <span className="text-3xl">🏢</span>
              </div>
              <div>
                <h1 className="text-5xl font-display font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  Suppliers
                </h1>
                <p className="text-xl text-slate-400 font-medium">
                  Manage your supplier database
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search suppliers by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                />
              </div>
              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="btn btn-primary px-8 flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                Add Supplier
              </button>
            </div>
          </header>

          {isLoading ? (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400">Loading suppliers...</p>
            </div>
          ) : suppliers && suppliers.length > 0 ? (
            <div className="card rounded-2xl overflow-hidden slide-up">
              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Supplier Name
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Phone Number
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      GSTIN
                    </th>
                    <th className="text-right px-8 py-6 font-display font-semibold text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier: SupplierListResponse, index: number) => (
                    <tr 
                      key={supplier.id} 
                      className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300 group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center">
                            <span className="text-lg">{supplier.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                            {supplier.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-slate-400">
                        {supplier.phone_number || '-'}
                      </td>
                      <td className="px-8 py-6 text-slate-400">
                        {supplier.gstin || '-'}
                      </td>
                      <td className="px-8 py-6 text-right space-x-3">
                        <button
                          onClick={() => handleEdit(supplier as any)}
                          className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-indigo-500/20 border-2 border-slate-700/50 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 font-semibold transition-all duration-300 hover:scale-105"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
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
              <div className="text-8xl mb-6">🏢</div>
              <h3 className="text-2xl font-display font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">
                No suppliers found
              </h3>
              <p className="text-slate-400 text-lg mb-6">
                Add your first supplier to get started
              </p>
              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="btn btn-primary px-8"
              >
                Add First Supplier
              </button>
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
              <div className="card card-dark p-10 rounded-3xl max-w-2xl w-full mx-4 scale-in overflow-y-auto max-h-[90vh] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-display font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all duration-300"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300">
                      Supplier Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input"
                      placeholder="Enter supplier name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        className="input"
                        placeholder="Contact person name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="input"
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300">
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="input resize-none"
                      rows={3}
                      placeholder="Enter supplier address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                      className="input"
                      placeholder="Enter GSTIN number"
                    />
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-5 bg-slate-800/30">
                    <h4 className="font-semibold text-slate-300 mb-4 flex items-center gap-2">
                      <span className="text-xl">🏦</span>
                      Bank Details
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={formData.supplier_bank_name}
                          onChange={(e) => setFormData({ ...formData, supplier_bank_name: e.target.value })}
                          className="input"
                          placeholder="Bank name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-400">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={formData.supplier_bank_account_number}
                            onChange={(e) => setFormData({ ...formData, supplier_bank_account_number: e.target.value })}
                            className="input"
                            placeholder="Account number"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-400">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={formData.supplier_bank_ifsc_code}
                            onChange={(e) => setFormData({ ...formData, supplier_bank_ifsc_code: e.target.value })}
                            className="input"
                            placeholder="IFSC code"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="input resize-none"
                      rows={3}
                      placeholder="Additional notes about this supplier"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Supplier'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SuppliersPage
