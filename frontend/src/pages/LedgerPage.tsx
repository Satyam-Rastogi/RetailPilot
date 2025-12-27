import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ledgerService, customerService } from '../services/api'
import type { CustomerLedger, CustomerListResponse, Payment } from '../types/api'

export default function LedgerPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListResponse | null>(null)
  
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [paymentForm, setPaymentForm] = useState<{
    customer_id: number
    date: string
    amount: number
    notes: string
  }>({
    customer_id: 0,
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    notes: ''
  })
  const [formError, setFormError] = useState('')

  const { data: ledgerData, isLoading, error } = useQuery<CustomerLedger>({
    queryKey: ['customerLedger', customerId, dateFrom, dateTo],
    queryFn: () => ledgerService.getCustomerLedger(Number(customerId), dateFrom || undefined, dateTo || undefined),
    enabled: !!customerId,
  })

  const { data: customers, isLoading: isLoadingCustomers, error: customersError } = useQuery<CustomerListResponse[]>({
    queryKey: ['customers'],
    queryFn: () => customerService.list(),
  })

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => ledgerService.createPayment(data),
    onSuccess: () => {
      setShowNewPaymentModal(false)
      setPaymentForm({
        customer_id: 0,
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        notes: ''
      })
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.detail || 'Failed to create payment')
    }
  })

  const updatePaymentMutation = useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: number; data: any }) =>
      ledgerService.updatePayment(paymentId, data),
    onSuccess: () => {
      setShowEditPaymentModal(false)
      setEditingPayment(null)
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.detail || 'Failed to update payment')
    }
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => ledgerService.deletePayment(paymentId),
    onSuccess: () => {
      setShowEditPaymentModal(false)
      setEditingPayment(null)
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.detail || 'Failed to delete payment')
    }
  })

  const handleNewPayment = () => {
    setPaymentForm({
      customer_id: Number(customerId),
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      notes: ''
    })
    setFormError('')
    setShowNewPaymentModal(true)
  }

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment)
    setPaymentForm({
      customer_id: payment.customer_id,
      date: payment.date.split('T')[0],
      amount: payment.amount,
      notes: payment.notes || ''
    })
    setFormError('')
    setShowEditPaymentModal(true)
  }

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!paymentForm.customer_id) {
      setFormError('Customer is required')
      return
    }
    if (!paymentForm.date) {
      setFormError('Date is required')
      return
    }
    if (paymentForm.amount <= 0) {
      setFormError('Amount must be greater than 0')
      return
    }

    if (editingPayment) {
      updatePaymentMutation.mutate({
        paymentId: editingPayment.id,
        data: {
          date: paymentForm.date,
          notes: paymentForm.notes
        }
      })
    } else {
      createPaymentMutation.mutate(paymentForm)
    }
  }

  const handleDeletePayment = (payment: Payment) => {
    if (confirm(`Are you sure you want to delete payment of ₹${payment.amount.toLocaleString('en-IN')}? This will also remove all associated allocations.`)) {
      deletePaymentMutation.mutate(payment.id)
    }
  }

  useEffect(() => {
    console.log('LedgerPage - customerId:', customerId)
    console.log('LedgerPage - customers:', customers)
    console.log('LedgerPage - customersError:', customersError)
    console.log('LedgerPage - ledgerData:', ledgerData)
    console.log('LedgerPage - isLoading:', isLoading)
    console.log('LedgerPage - error:', error)
  }, [customerId, customers, customersError, ledgerData, isLoading, error])

  useEffect(() => {
    console.log('LedgerPage - customerId:', customerId)
    console.log('LedgerPage - customers:', customers)
    console.log('LedgerPage - customersError:', customersError)
    console.log('LedgerPage - ledgerData:', ledgerData)
    console.log('LedgerPage - isLoading:', isLoading)
    console.log('LedgerPage - error:', error)
  }, [customerId, customers, customersError, ledgerData, isLoading, error])

  useEffect(() => {
    if (customers && customerId) {
      const customer = customers.find(c => c.id === Number(customerId))
      setSelectedCustomer(customer || null)
    }
  }, [customers, customerId])

  if (!customerId) {
    return (
      <div className="page-container fade-in">
        <div className="section">
          <div className="section-inner slide-up">
            <h1 className="text-5xl font-display font-bold gradient-text mb-4">Customer Ledger</h1>
            <p className="text-xl text-slate-400 mb-8">Select a customer to view their ledger</p>

            {isLoadingCustomers ? (
              <div className="text-center py-24">
                <div className="text-6xl mb-4 animate-bounce">⏳</div>
                <p className="text-xl text-slate-400">Loading customers...</p>
              </div>
            ) : customersError ? (
              <div className="text-center py-24 card p-16 rounded-2xl">
                <div className="text-8xl mb-6">❌</div>
                <h3 className="text-2xl font-display font-bold gradient-text mb-3">Error Loading Customers</h3>
                <p className="text-slate-400 text-lg mb-6">
                  {(customersError as Error).message || 'Failed to load customers'}
                </p>
                <button
                  onClick={() => navigate('/customers')}
                  className="btn btn-primary px-8"
                >
                  Retry
                </button>
              </div>
            ) : customers && customers.length > 0 ? (
              <div className="card rounded-2xl p-6">
                <h2 className="text-2xl font-display font-semibold mb-4">Select Customer</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customers.filter(c => c.customer_type === 'Wholesale').map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}/ledger`)}
                      className="p-4 rounded-lg bg-slate-800/50 hover:bg-amber-500/20 border-2 border-slate-700/50 hover:border-amber-500/50 transition-all duration-300 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                          <span className="text-lg">{customer.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100">{customer.name}</div>
                          <div className="text-sm text-slate-400">{customer.customer_type}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-24 card p-16 rounded-2xl">
                <div className="text-8xl mb-6">👥</div>
                <h3 className="text-2xl font-display font-bold gradient-text mb-3">No Customers Found</h3>
                <p className="text-slate-400 text-lg mb-6">
                  No customers available. Please create a customer first.
                </p>
                <button
                  onClick={() => navigate('/customers')}
                  className="btn btn-primary px-8"
                >
                  Go to Customers
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="page-container fade-in">
        <div className="section">
          <div className="section-inner slide-up">
            <div className="text-center py-24">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400">Loading ledger data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container fade-in">
        <div className="section">
          <div className="section-inner slide-up">
            <div className="text-center py-24 card p-16 rounded-2xl">
              <div className="text-8xl mb-6">❌</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">Error Loading Ledger</h3>
              <p className="text-slate-400 text-lg mb-6">
                {(error as Error).message || 'Failed to load ledger data'}
              </p>
              <button
                onClick={() => navigate('/customers')}
                className="btn btn-primary px-8"
              >
                Back to Customers
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
                Customer Ledger
              </h1>
              <p className="text-xl text-slate-400">
                {ledgerData?.customer_name || 'Customer'}
                {selectedCustomer && (
                  <span className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm
                    bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 border-2 border-indigo-500/50 text-indigo-400">
                    🏢 {selectedCustomer.customer_type}
                  </span>
                )}
              </p>
            </div>
          </div>

          {ledgerData && (
            <>
              <div className="card rounded-2xl p-8 mb-8 slide-up">
                <h2 className="text-2xl font-display font-semibold mb-6">Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-800/30 border-2 border-slate-700/50">
                    <div className="text-sm text-slate-400 mb-2">Total Invoiced</div>
                    <div className="text-3xl font-bold text-slate-100">
                      {ledgerData.total_invoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-6 rounded-xl bg-gradient-to-br from-green-900/20 to-green-900/5 border-2 border-green-700/50">
                    <div className="text-sm text-green-400 mb-2">Total Paid</div>
                    <div className="text-3xl font-bold text-green-400">
                      {ledgerData.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-6 rounded-xl bg-gradient-to-br from-amber-900/20 to-amber-900/5 border-2 border-amber-700/50">
                    <div className="text-sm text-amber-400 mb-2">Total Unpaid</div>
                    <div className="text-3xl font-bold text-amber-400">
                      {ledgerData.total_unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
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
                  <div className="flex items-end gap-3">
                    <button
                      onClick={() => { setDateFrom(''); setDateTo('') }}
                      className="btn btn-secondary h-[42px] px-6"
                    >
                      Clear Filters
                    </button>
                    <button
                      onClick={handleNewPayment}
                      className="btn btn-primary h-[42px] px-6 flex items-center gap-2"
                    >
                      <span>💵</span> New Payment
                    </button>
                  </div>
                </div>
              </div>

              <div className="card rounded-2xl overflow-hidden mb-8 slide-up">
                <div className="p-6 border-b-2 border-slate-800/30">
                  <h2 className="text-2xl font-display font-semibold">Invoices</h2>
                </div>
                {ledgerData.invoices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1000px] w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Invoice #</th>
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Date</th>
                          <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Total</th>
                          <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Paid</th>
                          <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Unpaid</th>
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.invoices.map((invoice) => (
                          <tr
                            key={invoice.id}
                            className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300"
                          >
                            <td className="px-8 py-4 font-semibold">
                              <button
                                onClick={() => navigate(`/invoices/${invoice.id}`)}
                                className="text-left w-full text-amber-400 hover:text-amber-300 transition-colors underline decoration-dotted underline-offset-2"
                              >
                                {invoice.invoice_number}
                              </button>
                            </td>
                            <td className="px-8 py-4 text-slate-400">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                            <td className="px-8 py-4 text-right text-slate-100">
                              {invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-4 text-right text-green-400">
                              {invoice.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-4 text-right text-amber-400">
                              {invoice.unpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-4">
                              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                                ${invoice.payment_status === 'Paid'
                                  ? 'bg-gradient-to-r from-green-500/20 to-green-500/5 border-2 border-green-500/50 text-green-400'
                                  : invoice.payment_status === 'Partially Paid'
                                  ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-2 border-amber-500/50 text-amber-400'
                                  : 'bg-gradient-to-r from-red-500/20 to-red-500/5 border-2 border-red-500/50 text-red-400'
                                }`}>
                                {invoice.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    No invoices found for the selected date range
                  </div>
                )}
              </div>

              <div className="card rounded-2xl overflow-hidden slide-up">
                <div className="p-6 border-b-2 border-slate-800/30">
                  <h2 className="text-2xl font-display font-semibold">Payments</h2>
                </div>
                {ledgerData.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1000px] w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-800/50 to-transparent">
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Date</th>
                          <th className="text-right px-8 py-4 font-display font-semibold text-slate-300">Amount</th>
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Notes</th>
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Allocations</th>
                          <th className="text-left px-8 py-4 font-display font-semibold text-slate-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.payments.map((payment) => (
                          <tr
                            key={payment.id}
                            className="border-b-2 border-slate-800/30 hover:bg-slate-800/30 transition-all duration-300"
                          >
                            <td className="px-8 py-4 text-slate-100">{new Date(payment.date).toLocaleDateString()}</td>
                            <td className="px-8 py-4 text-right text-green-400 font-semibold">
                              {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-4 text-slate-400">{payment.notes || '-'}</td>
                            <td className="px-8 py-4">
                              {payment.allocations.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {payment.allocations.map((alloc) => (
                                    <span
                                      key={alloc.id}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800/50 border-2 border-slate-700/50 text-sm text-slate-300"
                                    >
                                      {alloc.invoice_number}: {alloc.allocated_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">No allocations</span>
                              )}
                            </td>
                            <td className="px-8 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditPayment(payment)}
                                  className="px-3 py-1 rounded-lg bg-indigo-500/20 border-2 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/30 transition-colors text-sm"
                                  title="Edit payment"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(payment)}
                                  className="px-3 py-1 rounded-lg bg-red-500/20 border-2 border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                                  title="Delete payment"
                                  disabled={deletePaymentMutation.isPending}
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    No payments found for the selected date range
                  </div>
                )}
              </div>
            </>
          )}

          {showNewPaymentModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="card rounded-2xl max-w-md w-full slide-up">
                <div className="p-6 border-b-2 border-slate-800/30">
                  <h2 className="text-2xl font-display font-semibold">New Payment</h2>
                </div>
                <form onSubmit={handleSubmitPayment} className="p-6">
                  {formError && (
                    <div className="mb-4 p-4 rounded-lg bg-red-500/10 border-2 border-red-500/30 text-red-400">
                      {formError}
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Customer</label>
                    <input
                      type="text"
                      value={selectedCustomer?.name || ''}
                      disabled
                      className="input bg-slate-700/50 cursor-not-allowed"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Date *</label>
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentForm.amount || ''}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                      className="input"
                      required
                    />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Notes</label>
                    <textarea
                      value={paymentForm.notes || ''}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="input resize-none"
                      rows={3}
                      placeholder="Payment notes (optional)"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNewPaymentModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createPaymentMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {createPaymentMutation.isPending ? 'Creating...' : 'Create Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEditPaymentModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="card rounded-2xl max-w-md w-full slide-up">
                <div className="p-6 border-b-2 border-slate-800/30">
                  <h2 className="text-2xl font-display font-semibold">Edit Payment</h2>
                </div>
                <form onSubmit={handleSubmitPayment} className="p-6">
                  {formError && (
                    <div className="mb-4 p-4 rounded-lg bg-red-500/10 border-2 border-red-500/30 text-red-400">
                      {formError}
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Payment Amount</label>
                    <input
                      type="text"
                      value={`₹${editingPayment?.amount.toLocaleString('en-IN')}`}
                      disabled
                      className="input bg-slate-700/50 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">Amount cannot be changed to avoid disrupting FIFO allocation</p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Date *</label>
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2 text-slate-300">Notes</label>
                    <textarea
                      value={paymentForm.notes || ''}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="input resize-none"
                      rows={3}
                      placeholder="Payment notes"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditPaymentModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updatePaymentMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {updatePaymentMutation.isPending ? 'Updating...' : 'Update Payment'}
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
