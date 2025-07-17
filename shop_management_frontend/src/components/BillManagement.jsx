import { useState, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Plus, FileText, Eye, Edit, Trash2, DollarSign, Search } from 'lucide-react'

const BillManagement = ({ customerFilter = null }) => {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [filter, setFilter] = useState({
    type: 'all',
    status: 'all',
    search: ''
  })

  // Customer search state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    invoice_type: 'sales',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    customer_gst: '',
    supplier_id: '',
    notes: '',
    terms_conditions: '',
    line_items: [
      {
        product_id: '',
        item_name: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 18
      }
    ]
  })

  // Initialize Fuse.js for customer search
  const customerFuse = useMemo(() => {
    if (customers.length === 0) return null
    return new Fuse(customers, {
      keys: ['name', 'phone', 'address'],
      threshold: 0.3,
      includeScore: true
    })
  }, [customers])

  useEffect(() => {
    fetchInvoices()
    fetchCustomers()
    fetchSuppliers()
    fetchProducts()
  }, [])

  useEffect(() => {
    if (customerFilter) {
      setFilter(prev => ({ ...prev, customer_id: customerFilter.customerId }))
    }
  }, [customerFilter])

  // Handle customer search
  useEffect(() => {
    if (!customerFuse || !customerSearchTerm.trim()) {
      setCustomerSuggestions([])
      setShowCustomerSuggestions(false)
      return
    }

    const results = customerFuse.search(customerSearchTerm)
    setCustomerSuggestions(results.slice(0, 5)) // Show top 5 matches
    setShowCustomerSuggestions(true)
  }, [customerSearchTerm, customerFuse])

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams()
      if (filter.type !== 'all') params.append('type', filter.type)
      if (filter.status !== 'all') params.append('status', filter.status)
      if (filter.search) params.append('search', filter.search)
      if (customerFilter?.customerId) params.append('customer_id', customerFilter.customerId)

      const response = await fetch(`http://localhost:5000/api/invoices?${params}`)
      const data = await response.json()
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/customers')
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/suppliers')
      const data = await response.json()
      setSuppliers(data.suppliers || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/products')
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer)
    setCustomerSearchTerm(customer.name)
    setNewInvoice(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone || '',
      customer_address: customer.address || '',
      customer_gst: customer.gstin || '',
      customer_id: customer.id
    }))
    setShowCustomerSuggestions(false)
  }

  const handleCustomerNameChange = (value) => {
    setCustomerSearchTerm(value)
    setNewInvoice(prev => ({
      ...prev,
      customer_name: value,
      // Clear other fields if typing new name
      customer_phone: selectedCustomer?.name === value ? prev.customer_phone : '',
      customer_address: selectedCustomer?.name === value ? prev.customer_address : '',
      customer_gst: selectedCustomer?.name === value ? prev.customer_gst : '',
      customer_id: selectedCustomer?.name === value ? prev.customer_id : ''
    }))
    
    if (value !== selectedCustomer?.name) {
      setSelectedCustomer(null)
    }
  }

  const handleCreateInvoice = async () => {
    try {
      // Prepare invoice data
      const invoiceData = {
        ...newInvoice,
        // If we have a selected customer, use customer_id, otherwise create with just name
        customer_id: selectedCustomer?.id || null,
        // For new customers, we'll handle this in the backend
        customer_details: selectedCustomer ? null : {
          name: newInvoice.customer_name,
          phone: newInvoice.customer_phone,
          address: newInvoice.customer_address,
          gstin: newInvoice.customer_gst
        }
      }

      const response = await fetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      })

      if (response.ok) {
        const data = await response.json()
        setInvoices(prev => [data, ...prev])
        setShowCreateDialog(false)
        resetNewInvoice()
        alert('Invoice created successfully!')
        // Refresh customers list in case a new customer was created
        fetchCustomers()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Error creating invoice')
    }
  }

  const resetNewInvoice = () => {
    setNewInvoice({
      invoice_type: 'sales',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      customer_gst: '',
      supplier_id: '',
      notes: '',
      terms_conditions: '',
      line_items: [
        {
          product_id: '',
          item_name: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 18
        }
      ]
    })
    setCustomerSearchTerm('')
    setSelectedCustomer(null)
    setShowCustomerSuggestions(false)
  }

  const addLineItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          product_id: '',
          item_name: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 18
        }
      ]
    }))
  }

  const updateLineItem = (index, field, value) => {
    setNewInvoice(prev => ({
      ...prev,
      line_items: prev.line_items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const removeLineItem = (index) => {
    if (newInvoice.line_items.length > 1) {
      setNewInvoice(prev => ({
        ...prev,
        line_items: prev.line_items.filter((_, i) => i !== index)
      }))
    }
  }

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === parseInt(productId))
    if (product) {
      updateLineItem(index, 'product_id', productId)
      updateLineItem(index, 'item_name', product.name)
      updateLineItem(index, 'unit_price', product.unit_price)
      updateLineItem(index, 'tax_rate', product.tax_rate)
    }
  }

  const getStatusBadge = (status) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const calculateLineTotal = (item) => {
    const subtotal = item.quantity * item.unit_price
    const tax = subtotal * (item.tax_rate / 100)
    return subtotal + tax
  }

  const calculateInvoiceTotal = () => {
    return newInvoice.line_items.reduce((total, item) => total + calculateLineTotal(item), 0)
  }

  if (loading) {
    return <div className="p-8 text-center">Loading bills and invoices...</div>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Bills & Invoices</h1>
          {customerFilter && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800">
                <strong>Filtered by Customer:</strong> {customerFilter.customerName}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Customer ID: {customerFilter.customerId}
              </p>
            </div>
          )}
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Invoice Type and Date - Horizontal Layout */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-base font-semibold">Invoice Type</Label>
                  <Select 
                    value={newInvoice.invoice_type} 
                    onValueChange={(value) => setNewInvoice(prev => ({ ...prev, invoice_type: value }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Invoice</SelectItem>
                      <SelectItem value="purchase">Purchase Bill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-semibold">Invoice Date</Label>
                  <Input 
                    type="date" 
                    className="h-11"
                    value={newInvoice.invoice_date}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold">Due Date</Label>
                  <Input 
                    type="date" 
                    className="h-11"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-800">
                      Total: ₹{calculateInvoiceTotal().toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content - Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* Left Column - Customer/Supplier Details */}
                <div>
                  {/* Customer Details Section */}
                  {newInvoice.invoice_type === 'sales' && (
                    <Card className="border-2 border-blue-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-blue-800">Customer Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="relative">
                          <Label className="text-base font-semibold">Customer Name *</Label>
                          <div className="relative">
                            <Input 
                              className="h-11 pr-10"
                              placeholder="Type customer name..."
                              value={customerSearchTerm}
                              onChange={(e) => handleCustomerNameChange(e.target.value)}
                              onFocus={() => customerSuggestions.length > 0 && setShowCustomerSuggestions(true)}
                            />
                            <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                          </div>
                          
                          {/* Customer Suggestions Dropdown */}
                          {showCustomerSuggestions && customerSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {customerSuggestions.map((result, index) => (
                                <div
                                  key={result.item.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  onClick={() => handleCustomerSelect(result.item)}
                                >
                                  <div className="font-medium text-gray-900 text-sm">{result.item.name}</div>
                                  {result.item.phone && (
                                    <div className="text-xs text-gray-600">{result.item.phone}</div>
                                  )}
                                  {result.item.address && (
                                    <div className="text-xs text-gray-500 truncate">{result.item.address}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <Label className="text-base font-semibold">Phone Number</Label>
                          <Input 
                            className="h-11"
                            placeholder="Customer phone number"
                            value={newInvoice.customer_phone}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_phone: e.target.value }))}
                          />
                        </div>
                        
                        <div>
                          <Label className="text-base font-semibold">Address</Label>
                          <Textarea 
                            className="min-h-[60px] resize-none"
                            placeholder="Customer address"
                            value={newInvoice.customer_address}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_address: e.target.value }))}
                          />
                        </div>
                        
                        <div>
                          <Label className="text-base font-semibold">GST Number</Label>
                          <Input 
                            className="h-11"
                            placeholder="Customer GST number"
                            value={newInvoice.customer_gst}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_gst: e.target.value }))}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Supplier Selection for Purchase Bills */}
                  {newInvoice.invoice_type === 'purchase' && (
                    <Card className="border-2 border-orange-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-orange-800">Supplier Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <Label className="text-base font-semibold">Supplier</Label>
                          <Select 
                            value={newInvoice.supplier_id}
                            onValueChange={(value) => setNewInvoice(prev => ({ ...prev, supplier_id: value }))}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map(supplier => (
                                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes Section */}
                  <div className="mt-4">
                    <Label className="text-base font-semibold">Notes</Label>
                    <Textarea 
                      className="min-h-[80px] resize-none"
                      value={newInvoice.notes}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>

                {/* Right Column - Line Items */}
                <div>
                  <Card className="border-2 border-green-200">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col items-center justify-between">
                        <CardTitle className="text-lg text-green-800">Line Items</CardTitle>
                        <Button type="button" variant="outline" onClick={addLineItem} className="h-9 px-3">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Item
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {newInvoice.line_items.map((item, index) => (
                          <div key={index} className="border rounded-lg p-4 bg-gray-50">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm font-semibold">Product</Label>
                                  <Select 
                                    value={item.product_id} 
                                    onValueChange={(value) => handleProductSelect(index, value)}
                                  >
                                    <SelectTrigger className="h-10">
                                      <SelectValue placeholder="Select product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {products.map(product => (
                                        <SelectItem key={product.id} value={product.id.toString()}>
                                          {product.name} - ₹{product.unit_price}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    className="h-10 w-10"
                                    onClick={() => removeLineItem(index)}
                                    disabled={newInvoice.line_items.length === 1}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-3">
                                <div>
                                  <Label className="text-sm font-semibold">Quantity</Label>
                                  <Input 
                                    type="number" 
                                    className="h-10"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold">Unit Price</Label>
                                  <Input 
                                    type="number" 
                                    className="h-10"
                                    value={item.unit_price}
                                    onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold">Tax (%)</Label>
                                  <Input 
                                    type="number" 
                                    className="h-10"
                                    value={item.tax_rate}
                                    onChange={(e) => updateLineItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-sm font-semibold text-green-700">
                                  Line Total: ₹{calculateLineTotal(item).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="h-11 px-6">
                  Cancel
                </Button>
                <Button onClick={handleCreateInvoice} className="h-11 px-6">
                  Create Invoice
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={filter.type} onValueChange={(value) => setFilter(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sales">Sales Invoices</SelectItem>
                  <SelectItem value="purchase">Purchase Bills</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filter.status} onValueChange={(value) => setFilter(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Search</Label>
              <Input 
                placeholder="Search invoices..."
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchInvoices}>Apply Filters</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {customerFilter ? `Invoices for ${customerFilter.customerName}` : 'All Invoices'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No invoices found. Create your first invoice to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer/Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.invoice_type === 'sales' ? 'default' : 'secondary'}>
                        {invoice.invoice_type === 'sales' ? 'Sales' : 'Purchase'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.invoice_type === 'sales' ? invoice.customer_name : invoice.supplier_name}
                    </TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell>₹{invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice)
                            setShowViewDialog(true)
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <DollarSign className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Invoice Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Invoice Information</h3>
                  <p><strong>Invoice #:</strong> {selectedInvoice.invoice_number}</p>
                  <p><strong>Type:</strong> {selectedInvoice.invoice_type}</p>
                  <p><strong>Date:</strong> {selectedInvoice.invoice_date}</p>
                  <p><strong>Due Date:</strong> {selectedInvoice.due_date || 'Not set'}</p>
                  <p><strong>Status:</strong> {getStatusBadge(selectedInvoice.status)}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">
                    {selectedInvoice.invoice_type === 'sales' ? 'Customer' : 'Supplier'} Information
                  </h3>
                  <p><strong>Name:</strong> {selectedInvoice.customer_name || selectedInvoice.supplier_name}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Line Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Tax Rate</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.line_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>{item.tax_rate}%</TableCell>
                        <TableCell>₹{item.line_total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-end space-y-2">
                  <div className="text-right">
                    <p><strong>Subtotal:</strong> ₹{selectedInvoice.subtotal.toFixed(2)}</p>
                    <p><strong>Tax:</strong> ₹{selectedInvoice.tax_amount.toFixed(2)}</p>
                    <p><strong>Total:</strong> ₹{selectedInvoice.total_amount.toFixed(2)}</p>
                    <p><strong>Paid:</strong> ₹{selectedInvoice.paid_amount.toFixed(2)}</p>
                    <p className="text-lg font-semibold">
                      <strong>Outstanding:</strong> ₹{selectedInvoice.outstanding_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-gray-600">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BillManagement

