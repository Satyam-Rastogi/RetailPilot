import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import { ledgerService, customerService } from '../services/api'
import type { CustomerLedger, CustomerListResponse, Payment, PaginatedResponse } from '../types/api'
import { useSettings } from '../components/SettingsProvider'
import { cn } from '../lib/utils'

const statusConfig: Record<string, string> = {
  Paid: 'text-success border-success',
  'Partially Paid': 'text-warning border-warning',
  Unpaid: 'text-danger border-danger',
}

export default function LedgerPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { formatCurrency } = useSettings()

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListResponse | null>(null)

  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    customer_id: 0,
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'cash',
    reference_number: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')

  const { data: ledgerData, isLoading, error } = useQuery<CustomerLedger>({
    queryKey: ['customerLedger', customerId, dateFrom, dateTo],
    queryFn: () => ledgerService.getCustomerLedger(Number(customerId), dateFrom || undefined, dateTo || undefined),
    enabled: !!customerId,
  })

  const { data: customersData } = useQuery<PaginatedResponse<CustomerListResponse>>({
    queryKey: ['customers'],
    queryFn: () => customerService.list({ page_size: 100 }),
  })
  const customers = customersData?.data ?? []

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => ledgerService.createPayment(data),
    onSuccess: () => {
      setShowNewPaymentModal(false)
      setPaymentForm({
        customer_id: 0,
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'cash',
        reference_number: '',
        notes: '',
      })
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Failed to create payment')
    },
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
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Failed to update payment')
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => ledgerService.deletePayment(paymentId),
    onSuccess: () => {
      setShowEditPaymentModal(false)
      setEditingPayment(null)
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Failed to delete payment')
    },
  })

  const handleNewPayment = () => {
    setPaymentForm({
      customer_id: Number(customerId),
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      payment_method: 'cash',
      reference_number: '',
      notes: '',
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
      payment_method: payment.payment_method || 'cash',
      reference_number: payment.reference_number || '',
      notes: payment.notes || '',
    })
    setFormError('')
    setShowEditPaymentModal(true)
  }

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!paymentForm.customer_id) { setFormError('Customer is required'); return }
    if (!paymentForm.date) { setFormError('Date is required'); return }
    if (paymentForm.amount <= 0) { setFormError('Amount must be greater than 0'); return }

    if (editingPayment) {
      updatePaymentMutation.mutate({
        paymentId: editingPayment.id,
        data: {
          date: paymentForm.date,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || undefined,
          notes: paymentForm.notes,
        },
      })
    } else {
      createPaymentMutation.mutate({
        ...paymentForm,
        reference_number: paymentForm.reference_number || undefined,
      })
    }
  }

  const handleDeletePayment = (payment: Payment) => {
    if (window.confirm(`Delete payment of ${formatCurrency(payment.amount)}? This will also remove all associated allocations.`)) {
      deletePaymentMutation.mutate(payment.id)
    }
  }

  useEffect(() => {
    if (customers && customerId) {
      const customer = customers.find(c => c.id === Number(customerId))
      setSelectedCustomer(customer || null)
    }
  }, [customers, customerId])

  const referenceLabel = paymentForm.payment_method === 'cheque'
    ? 'Cheque Number'
    : paymentForm.payment_method === 'upi'
    ? 'UPI Reference'
    : 'Transaction ID'

  const showRefField = ['upi', 'cheque', 'bank_transfer'].includes(paymentForm.payment_method)

  const inputClass = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'

  if (!customerId) {
    return (
      <div className="space-y-8 pb-12">
        <header className="border-b border-line pb-6">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="type-heading">
            Customer Ledger
          </motion.h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">Select a customer</p>
          <div className="w-16 h-0.5 bg-accent mt-4" />
        </header>

        {customers && customers.length > 0 ? (
          <div className="brutal-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-ink text-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest">Wholesale Customers</span>
            </div>
            <div className="divide-y divide-line">
              {customers.filter(c => c.customer_type === 'Wholesale').map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}/ledger`)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-ink hover:text-surface transition-colors text-left group brutal-focus"
                >
                  <div className="w-8 h-8 brutal-border flex items-center justify-center font-display font-bold text-sm shrink-0 group-hover:border-accent">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-mono text-sm font-bold">{customer.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light group-hover:text-surface/60">
                      {customer.customer_type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="brutal-border bg-surface p-16 text-center">
            <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-6">No customers found</p>
            <button
              onClick={() => navigate('/customers')}
              className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
            >
              Go to Customers
            </button>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading ledger data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-danger mb-2">Error Loading Ledger</p>
          <p className="font-mono text-xs text-ink-light mb-6">
            {(error as Error).message || 'Failed to load ledger data'}
          </p>
          <button
            onClick={() => navigate('/customers')}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            Back to Customers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="border-b border-line pb-6">
        <button
          onClick={() => navigate('/customers/wholesale-ledgers')}
          className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-ink-light hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Ledgers
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="type-heading">
              {ledgerData?.customer_name || 'Customer Ledger'}
            </motion.h1>
            {selectedCustomer && (
              <p className="font-mono text-xs uppercase tracking-widest text-ink-light mt-1">
                {selectedCustomer.customer_type}
              </p>
            )}
          </div>
          <button
            onClick={handleNewPayment}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            <Plus className="w-4 h-4" /> New Payment
          </button>
        </div>
        <div className="w-16 h-0.5 bg-accent mt-4" />
      </header>

      {ledgerData && (
        <>
          {/* Summary + Filters */}
          <div className="brutal-border bg-surface p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-line">
              <div className="px-4 py-4 first:pl-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Invoiced</div>
                <div className="font-display font-bold text-2xl">{formatCurrency(ledgerData.total_invoiced)}</div>
              </div>
              <div className="px-4 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Paid</div>
                <div className="font-display font-bold text-2xl text-success">{formatCurrency(ledgerData.total_paid)}</div>
              </div>
              <div className="px-4 py-4 last:pr-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Total Unpaid</div>
                <div className={cn('font-display font-bold text-2xl', ledgerData.total_unpaid > 0 ? 'text-danger' : 'text-success')}>
                  {formatCurrency(ledgerData.total_unpaid)}
                </div>
              </div>
            </div>

            {/* Date Filters */}
            <div className="border-t border-line pt-6 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="brutal-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest">Invoices</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">
                {ledgerData.invoices.length} records
              </span>
            </div>
            {ledgerData.invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full">
                  <thead>
                    <tr className="bg-surface text-ink-light border-b border-line">
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Invoice #</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Date</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Due Date</th>
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Total</th>
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Paid</th>
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Unpaid</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ledgerData.invoices.map((invoice) => {
                      const isOverdue = invoice.payment_status !== 'Paid' && invoice.due_date && new Date(invoice.due_date) < new Date()
                      return (
                        <tr key={invoice.id} className="hover:bg-paper transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => navigate(`/invoices/${invoice.id}`)}
                              className="font-mono text-sm font-bold text-accent hover:underline underline-offset-2 brutal-focus"
                            >
                              {invoice.invoice_number}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-ink-light">
                            {new Date(invoice.invoice_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm">
                            {invoice.due_date ? (
                              <span className={isOverdue ? 'text-danger' : 'text-ink-light'}>
                                {new Date(invoice.due_date).toLocaleDateString()}
                                {isOverdue && (
                                  <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase tracking-widest brutal-border border-danger text-danger">
                                    Overdue
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="opacity-40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(invoice.grand_total)}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-bold text-success">
                            {formatCurrency(invoice.amount_paid)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-bold text-warning">
                            {formatCurrency(invoice.unpaid)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'brutal-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest',
                              statusConfig[invoice.payment_status] ?? 'text-ink-light border-line'
                            )}>
                              {invoice.payment_status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="font-mono text-sm uppercase tracking-widest text-ink-light">
                  No invoices found for selected date range
                </p>
              </div>
            )}
          </div>

          {/* Payments Table */}
          <div className="brutal-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-ink text-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest">Payments</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">
                {ledgerData.payments.length} records
              </span>
            </div>
            {ledgerData.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full">
                  <thead>
                    <tr className="bg-surface text-ink-light border-b border-line">
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Date</th>
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Amount</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Method</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Notes</th>
                      <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest">Allocations</th>
                      <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ledgerData.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-paper transition-colors">
                        <td className="px-4 py-3 font-mono text-sm">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-success">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {payment.payment_method ? (
                            <div>
                              <span className="brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-light">
                                {payment.payment_method.replace('_', ' ')}
                              </span>
                              {payment.reference_number && (
                                <div className="text-[10px] font-mono text-ink-muted mt-1">{payment.reference_number}</div>
                              )}
                            </div>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-ink-light">
                          {payment.credit_balance != null && payment.credit_balance > 0 && (
                            <span className="brutal-border border-accent text-accent font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 mr-2">
                              Credit {formatCurrency(payment.credit_balance)}
                            </span>
                          )}
                          {payment.notes || (!payment.credit_balance ? <span className="opacity-40">—</span> : null)}
                        </td>
                        <td className="px-4 py-3">
                          {payment.allocations.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {payment.allocations.map((alloc) => (
                                <span
                                  key={alloc.id}
                                  className="brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-light"
                                >
                                  {alloc.invoice_number}: {formatCurrency(alloc.allocated_amount)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-ink-muted">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEditPayment(payment)}
                              className="p-1.5 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
                              title="Edit payment"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(payment)}
                              disabled={deletePaymentMutation.isPending}
                              className="p-1.5 brutal-border hover:bg-danger hover:text-paper hover:border-danger transition-colors brutal-focus disabled:opacity-50"
                              title="Delete payment"
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
            ) : (
              <div className="p-12 text-center">
                <p className="font-mono text-sm uppercase tracking-widest text-ink-light">
                  No payments found for selected date range
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* New Payment Modal */}
      {showNewPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
          <div className="brutal-border bg-surface w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <h2 className="font-display font-bold text-xl uppercase tracking-tighter">New Payment</h2>
              <button
                type="button"
                onClick={() => setShowNewPaymentModal(false)}
                className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="new-payment-form" onSubmit={handleSubmitPayment} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="brutal-border border-danger p-3">
                  <p className="font-mono text-xs text-danger uppercase tracking-widest">{formError}</p>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Customer</label>
                <input
                  type="text"
                  value={selectedCustomer?.name || ''}
                  disabled
                  className={cn(inputClass, 'opacity-50 cursor-not-allowed')}
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Date *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount || ''}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Payment Method *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className={inputClass}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>
              {showRefField && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                    {referenceLabel}
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    className={inputClass}
                    placeholder="Optional reference number"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className={cn(inputClass, 'resize-none')}
                  rows={3}
                  placeholder="Payment notes (optional)"
                />
              </div>
            </form>
            <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
              <button
                type="button"
                onClick={() => setShowNewPaymentModal(false)}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-payment-form"
                disabled={createPaymentMutation.isPending}
                className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {createPaymentMutation.isPending ? 'Creating...' : 'Create Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
          <div className="brutal-border bg-surface w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <h2 className="font-display font-bold text-xl uppercase tracking-tighter">Edit Payment</h2>
              <button
                type="button"
                onClick={() => setShowEditPaymentModal(false)}
                className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="edit-payment-form" onSubmit={handleSubmitPayment} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="brutal-border border-danger p-3">
                  <p className="font-mono text-xs text-danger uppercase tracking-widest">{formError}</p>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Payment Amount</label>
                <input
                  type="text"
                  value={editingPayment ? formatCurrency(editingPayment.amount) : ''}
                  disabled
                  className={cn(inputClass, 'opacity-50 cursor-not-allowed')}
                />
                <p className="font-mono text-[10px] text-ink-muted mt-1 uppercase tracking-widest">
                  Amount cannot be changed to preserve FIFO allocation
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Date *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className={inputClass}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>
              {showRefField && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                    {referenceLabel}
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    className={inputClass}
                    placeholder="Optional reference number"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className={cn(inputClass, 'resize-none')}
                  rows={3}
                  placeholder="Payment notes"
                />
              </div>
            </form>
            <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
              <button
                type="button"
                onClick={() => setShowEditPaymentModal(false)}
                className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-payment-form"
                disabled={updatePaymentMutation.isPending}
                className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
              >
                {updatePaymentMutation.isPending ? 'Updating...' : 'Update Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
