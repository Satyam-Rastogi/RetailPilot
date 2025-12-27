import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const companyProfileService = {
  get: () => api.get('/company-profile/').then(res => res.data),
  create: (data: any) => api.post('/company-profile/', data).then(res => res.data),
  update: (data: any) => api.put('/company-profile/', data).then(res => res.data),
}

export const customerService = {
  list: (params?: { skip?: number; limit?: number; search?: string }) =>
    api.get('/customers', { params }).then(res => res.data),
  get: (id: number) => api.get(`/customers/${id}`).then(res => res.data),
  create: (data: any) => api.post('/customers', data).then(res => res.data),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/customers/${id}`).then(res => res.data),
}

export const supplierService = {
  list: (params?: { skip?: number; limit?: number; search?: string }) =>
    api.get('/suppliers', { params }).then(res => res.data),
  get: (id: number) => api.get(`/suppliers/${id}`).then(res => res.data),
  create: (data: any) => api.post('/suppliers', data).then(res => res.data),
  update: (id: number, data: any) => api.put(`/suppliers/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/suppliers/${id}`).then(res => res.data),
}

export const itemService = {
  list: (params?: { skip?: number; limit?: number; search?: string }) =>
    api.get('/items', { params }).then(res => res.data),
  get: (id: number) => api.get(`/items/${id}`).then(res => res.data),
  create: (data: any) => api.post('/items', data).then(res => res.data),
  update: (id: number, data: any) => api.put(`/items/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/items/${id}`).then(res => res.data),
  adjustStock: (id: number, data: any) => api.post(`/items/${id}/stock`, data).then(res => res.data),
}

export const invoiceService = {
  list: (params?: { skip?: number; limit?: number; date_from?: string; date_to?: string; customer_id?: number; customer_name?: string; invoice_number?: string; sort_by?: string; sort_dir?: string }) =>
    api.get('/invoices', { params }).then(res => res.data),
  get: (id: number) => api.get(`/invoices/${id}`).then(res => res.data),
  getDetail: (id: number) => api.get(`/invoices/${id}`).then(res => res.data),
  create: (data: any) => api.post('/invoices', data).then(res => res.data),
  update: (id: number, data: any) => api.put(`/invoices/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/invoices/${id}`).then(res => res.data),
}

export const returnService = {
  list: (params?: { skip?: number; limit?: number }) =>
    api.get('/returns', { params }).then(res => res.data),
  get: (id: number) => api.get(`/returns/${id}`).then(res => res.data),
  create: (data: any) => api.post('/returns', data).then(res => res.data),
}

export const ledgerService = {
  getCustomerLedger: (customerId: number, dateFrom?: string, dateTo?: string) =>
    api.get(`/payments/customer/${customerId}/ledger`, { params: { date_from: dateFrom, date_to: dateTo } }).then(res => res.data),

  getCustomerInvoicesLedger: (customerId: number, dateFrom?: string, dateTo?: string) =>
    api.get(`/payments/customer/${customerId}/ledger/invoices`, { params: { date_from: dateFrom, date_to: dateTo } }).then(res => res.data),

  getInvoiceAllocations: (invoiceId: number) =>
    api.get(`/payments/invoices/${invoiceId}/allocations`).then(res => res.data),

  getPayments: (customerId?: number, dateFrom?: string, dateTo?: string, skip?: number, limit?: number) =>
    api.get('/payments', { params: { customerId, date_from: dateFrom, date_to: dateTo, skip, limit } }).then(res => res.data),

  getPaymentDetails: (paymentId: number) =>
    api.get(`/payments/${paymentId}`).then(res => res.data),

  createPayment: (data: any) =>
    api.post('/payments/', data).then(res => res.data),

  updatePayment: (paymentId: number, data: any) =>
    api.patch(`/payments/${paymentId}`, data).then(res => res.data),

  deletePayment: (paymentId: number) =>
    api.delete(`/payments/${paymentId}`).then(res => res.data),
}

export const wholesaleLedgerService = {
  getWholesaleLedgers: () =>
    customerService.list().then(customers => {
      // Filter for wholesale customers only
      const wholesale = customers.filter((c: any) => c.customer_type === 'Wholesale')

      // Fetch ledger data for each customer in parallel
      const ledgerPromises = wholesale.map((customer: any) =>
        ledgerService.getCustomerLedger(customer.id).catch(() => null)
      )

      return Promise.all(ledgerPromises).then(ledgers => {
        return ledgers.map((ledger: any, index: number) => {
          const customer = wholesale[index]

          if (!ledger) {
            return {
              customer_id: customer.id,
              customer_name: customer.name,
              customer_type: customer.customer_type,
              total_invoiced: 0,
              total_paid: 0,
              total_unpaid: 0,
              last_activity: null,
              invoice_count: 0,
              payment_count: 0,
            }
          }

          // Find last activity date (most recent invoice or payment)
          const lastInvoice = ledger.invoices?.[0]
          const lastPayment = ledger.payments?.[0]

          const lastInvoiceDate = lastInvoice ? new Date(lastInvoice.invoice_date) : null
          const lastPaymentDate = lastPayment ? new Date(lastPayment.date) : null

          const lastActivity = lastInvoiceDate && lastPaymentDate
            ? (lastInvoiceDate > lastPaymentDate ? lastInvoiceDate : lastPaymentDate)
            : (lastInvoiceDate || lastPaymentDate)

          return {
            customer_id: customer.id,
            customer_name: customer.name,
            customer_type: customer.customer_type,
            total_invoiced: ledger.total_invoiced || 0,
            total_paid: ledger.total_paid || 0,
            total_unpaid: ledger.total_unpaid || 0,
            last_activity: lastActivity ? lastActivity.toISOString() : null,
            invoice_count: ledger.invoices?.length || 0,
            payment_count: ledger.payments?.length || 0,
          }
        })
      })
    }),
}

export default api
