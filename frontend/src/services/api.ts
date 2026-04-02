import axios, { type AxiosRequestConfig } from 'axios'
import { toast } from '../lib/toast'

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000, // 15 s — server must respond within this window
})

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Pull the most useful human-readable message from an API error response. */
function extractMessage(error: any): string {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation array — join first few
    return detail
      .slice(0, 3)
      .map((d: any) => (typeof d?.msg === 'string' ? d.msg : JSON.stringify(d)))
      .join('; ')
  }
  const status = error.response?.status
  if (!error.response) return 'Cannot reach the server. Check your connection.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 409) return 'Conflict: this operation could not be completed.'
  if (status === 422) return 'Validation error. Please check your input.'
  if (status >= 500) return 'Server error. Please try again in a moment.'
  return `Unexpected error (${status ?? 'unknown'}).`
}

// ── Response interceptor — retry + toast ─────────────────────────────────────
const MAX_RETRIES = 2          // only for GET requests on network/5xx errors
const BASE_DELAY_MS = 600      // first retry after 600 ms, second after 1 200 ms

api.interceptors.response.use(
  response => response,
  async (error) => {
    const config: AxiosRequestConfig & { _retryCount?: number } = error.config ?? {}
    const status: number | undefined = error.response?.status
    const isGet = (config.method ?? 'get').toLowerCase() === 'get'
    const isNetworkError = !error.response
    const isServerError = status !== undefined && status >= 500

    // ── Retry GET requests on transient failures ──────────────────────────────
    if (isGet && (isNetworkError || isServerError)) {
      config._retryCount = config._retryCount ?? 0
      if (config._retryCount < MAX_RETRIES) {
        config._retryCount++
        const delay = BASE_DELAY_MS * config._retryCount
        await new Promise(r => setTimeout(r, delay))
        return api(config)
      }
    }

    // ── Toast for errors that pages don't handle inline ───────────────────────
    // 422 (form validation) is intentionally excluded — pages show inline errors.
    if (status !== 422) {
      toast.error(extractMessage(error))
    }

    return Promise.reject(error)
  },
)

export const companyProfileService = {
  get: () => api.get('/company-profile/').then(res => res.data),
  create: (data: any) => api.post('/company-profile/', data).then(res => res.data),
  update: (data: any) => api.put('/company-profile/', data).then(res => res.data),
}

export const customerService = {
  list: (params?: { page?: number; page_size?: number; search?: string; created_after?: string }) =>
    api.get('/customers/', { params }).then(res => res.data),
  get: (id: number) => api.get(`/customers/${id}`).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  create: (data: any) => api.post('/customers/', data).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  delete: (id: number) => api.delete(`/customers/${id}`).then(res => {
      const response = res.data;
      return response.data || response;
    }),
}

export const supplierService = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get('/suppliers/', { params }).then(res => res.data),
  get: (id: number) => api.get(`/suppliers/${id}`).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  create: (data: any) => api.post('/suppliers/', data).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  update: (id: number, data: any) => api.put(`/suppliers/${id}`, data).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  delete: (id: number) => api.delete(`/suppliers/${id}`).then(res => {
      const response = res.data;
      return response.data || response;
    }),
}

export const itemService = {
  list: (params?: { page?: number; page_size?: number; search?: string; low_stock_only?: boolean }) =>
    api.get('/items/', { params }).then(res => res.data),
  get: (id: number) => api.get(`/items/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  create: (data: any) => api.post('/items/', data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  update: (id: number, data: any) => api.put(`/items/${id}`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  delete: (id: number) => api.delete(`/items/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  adjustStock: (id: number, data: any) => api.post(`/items/${id}/stock`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
}

export const variantService = {
  list: (itemId: number) =>
    api.get(`/items/${itemId}/variants/`).then(res => res.data),
  create: (itemId: number, data: { variant_value: string; sku?: string; stock_quantity?: number }) =>
    api.post(`/items/${itemId}/variants/`, data).then(res => res.data),
  update: (itemId: number, variantId: number, data: { variant_value?: string; sku?: string; stock_quantity?: number }) =>
    api.put(`/items/${itemId}/variants/${variantId}`, data).then(res => res.data),
  delete: (itemId: number, variantId: number) =>
    api.delete(`/items/${itemId}/variants/${variantId}`).then(res => res.data),
  adjustStock: (itemId: number, variantId: number, data: { delta: number; reason?: string }) =>
    api.post(`/items/${itemId}/variants/${variantId}/stock`, data).then(res => res.data),
}

export const stockAuditService = {
  list: (params?: { page?: number; page_size?: number; item_id?: number }) =>
    api.get('/items/stock-audit/', { params }).then(res => res.data),
}

export const invoiceService = {
  list: (params?: { page?: number; page_size?: number; date_from?: string; date_to?: string; customer_id?: number; customer_name?: string; invoice_number?: string; payment_status?: string; overdue_only?: boolean; sort_by?: string; sort_dir?: string }) =>
    api.get('/invoices/', { params }).then(res => res.data),
  get: (id: number) => api.get(`/invoices/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  getDetail: (id: number) => api.get(`/invoices/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  create: (data: any) => api.post('/invoices/', data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  update: (id: number, data: any) => api.put(`/invoices/${id}`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  delete: (id: number) => api.delete(`/invoices/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
}

export const returnService = {
  list: (params?: {
    skip?: number
    limit?: number
    reason_category?: string
    is_partial?: boolean
    date_from?: string
    date_to?: string
  }) =>
    api.get('/returns/', { params }).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  get: (id: number) => api.get(`/returns/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  create: (data: any) => api.post('/returns/', data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  update: (id: number, data: any) => api.put(`/returns/${id}`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
}

export const ledgerService = {
  getCustomerLedger: (customerId: number, dateFrom?: string, dateTo?: string) =>
    api.get(`/payments/customer/${customerId}/ledger`, { params: { date_from: dateFrom, date_to: dateTo } }).then(res => {
      const response = res.data;
      return response && response.data || response;
    }),

  getCustomerInvoicesLedger: (customerId: number, dateFrom?: string, dateTo?: string) =>
    api.get(`/payments/customer/${customerId}/ledger/invoices`, { params: { date_from: dateFrom, date_to: dateTo } }).then(res => {
      const response = res.data;
      return response.data || response;
    }),

  getInvoiceAllocations: (invoiceId: number) =>
    api.get(`/payments/invoices/${invoiceId}/allocations`).then(res => res.data),

  getPayments: (customerId?: number, dateFrom?: string, dateTo?: string, skip?: number, limit?: number) =>
    api.get('/payments/', { params: { customerId, date_from: dateFrom, date_to: dateTo, skip, limit } }).then(res => res.data),

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
  getWholesaleLedgers: (dateFrom?: string, dateTo?: string) =>
    customerService.list({ page_size: 100 }).then(res => {
      const customers = res.data || []
      // Filter for wholesale customers only
      const wholesale = customers.filter((c: any) => c.customer_type === 'Wholesale')

      // Fetch ledger data for each customer in parallel
      const ledgerPromises = wholesale.map((customer: any) =>
        ledgerService.getCustomerLedger(customer.id, dateFrom, dateTo).catch(() => null)
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
