// ─────────────────────────────────────────────────────────────────────────────
// RetailPilot API client — all HTTP calls go through this module.
//
// Architecture:
//   - Single Axios instance (`api`) with base URL `/api/v1`.
//   - Response interceptor: retries GET requests 2× on network/5xx errors
//     (600 ms → 1 200 ms backoff), then shows a toast for any non-422 error.
//   - 422 validation errors are NOT toasted — pages show them inline.
//   - 13 service objects, one per backend resource.
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Company Profile ───────────────────────────────────────────────────────────
/** Single shop profile record — name, address, GSTIN, bank details, tax rate. */
export const companyProfileService = {
  /** `GET /company-profile/` — returns the single profile or 404 if not yet created. */
  get: () => api.get('/company-profile/').then(res => res.data),
  /** `POST /company-profile/` — creates the profile (only one record allowed). */
  create: (data: any) => api.post('/company-profile/', data).then(res => res.data),
  /** `PUT /company-profile/` — partial update (only provided fields are changed). */
  update: (data: any) => api.put('/company-profile/', data).then(res => res.data),
}

// ── Customers ─────────────────────────────────────────────────────────────────
/**
 * Customer CRUD + receivables intelligence.
 * Walk-in Customer is system-seeded and cannot be deleted.
 */
export const customerService = {
  /** `GET /customers/` — paginated list with optional `search` and `created_after` filter. */
  list: (params?: { page?: number; page_size?: number; search?: string; created_after?: string }) =>
    api.get('/customers/', { params }).then(res => res.data),
  /**
   * `GET /customers/outstanding/` — per-customer outstanding and overdue totals.
   * Single SQL aggregate, no N+1. Walk-in Customer excluded.
   */
  getOutstanding: (params?: { include_zero_balance?: boolean; search?: string; customer_type?: string }) =>
    api.get('/customers/outstanding/', { params }).then(res => res.data),
  /** `GET /customers/{id}` */
  get: (id: number) => api.get(`/customers/${id}`).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  /** `POST /customers/` */
  create: (data: any) => api.post('/customers/', data).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  /** `PUT /customers/{id}` */
  update: (id: number, data: any) => api.put(`/customers/${id}`, data).then(res => {
      const response = res.data;
      return response.data || response;
    }),
  /** `DELETE /customers/{id}` — blocked for Walk-in Customer. */
  delete: (id: number) => api.delete(`/customers/${id}`).then(res => {
      const response = res.data;
      return response.data || response;
    }),
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
/** Supplier CRUD — bank details and GSTIN stored; linked to items. */
export const supplierService = {
  /** `GET /suppliers/` — paginated list with optional name `search`. */
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

// ── Items ─────────────────────────────────────────────────────────────────────
/**
 * Inventory catalogue.
 * DELETE is a soft-delete (`is_active=false`); records remain in invoice history.
 */
export const itemService = {
  /**
   * `GET /items/` — paginated active items.
   * Filters: `search` (name/SKU/brand), `low_stock_only`, `category`, `supplier_id`.
   */
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
  /** `DELETE /items/{id}` — soft delete: sets `is_active=false`. */
  delete: (id: number) => api.delete(`/items/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /**
   * `POST /items/{id}/stock` — manual stock adjustment.
   * `delta` is signed (positive = in, negative = out). Writes a StockAudit record.
   */
  adjustStock: (id: number, data: any) => api.post(`/items/${id}/stock`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
}

// ── Item Variants ─────────────────────────────────────────────────────────────
/** Variant CRUD for items with `has_variants=true` (size/colour variants). */
export const variantService = {
  list: (itemId: number) =>
    api.get(`/items/${itemId}/variants/`).then(res => res.data),
  create: (itemId: number, data: { variant_value: string; sku?: string; stock_quantity?: number }) =>
    api.post(`/items/${itemId}/variants/`, data).then(res => res.data),
  update: (itemId: number, variantId: number, data: { variant_value?: string; sku?: string; stock_quantity?: number }) =>
    api.put(`/items/${itemId}/variants/${variantId}`, data).then(res => res.data),
  delete: (itemId: number, variantId: number) =>
    api.delete(`/items/${itemId}/variants/${variantId}`).then(res => res.data),
  /** `POST /items/{id}/variants/{vid}/stock` — adjust variant stock, writes StockAudit. */
  adjustStock: (itemId: number, variantId: number, data: { delta: number; reason?: string }) =>
    api.post(`/items/${itemId}/variants/${variantId}/stock`, data).then(res => res.data),
}

// ── Stock Audit ───────────────────────────────────────────────────────────────
/** Read-only access to the stock movement log. */
export const stockAuditService = {
  /**
   * `GET /items/stock-audit/` — paginated stock movement history.
   * Filters: `item_id`, `delta_direction` (`'in'`/`'out'`), `entry_type`.
   */
  list: (params?: {
    page?: number
    page_size?: number
    item_id?: number
    delta_direction?: 'in' | 'out'
    entry_type?: 'sale' | 'return' | 'void' | 'edit' | 'manual'
  }) => api.get('/items/stock-audit/', { params }).then(res => res.data),
}

// ── Invoices ──────────────────────────────────────────────────────────────────
/**
 * Sales invoice lifecycle.
 * CREATE deducts stock and assigns invoice number. DELETE is blocked if payments exist.
 */
export const invoiceService = {
  /**
   * `GET /invoices/` — paginated list with 7 filters and 4 sort fields.
   * Filters: `date_from`, `date_to`, `customer_id`, `customer_name`, `invoice_number`,
   * `payment_status` (`paid`/`partial`/`unpaid`), `overdue_only`.
   */
  list: (params?: { page?: number; page_size?: number; date_from?: string; date_to?: string; customer_id?: number; customer_name?: string; invoice_number?: string; payment_status?: string; overdue_only?: boolean; sort_by?: string; sort_dir?: string }) =>
    api.get('/invoices/', { params }).then(res => res.data),
  /** `GET /invoices/{id}` — full detail with line items, returns, and payment allocations. */
  get: (id: number) => api.get(`/invoices/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /** Alias for `get` — used by `InvoiceDetailPage`. */
  getDetail: (id: number) => api.get(`/invoices/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /** `POST /invoices/` — creates invoice, deducts stock, assigns invoice number. */
  create: (data: any) => api.post('/invoices/', data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /** `PUT /invoices/{id}` — recalculates totals; stock delta guard applied. */
  update: (id: number, data: any) => api.put(`/invoices/${id}`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /** `DELETE /invoices/{id}` — blocked if `amount_paid > 0`. */
  delete: (id: number) => api.delete(`/invoices/${id}`).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
}

// ── Returns ───────────────────────────────────────────────────────────────────
/**
 * Goods return lifecycle.
 * CREATE restores stock and auto-creates a `credit_note` payment.
 * DELETE fully reverses all side effects.
 */
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
  /** `POST /returns/` — validates quantities, restores stock, creates credit_note, FIFO-allocates. */
  create: (data: any) => api.post('/returns/', data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /** `PUT /returns/{id}` — only `notes` can be updated. */
  update: (id: number, data: any) => api.put(`/returns/${id}`, data).then(res => {
      const response = res.data;
      return (response && response.data) || response;
    }),
  /** `DELETE /returns/{id}` — full reversal: undoes FIFO, removes credit_note, deducts stock. */
  delete: (id: number) => api.delete(`/returns/${id}`).then(res => res.data),
}

// ── Payments + Ledger ─────────────────────────────────────────────────────────
/**
 * Payment lifecycle with FIFO allocation + customer ledger views.
 *
 * FIFO rule: payments always allocated to oldest invoice first.
 * Payment amount is immutable — only date/method/notes are editable via PATCH.
 * DELETE fully reverses allocations and restores invoice payment_status.
 */
export const ledgerService = {
  /**
   * `GET /payments/customer/{id}/ledger` — full invoice + payment history for a customer.
   * Returns `CustomerLedger` with totals, invoice list, and payment list.
   */
  getCustomerLedger: (customerId: number, dateFrom?: string, dateTo?: string) =>
    api.get(`/payments/customer/${customerId}/ledger`, { params: { date_from: dateFrom, date_to: dateTo } }).then(res => {
      const response = res.data;
      return response && response.data || response;
    }),

  /**
   * `GET /payments/customer/{id}/ledger/invoices` — paginated invoice list for a customer.
   * Used by the Ledger page invoice tab.
   */
  getCustomerInvoicesLedger: (customerId: number, dateFrom?: string, dateTo?: string) =>
    api.get(`/payments/customer/${customerId}/ledger/invoices`, { params: { date_from: dateFrom, date_to: dateTo } }).then(res => {
      const response = res.data;
      return response.data || response;
    }),

  /**
   * `GET /payments/invoices/{id}/allocations` — all payment allocations for one invoice.
   * Shows which payments (and how much of each) were applied to this invoice.
   */
  getInvoiceAllocations: (invoiceId: number) =>
    api.get(`/payments/invoices/${invoiceId}/allocations`).then(res => res.data),

  /** `GET /payments/` — paginated payments. Filterable by `customerId`, `date_from`, `date_to`. */
  getPayments: (customerId?: number, dateFrom?: string, dateTo?: string, skip?: number, limit?: number) =>
    api.get('/payments/', { params: { customerId, date_from: dateFrom, date_to: dateTo, skip, limit } }).then(res => res.data),

  /** `GET /payments/{id}` */
  getPaymentDetails: (paymentId: number) =>
    api.get(`/payments/${paymentId}`).then(res => res.data),

  /** `POST /payments/` — records payment and auto FIFO-allocates to oldest unpaid invoices. */
  createPayment: (data: any) =>
    api.post('/payments/', data).then(res => res.data),

  /** `PATCH /payments/{id}` — updates `date`, `payment_method`, `reference_number`, or `notes` only. */
  updatePayment: (paymentId: number, data: any) =>
    api.patch(`/payments/${paymentId}`, data).then(res => res.data),

  /**
   * `DELETE /payments/{id}` — full reversal.
   * Removes all allocations, restores invoice `amount_paid` and `payment_status`.
   */
  deletePayment: (paymentId: number) =>
    api.delete(`/payments/${paymentId}`).then(res => res.data),
}

// ── Reports ───────────────────────────────────────────────────────────────────
/** Read-only report endpoints — all aggregate SQL, no N+1. */
export const reportService = {
  /** `GET /reports/aging/` — AR aging buckets (Current/1-30/31-60/61-90/90+). */
  getAging: (params?: { customer_type?: string }) =>
    api.get('/reports/aging/', { params }).then(res => res.data),
  /**
   * `GET /reports/daily-summary/` — invoice count, total sales, and payment breakdown for one day.
   * Defaults to today when `date` is omitted.
   */
  getDailySummary: (date?: string) =>
    api.get('/reports/daily-summary/', { params: date ? { date } : undefined }).then(res => res.data),
  /**
   * `GET /reports/revenue/` — monthly revenue split by Retail/Wholesale + top 10 customers.
   * `months` sets the lookback window (1–36, default 12).
   */
  getRevenue: (months?: number) =>
    api.get('/reports/revenue/', { params: months ? { months } : undefined }).then(res => res.data),
  /** `GET /reports/gst-summary/` — GST liability grouped by rate slab with CGST/SGST split. */
  getGstSummary: (params?: { from_date?: string; to_date?: string }) =>
    api.get('/reports/gst-summary/', { params }).then(res => res.data),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
/** Deep analytics endpoints used by InventoryAnalyticsPage and BestSellersPage. */
export const analyticsService = {
  /**
   * `GET /reports/inventory-value/` — full stock statement.
   * Returns summary, per-item detail (with `units_sold_30d` velocity), by-category, and top-15 brands.
   */
  getInventoryValue: () =>
    api.get('/reports/inventory-value/').then(res => res.data),
  /**
   * `GET /reports/best-sellers/` — top items, brands, price brackets, and segment breakdown.
   * Params: `period` (7d/30d/90d/all), `metric` (units/revenue), `limit` (5–50), `customer_type`.
   */
  getBestSellers: (params?: { period?: string; metric?: string; limit?: number; customer_type?: string }) =>
    api.get('/reports/best-sellers/', { params }).then(res => res.data),
}

// ── Counter Sale ──────────────────────────────────────────────────────────────
/**
 * One-step counter sale: invoice + full payment in a single atomic transaction.
 * Returns `CounterSaleResult` including `change_due`.
 */
export const counterSaleService = {
  /** `POST /invoices/counter-sale/` — body: invoice fields + `payment_method` + `amount_paid`. */
  create: (data: any) => api.post('/invoices/counter-sale/', data).then(res => res.data),
}

export default api
