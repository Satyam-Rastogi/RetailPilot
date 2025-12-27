import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { itemService } from '../services/api'
import type { Item, ItemListResponse, StockAdjust } from '../types/api'

function ItemsPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [stockAdjustmentItem, setStockAdjustmentItem] = useState<ItemListResponse | null>(null)
  const [stockAdjustment, setStockAdjustment] = useState({ delta: '', reason: '' })

  const queryClient = useQueryClient()

  const { data: items, isLoading } = useQuery<ItemListResponse[]>({
    queryKey: ['items', search],
    queryFn: () => itemService.list({ search: search || undefined }),
  })

  const createMutation = useMutation({
    mutationFn: itemService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowModal(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => itemService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowModal(false)
      resetForm()
    },
  })

  const stockAdjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: StockAdjust }) => itemService.adjustStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setShowStockModal(false)
      setStockAdjustment({ delta: '', reason: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: itemService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  const resetForm = () => {
    setEditingItem(null)
    setFormData({
      item_name: '',
      brand_name: '',
      sku: '',
      material: '',
      purchase_price: '',
      selling_price_retail: '',
      selling_price_wholesale: '',
      current_stock_quantity: '',
      unit_of_measurement: 'Pcs',
      low_stock_threshold: '',
      enable_low_stock_alert: false,
    })
  }

  const [formData, setFormData] = useState({
    item_name: '',
    brand_name: '',
    sku: '',
    material: '',
    purchase_price: '',
    selling_price_retail: '',
    selling_price_wholesale: '',
    current_stock_quantity: '',
    unit_of_measurement: 'Pcs',
    low_stock_threshold: '',
    enable_low_stock_alert: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      selling_price_retail: parseFloat(formData.selling_price_retail),
      selling_price_wholesale: parseFloat(formData.selling_price_wholesale),
      current_stock_quantity: parseInt(formData.current_stock_quantity),
      low_stock_threshold: formData.low_stock_threshold ? parseInt(formData.low_stock_threshold) : null,
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = async (item: ItemListResponse) => {
    const fullItem = await itemService.get(item.id)
    setEditingItem(fullItem)
    setFormData({
      item_name: fullItem.item_name,
      brand_name: fullItem.brand_name,
      sku: fullItem.sku || '',
      material: fullItem.material || '',
      purchase_price: fullItem.purchase_price?.toString() || '',
      selling_price_retail: fullItem.selling_price_retail.toString(),
      selling_price_wholesale: fullItem.selling_price_wholesale.toString(),
      current_stock_quantity: fullItem.current_stock_quantity?.toString() || '0',
      unit_of_measurement: fullItem.unit_of_measurement || 'Pcs',
      low_stock_threshold: fullItem.low_stock_threshold?.toString() || '',
      enable_low_stock_alert: fullItem.enable_low_stock_alert || false,
    })
    setShowModal(true)
  }

  const handleStockAdjust = (item: ItemListResponse) => {
    setStockAdjustmentItem(item)
    setStockAdjustment({ delta: '', reason: '' })
    setShowStockModal(true)
  }

  const handleQuickStockChange = (item: ItemListResponse, delta: number) => {
    if (item.current_stock_quantity + delta >= 0) {
      const payload: StockAdjust = {
        delta,
        reason: delta > 0 ? 'Quick stock addition' : 'Quick stock decrease',
      }
      stockAdjustMutation.mutate({ id: item.id, data: payload })
    }
  }

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockAdjustmentItem) return

    const newQuantity = stockAdjustmentItem.current_stock_quantity + parseInt(stockAdjustment.delta)
    if (newQuantity < 0) {
      alert('Stock quantity cannot be negative')
      return
    }

    const payload: StockAdjust = {
      delta: parseInt(stockAdjustment.delta),
      reason: stockAdjustment.reason || undefined,
    }
    stockAdjustMutation.mutate({ id: stockAdjustmentItem.id, data: payload })
  }

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner">
          <header className="mb-12 slide-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-5xl font-display font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
                  Inventory
                </h1>
                <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                  Manage your product inventory and stock levels
                </p>
              </div>

              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="btn btn-primary px-8 flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                Add Item
              </button>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search items by name or brand..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </header>

          {isLoading ? (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">Loading inventory...</p>
            </div>
          ) : items && items.length > 0 ? (
            <div className="card rounded-2xl overflow-hidden slide-up">
              <div className="overflow-x-auto">
                <table className="min-w-[1400px] w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Item Name
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Brand
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      SKU
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Stock
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Retail Price
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Wholesale Price
                    </th>
                    <th className="text-left px-8 py-6 font-display font-semibold text-slate-300">
                      Status
                    </th>
                    <th className="text-right px-8 py-6 font-display font-semibold text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: ItemListResponse, index: number) => (
                    <tr 
                      key={item.id} 
                      className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300 group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                            <span className="text-lg">📦</span>
                          </div>
                          <span className="font-semibold text-slate-100 dark:text-slate-100 light:text-slate-900 group-hover:text-emerald-400 transition-colors">
                            {item.item_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">{item.brand_name}</td>
                      <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                        <span className="px-3 py-1 rounded-lg bg-slate-800/50 dark:bg-slate-800/50 light:bg-slate-200/50 border-2 border-slate-700/50 dark:border-slate-700/50 light:border-slate-200/50 text-sm">
                          {item.sku || '-'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleQuickStockChange(item, -1)}
                            disabled={item.current_stock_quantity <= 0}
                            className="w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-slate-400 hover:text-red-400 dark:text-slate-400 light:text-slate-600 flex items-center justify-center font-bold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <span className={item.is_low_stock ? 'text-red-400 dark:text-red-400 light:text-red-600 font-bold' : 'text-slate-300 dark:text-slate-300 light:text-slate-700'}>
                            {item.current_stock_quantity} {item.unit_of_measurement}
                          </span>
                          <button
                            onClick={() => handleQuickStockChange(item, 1)}
                            className="w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-emerald-500/20 border-2 border-slate-700/50 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 dark:text-slate-400 light:text-slate-600 flex items-center justify-center font-bold transition-all duration-300"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleStockAdjust(item)}
                            className="w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-amber-500/20 border-2 border-slate-700/50 hover:border-amber-500/50 text-slate-400 hover:text-amber-400 dark:text-slate-400 light:text-slate-600 flex items-center justify-center transition-all duration-300"
                            title="Adjust stock"
                          >
                            ⚙️
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                        {item.selling_price_retail.toFixed(2)}
                      </td>
                      <td className="px-8 py-6 text-slate-400 dark:text-slate-400 light:text-slate-600">
                        {item.selling_price_wholesale.toFixed(2)}
                      </td>
                      <td className="px-8 py-6">
                        {item.is_low_stock && (
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-red-500/20 to-rose-500/5 border-2 border-red-500/50 text-red-400 dark:text-red-400 light:text-red-600 text-sm font-semibold">
                            <span className="text-base">⚠️</span>
                            Low Stock
                          </span>
                        )}
                        {item.enable_low_stock_alert && !item.is_low_stock && (
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/5 border-2 border-amber-500/50 text-amber-400 text-sm font-semibold">
                            <span className="text-base">🔔</span>
                            Alert Enabled
                          </span>
                        )}
                        {!item.enable_low_stock_alert && (
                          <span className="text-slate-500 dark:text-slate-500 light:text-slate-400 text-sm">No Alert</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right space-x-3">
                        <button
                          onClick={() => handleEdit(item)}
                          className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-emerald-500/20 border-2 border-slate-700/50 hover:border-emerald-500/50 text-emerald-400 dark:text-emerald-400 light:text-emerald-600 hover:text-emerald-300 dark:hover:text-emerald-300 light:hover:text-emerald-500 font-semibold transition-all duration-300 hover:scale-105"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.item_name)}
                          className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-red-400 dark:text-red-400 light:text-red-600 hover:text-red-300 dark:hover:text-red-300 light:hover:text-red-500 font-semibold transition-all duration-300 hover:scale-105"
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
              <div className="text-8xl mb-6">📦</div>
              <h3 className="text-2xl font-display font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-3">
                No items found
              </h3>
              <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-lg mb-6">
                Add your first item to get started
              </p>
              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="btn btn-primary px-8"
              >
                Add First Item
              </button>
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
              <div className="card card-dark p-10 rounded-3xl max-w-3xl w-full mx-4 scale-in overflow-y-auto max-h-[90vh] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-display font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {editingItem ? 'Edit Item' : 'Add New Item'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-slate-400 dark:text-slate-400 light:text-slate-600 hover:text-red-400 flex items-center justify-center transition-all duration-300"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.item_name}
                        onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                        className="input"
                        placeholder="e.g., Silk Saree"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                        Brand Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.brand_name}
                        onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                        className="input"
                        placeholder="e.g., Kanjeevaram"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                        SKU / Item Code
                      </label>
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="input"
                        placeholder="e.g., SKU-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                        Material
                      </label>
                      <input
                        type="text"
                        value={formData.material}
                        onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                        className="input"
                        placeholder="e.g., Silk, Cotton"
                      />
                    </div>
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-5 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h4 className="font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700 mb-4 flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      Pricing
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Purchase Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.purchase_price}
                          onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                          className="input"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Retail Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.selling_price_retail}
                          onChange={(e) => setFormData({ ...formData, selling_price_retail: e.target.value })}
                          className="input"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Wholesale Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.selling_price_wholesale}
                          onChange={(e) => setFormData({ ...formData, selling_price_wholesale: e.target.value })}
                          className="input"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-5 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h4 className="font-semibold text-s-slate-300 dark:text-slate-300 light:text-slate-700 mb-4 flex items-center gap-2">
                      <span className="text-xl">📊</span>
                      Stock Management
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Current Stock *
                        </label>
                        <input
                          type="number"
                          required
                          value={formData.current_stock_quantity}
                          onChange={(e) => setFormData({ ...formData, current_stock_quantity: e.target.value })}
                          className="input"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Unit of Measurement
                        </label>
                        <input
                          type="text"
                          value={formData.unit_of_measurement}
                          onChange={(e) => setFormData({ ...formData, unit_of_measurement: e.target.value })}
                          className="input"
                          placeholder="Pcs"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Low Stock Threshold
                        </label>
                        <input
                          type="number"
                          value={formData.low_stock_threshold}
                          onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                          className="input"
                          placeholder="5"
                          disabled={!formData.enable_low_stock_alert}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <input
                        type="checkbox"
                        id="enable_low_stock_alert"
                        checked={formData.enable_low_stock_alert}
                        onChange={(e) => setFormData({ ...formData, enable_low_stock_alert: e.target.checked })}
                        className="w-5 h-5 accent-amber-500"
                      />
                      <label htmlFor="enable_low_stock_alert" className="text-sm font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">
                        Enable Low Stock Alert
                      </label>
                    </div>
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
                      {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Item'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showStockModal && stockAdjustmentItem && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
              <div className="card card-dark p-8 rounded-3xl max-w-md w-full mx-4 scale-in shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                      <span className="text-xl">📊</span>
                    </div>
                    <h2 className="text-2xl font-display font-bold gradient-text">
                      Adjust Stock
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowStockModal(false)}
                    className="w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-slate-400 dark:text-slate-400 light:text-slate-600 hover:text-red-400 flex items-center justify-center transition-all duration-300"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-6 p-4 rounded-xl bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                  <h3 className="font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700 mb-2">{stockAdjustmentItem.item_name}</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">
                    Current Stock: <span className="font-semibold text-slate-200 dark:text-slate-200 light:text-slate-700">{stockAdjustmentItem.current_stock_quantity} {stockAdjustmentItem.unit_of_measurement}</span>
                  </p>
                </div>

                <form onSubmit={handleStockSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                      Adjustment (+ / -)
                    </label>
                    <input
                      type="number"
                      required
                      value={stockAdjustment.delta}
                      onChange={(e) => setStockAdjustment({ ...stockAdjustment, delta: e.target.value })}
                      className="input"
                      placeholder="Enter quantity to add/remove (e.g., 10 or -5)"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-500 light:text-slate-400 mt-2">
                      Enter positive number to add stock, negative number to remove
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                      Reason (optional)
                    </label>
                    <input
                      type="text"
                      value={stockAdjustment.reason}
                      onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                      className="input"
                      placeholder="e.g., Sale, Purchase, Damaged goods"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowStockModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={stockAdjustMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {stockAdjustMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
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

export default ItemsPage
