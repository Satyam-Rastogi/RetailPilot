import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

const API_BASE_URL = 'http://localhost:5000/api'

export default function InventoryManagement() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [stockAdjustment, setStockAdjustment] = useState({ productId: null, quantity: 0, reason: '' })
  const [summary, setSummary] = useState({ total_products: 0, total_stock_value: 0, low_stock_count: 0 })
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category: '',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock_level: '',
    max_stock_level: '',
    unit_of_measurement: 'pcs',
    barcode: '',
    tax_rate: ''
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [searchTerm, selectedCategory, showLowStock])

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory) params.append('category', selectedCategory)
      if (showLowStock) params.append('low_stock', 'true')
      
      const response = await fetch(`${API_BASE_URL}/products?${params}`)
      const data = await response.json()
      setProducts(data.products || [])
      setSummary(data.summary || { total_products: 0, total_stock_value: 0, low_stock_count: 0 })
      setLoading(false)
    } catch (error) {
      console.error('Error fetching products:', error)
      setMessage('Error loading products')
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/categories`)
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingProduct 
        ? `${API_BASE_URL}/products/${editingProduct.id}`
        : `${API_BASE_URL}/products`
      
      const method = editingProduct ? 'PUT' : 'POST'
      
      // Convert string values to appropriate types
      const submitData = {
        ...formData,
        unit_price: parseFloat(formData.unit_price) || 0,
        cost_price: parseFloat(formData.cost_price) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        min_stock_level: parseInt(formData.min_stock_level) || 0,
        max_stock_level: parseInt(formData.max_stock_level) || 1000,
        tax_rate: parseFloat(formData.tax_rate) || 0
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        setMessage(`Product ${editingProduct ? 'updated' : 'created'} successfully!`)
        setIsDialogOpen(false)
        resetForm()
        fetchProducts()
        fetchCategories()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorData = await response.json()
        setMessage(`Error: ${errorData.error || 'Failed to save product'}`)
      }
    } catch (error) {
      console.error('Error saving product:', error)
      setMessage('Error saving product')
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      category: product.category || '',
      unit_price: product.unit_price.toString(),
      cost_price: product.cost_price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      min_stock_level: product.min_stock_level.toString(),
      max_stock_level: product.max_stock_level.toString(),
      unit_of_measurement: product.unit_of_measurement || 'pcs',
      barcode: product.barcode || '',
      tax_rate: product.tax_rate.toString()
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setMessage('Product deleted successfully!')
          fetchProducts()
          setTimeout(() => setMessage(''), 3000)
        } else {
          setMessage('Error deleting product')
        }
      } catch (error) {
        console.error('Error deleting product:', error)
        setMessage('Error deleting product')
      }
    }
  }

  const handleStockAdjustment = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${stockAdjustment.productId}/stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity_change: parseInt(stockAdjustment.quantity),
          reason: stockAdjustment.reason || 'manual_adjustment'
        }),
      })

      if (response.ok) {
        setMessage('Stock adjusted successfully!')
        setIsStockDialogOpen(false)
        setStockAdjustment({ productId: null, quantity: 0, reason: '' })
        fetchProducts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorData = await response.json()
        setMessage(`Error: ${errorData.error || 'Failed to adjust stock'}`)
      }
    } catch (error) {
      console.error('Error adjusting stock:', error)
      setMessage('Error adjusting stock')
    }
  }

  const openStockDialog = (product) => {
    setStockAdjustment({ productId: product.id, quantity: 0, reason: '' })
    setIsStockDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      category: '',
      unit_price: '',
      cost_price: '',
      stock_quantity: '',
      min_stock_level: '',
      max_stock_level: '',
      unit_of_measurement: 'pcs',
      barcode: '',
      tax_rate: ''
    })
    setEditingProduct(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const filteredProducts = products

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Inventory Management</h1>
      </div>

      {message && (
        <div className={`p-3 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{summary.total_products}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Stock Value</p>
                <p className="text-2xl font-bold">₹{summary.total_stock_value.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold">{summary.low_stock_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Manage your product inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-[180px] p-2 border border-gray-300 rounded-md"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <Button
              variant={showLowStock ? "default" : "outline"}
              onClick={() => setShowLowStock(!showLowStock)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProduct ? 'Update product information' : 'Enter product details to add to your inventory'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit_of_measurement">Unit</Label>
                      <select 
                        id="unit_of_measurement"
                        name="unit_of_measurement"
                        value={formData.unit_of_measurement} 
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="pcs">Pieces</option>
                        <option value="kg">Kilograms</option>
                        <option value="ltr">Liters</option>
                        <option value="mtr">Meters</option>
                        <option value="box">Box</option>
                        <option value="set">Set</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unit_price">Unit Price (₹) *</Label>
                      <Input
                        id="unit_price"
                        name="unit_price"
                        type="number"
                        step="0.01"
                        value={formData.unit_price}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost_price">Cost Price (₹)</Label>
                      <Input
                        id="cost_price"
                        name="cost_price"
                        type="number"
                        step="0.01"
                        value={formData.cost_price}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                      <Input
                        id="stock_quantity"
                        name="stock_quantity"
                        type="number"
                        value={formData.stock_quantity}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min_stock_level">Min Stock</Label>
                      <Input
                        id="min_stock_level"
                        name="min_stock_level"
                        type="number"
                        value={formData.min_stock_level}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_stock_level">Max Stock</Label>
                      <Input
                        id="max_stock_level"
                        name="max_stock_level"
                        type="number"
                        value={formData.max_stock_level}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input
                        id="barcode"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                      <Input
                        id="tax_rate"
                        name="tax_rate"
                        type="number"
                        step="0.01"
                        value={formData.tax_rate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingProduct ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No products found. Add your first product to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground">{product.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.sku || '-'}</TableCell>
                      <TableCell>{product.category || '-'}</TableCell>
                      <TableCell>₹{product.unit_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{product.stock_quantity} {product.unit_of_measurement}</span>
                          {product.is_low_stock && (
                            <Badge variant="destructive" className="text-xs">
                              Low Stock
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>₹{product.stock_value.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStockDialog(product)}
                            title="Adjust stock"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            title="Edit product"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Increase or decrease stock quantity. Use positive numbers to add stock, negative to reduce.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity_change">Quantity Change</Label>
              <Input
                id="quantity_change"
                type="number"
                value={stockAdjustment.quantity}
                onChange={(e) => setStockAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="e.g., +10 or -5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <select 
                id="reason"
                value={stockAdjustment.reason} 
                onChange={(e) => setStockAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="manual_adjustment">Manual Adjustment</option>
                <option value="stock_received">Stock Received</option>
                <option value="stock_damaged">Stock Damaged</option>
                <option value="stock_sold">Stock Sold</option>
                <option value="stock_returned">Stock Returned</option>
                <option value="inventory_count">Inventory Count</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStockDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStockAdjustment}>
                Adjust Stock
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

