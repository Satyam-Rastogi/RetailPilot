import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Search, Eye, Edit, Trash2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import Fuse from 'fuse.js'

export default function PaymentManagement() {
  const [payments, setPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [balances, setBalances] = useState({ customer_balances: [], supplier_balances: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('payments') // 'payments', 'ledger', 'balances'
  
  // Payment form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'cash',
    reference_number: '',
    notes: '',
    customer_id: '',
    supplier_id: '',
    payment_type: 'received'
  })
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  
  // Customer/Supplier search with Fuse.js
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)
  
  // Fuse.js setup for customer search
  const customerFuse = useMemo(() => {
    return new Fuse(customers, {
      keys: ['name', 'phone_number'],
      threshold: 0.3,
      includeScore: true
    })
  }, [customers])
  
  // Fuse.js setup for supplier search
  const supplierFuse = useMemo(() => {
    return new Fuse(suppliers, {
      keys: ['name', 'phone_number'],
      threshold: 0.3,
      includeScore: true
    })
  }, [suppliers])
  
  // Get customer suggestions
  const customerSuggestions = useMemo(() => {
    if (!customerSearchTerm.trim()) return []
    return customerFuse.search(customerSearchTerm).slice(0, 5).map(result => result.item)
  }, [customerSearchTerm, customerFuse])
  
  // Get supplier suggestions
  const supplierSuggestions = useMemo(() => {
    if (!supplierSearchTerm.trim()) return []
    return supplierFuse.search(supplierSearchTerm).slice(0, 5).map(result => result.item)
  }, [supplierSearchTerm, supplierFuse])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [paymentsRes, customersRes, suppliersRes, ledgerRes, balancesRes] = await Promise.all([
        fetch('http://localhost:5000/api/payments'),
        fetch('http://localhost:5000/api/customers'),
        fetch('http://localhost:5000/api/suppliers'),
        fetch('http://localhost:5000/api/ledger'),
        fetch('http://localhost:5000/api/balances')
      ])
      
      const [paymentsData, customersData, suppliersData, ledgerData, balancesData] = await Promise.all([
        paymentsRes.json(),
        customersRes.json(),
        suppliersRes.json(),
        ledgerRes.json(),
        balancesRes.json()
      ])
      
      if (paymentsData.success) setPayments(paymentsData.payments)
      if (customersData.success) setCustomers(customersData.customers)
      if (suppliersData.success) setSuppliers(suppliersData.suppliers)
      if (ledgerData.success) setLedgerEntries(ledgerData.entries)
      if (balancesData.success) setBalances(balancesData)
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePayment = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm)
      })
      
      const data = await response.json()
      if (data.success) {
        setPayments([data.payment, ...payments])
        setIsCreateDialogOpen(false)
        resetPaymentForm()
        fetchData() // Refresh all data to update balances and ledger
      }
    } catch (error) {
      console.error('Error creating payment:', error)
    }
  }

  const resetPaymentForm = () => {
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_method: 'cash',
      reference_number: '',
      notes: '',
      customer_id: '',
      supplier_id: '',
      payment_type: 'received'
    })
    setCustomerSearchTerm('')
    setSupplierSearchTerm('')
  }

  const handleCustomerSelect = (customer) => {
    setPaymentForm(prev => ({ ...prev, customer_id: customer.id, supplier_id: '', payment_type: 'received' }))
    setCustomerSearchTerm(customer.name)
    setShowCustomerSuggestions(false)
    setSupplierSearchTerm('')
  }

  const handleSupplierSelect = (supplier) => {
    setPaymentForm(prev => ({ ...prev, supplier_id: supplier.id, customer_id: '', payment_type: 'made' }))
    setSupplierSearchTerm(supplier.name)
    setShowSupplierSuggestions(false)
    setCustomerSearchTerm('')
  }

  // Filter payments based on search and filters
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || payment.payment_type === filterType
    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus
    
    return matchesSearch && matchesType && matchesStatus
  })

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`

  if (loading) {
    return <div className="p-8 text-center">Loading payment data...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Payment & Ledger Management</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* Payment Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-700 border-b pb-2">Payment Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Type</Label>
                    <Select value={paymentForm.payment_type} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, payment_type: value }))}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Payment Received</SelectItem>
                        <SelectItem value="made">Payment Made</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  
                  <div>
                    <Label>Payment Method</Label>
                    <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, payment_method: value }))}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Reference Number</Label>
                  <Input
                    placeholder="Transaction ID, Cheque number, etc."
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, reference_number: e.target.value }))}
                    className="h-11"
                  />
                </div>
                
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
              
              {/* Customer/Supplier Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-green-700 border-b pb-2">
                  {paymentForm.payment_type === 'received' ? 'Customer Details' : 'Supplier Details'}
                </h3>
                
                {paymentForm.payment_type === 'received' ? (
                  <div className="relative">
                    <Label>Customer Name *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Type customer name..."
                        value={customerSearchTerm}
                        onChange={(e) => {
                          setCustomerSearchTerm(e.target.value)
                          setShowCustomerSuggestions(true)
                        }}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        className="h-12 pl-10"
                      />
                    </div>
                    
                    {showCustomerSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {customerSuggestions.map((customer) => (
                          <div
                            key={customer.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <div className="font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.phone_number}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Label>Supplier Name *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Type supplier name..."
                        value={supplierSearchTerm}
                        onChange={(e) => {
                          setSupplierSearchTerm(e.target.value)
                          setShowSupplierSuggestions(true)
                        }}
                        onFocus={() => setShowSupplierSuggestions(true)}
                        className="h-12 pl-10"
                      />
                    </div>
                    
                    {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {supplierSuggestions.map((supplier) => (
                          <div
                            key={supplier.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleSupplierSelect(supplier)}
                          >
                            <div className="font-medium text-gray-900">{supplier.name}</div>
                            <div className="text-sm text-gray-500">{supplier.phone_number}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePayment}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!paymentForm.amount || (!paymentForm.customer_id && !paymentForm.supplier_id)}
              >
                Record Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'payments' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('payments')}
          className="px-6"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Payments
        </Button>
        <Button
          variant={activeTab === 'ledger' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('ledger')}
          className="px-6"
        >
          <Eye className="w-4 h-4 mr-2" />
          Ledger
        </Button>
        <Button
          variant={activeTab === 'balances' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('balances')}
          className="px-6"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Balances
        </Button>
      </div>

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Records</CardTitle>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="made">Made</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Payment #</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Customer/Supplier</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-sm">{payment.payment_number}</td>
                      <td className="p-3">{payment.payment_date}</td>
                      <td className="p-3">
                        <Badge variant={payment.payment_type === 'received' ? 'default' : 'secondary'}>
                          {payment.payment_type === 'received' ? 'Received' : 'Made'}
                        </Badge>
                      </td>
                      <td className="p-3">{payment.customer_name || payment.supplier_name || 'N/A'}</td>
                      <td className="p-3 font-semibold">{formatCurrency(payment.amount)}</td>
                      <td className="p-3 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                      <td className="p-3">
                        <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredPayments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No payments found matching your criteria.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <Card>
          <CardHeader>
            <CardTitle>Ledger Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3">Debit</th>
                    <th className="text-left p-3">Credit</th>
                    <th className="text-left p-3">Balance</th>
                    <th className="text-left p-3">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{entry.entry_date}</td>
                      <td className="p-3">{entry.description}</td>
                      <td className="p-3 text-green-600 font-semibold">
                        {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '-'}
                      </td>
                      <td className="p-3 text-red-600 font-semibold">
                        {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '-'}
                      </td>
                      <td className="p-3 font-semibold">{formatCurrency(entry.running_balance)}</td>
                      <td className="p-3">
                        <Badge variant="outline">{entry.entry_type.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {ledgerEntries.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No ledger entries found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                Customer Balances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {balances.customer_balances.map((customer) => (
                  <div key={customer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{customer.name}</span>
                    <span className={`font-semibold ${customer.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(customer.balance)}
                    </span>
                  </div>
                ))}
                
                {balances.customer_balances.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No customer balances found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingDown className="w-5 h-5 mr-2 text-red-600" />
                Supplier Balances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {balances.supplier_balances.map((supplier) => (
                  <div key={supplier.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{supplier.name}</span>
                    <span className={`font-semibold ${supplier.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(supplier.balance)}
                    </span>
                  </div>
                ))}
                
                {balances.supplier_balances.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No supplier balances found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

