// ─────────────────────────────────────────────────────────────────────────────
// RetailPilot API — TypeScript type definitions
//
// Mirrors backend Pydantic schemas. One interface per backend schema class.
// All monetary values are plain numbers (INR). All dates are ISO-8601 strings.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envelope returned by every paginated list endpoint.
 * `data` is the current page; use `has_next` / `has_previous` to drive pagination UI.
 */
export interface PaginatedResponse<T> {
  data: T[]
  total_items: number
  total_pages: number
  current_page: number
  page_size: number
  has_next: boolean
  has_previous: boolean
}

/** Body for `POST /items/{id}/stock` and `POST /items/{id}/variants/{vid}/stock`. */
export interface StockAdjust {
  /** Signed quantity change. Positive = stock in, negative = stock out. */
  delta: number
  /** Human-readable reason written to the StockAudit record. */
  reason?: string
}

/**
 * Single company/shop profile record.
 * Used to populate the print header on GST invoices and receipts.
 */
export interface CompanyProfile {
  id: number
  shop_name: string
  shop_address?: string
  shop_phone?: string
  /** GSTIN in the format `22AAAAA0000A1Z5` */
  shop_gstin?: string
  /** Default tax rate applied to new invoices (e.g. 18 for 18%). */
  default_tax_rate: number
  /** Default credit period in days before an unpaid invoice is considered overdue (default: 60). */
  default_credit_days: number
  /** Currency symbol shown in the UI (default: `₹`). */
  currency_symbol: string
  receiver_bank_name?: string
  receiver_account_number?: string
  receiver_ifsc_code?: string
  upi_id?: string
  created_at: string
  updated_at?: string
}

/** Full customer fields used for create/update forms. */
export interface CustomerBase {
  name: string
  phone_number?: string
  email?: string
  address?: string
  gstin?: string
  /** `'Retail'` or `'Wholesale'` */
  customer_type?: string
  /** Credit period in days (e.g. 30 = net-30). */
  credit_days?: number
  /** Maximum outstanding balance allowed. */
  credit_limit?: number
  /** `'percent'` or `'flat'` — type of markup applied to all invoices for this customer. */
  price_markup_type?: string
  /** Markup amount (e.g. 15 for 15% or 50 for ₹50). */
  price_markup_value?: number
  /** `'percent'` or `'flat'` — type of discount applied to all invoices for this customer. */
  price_discount_type?: string
  /** Discount amount (e.g. 10 for 10% or 30 for ₹30). */
  price_discount_value?: number
  notes?: string
}

/** Full customer detail (returned by `GET /customers/{id}`). */
export interface Customer extends CustomerBase {
  id: number
  created_at: string
  updated_at?: string
}

/** Compact customer row returned by the paginated list endpoint. */
export interface CustomerListResponse {
  id: number
  name: string
  phone_number?: string
  customer_type: string
  credit_days?: number
  credit_limit?: number
  price_markup_type?: string
  price_markup_value?: number
  price_discount_type?: string
  price_discount_value?: number
}

/** Full supplier fields. */
export interface SupplierBase {
  name: string
  contact_person?: string
  phone_number?: string
  address?: string
  gstin?: string
  supplier_bank_name?: string
  supplier_bank_account_number?: string
  supplier_bank_ifsc_code?: string
  notes?: string
}

/** Full supplier detail. */
export interface Supplier extends SupplierBase {
  id: number
  created_at: string
  updated_at?: string
}

/** Compact supplier row for the list view. */
export interface SupplierListResponse {
  id: number
  name: string
  phone_number?: string
  gstin?: string
}

/**
 * A size/colour variant of a catalogue item.
 * Only used when `ItemBase.has_variants = true`.
 */
export interface ItemVariant {
  id: number
  item_id: number
  /** The variant label, e.g. `'Large'` or `'Red'`. */
  variant_value: string
  sku?: string
  stock_quantity: number
  /** When set, overrides the parent item's `selling_price_retail` for this variant. */
  price_override?: number
  /** Per-variant low stock alert threshold. Falls back to parent item threshold when null. */
  low_stock_threshold?: number
  created_at: string
}

/** Full item fields used for create/update forms. */
export interface ItemBase {
  item_name: string
  brand_name: string
  sku?: string
  material?: string
  purchase_price?: number
  selling_price_retail: number
  selling_price_wholesale: number
  current_stock_quantity?: number
  unit_of_measurement?: string
  low_stock_threshold?: number
  enable_low_stock_alert?: boolean
  /** When true, stock is tracked at variant level instead of parent level. */
  has_variants?: boolean
  /** E.g. `'Size'` or `'Colour'`. */
  variant_type?: string
  /** HSN/SAC code required on GST invoices when `gst_rate > 0`. */
  hsn_sac_code?: string
  /** Item-level GST rate % (e.g. `18`). Overrides invoice-level rate. */
  gst_rate?: number
  category?: string
  supplier_id?: number
}

/** Full item detail including variants. */
export interface Item extends ItemBase {
  id: number
  created_at: string
  updated_at?: string
  variants?: ItemVariant[]
}

/**
 * Compact item row returned by `GET /items/`.
 * When `has_variants=true`, `current_stock_quantity` is the sum across all variants.
 * `is_low_stock` is computed server-side.
 */
export interface ItemListResponse {
  id: number
  item_name: string
  brand_name: string
  sku?: string
  unit_of_measurement?: string
  current_stock_quantity: number
  selling_price_retail: number
  selling_price_wholesale: number
  enable_low_stock_alert: boolean
  low_stock_threshold?: number
  has_variants?: boolean
  variant_type?: string
  hsn_sac_code?: string
  gst_rate?: number
  category?: string
  supplier_id?: number
  supplier_name?: string
  variants_count?: number
  variants?: ItemVariant[]
  /** True when `enable_low_stock_alert=true` and `current_stock_quantity <= low_stock_threshold`. */
  is_low_stock?: boolean
  purchase_price?: number
}

/** A single line item inside an invoice. */
export interface InvoiceLineItem {
  item_id: number
  item_name?: string
  variant_id?: number
  variant_value?: string
  quantity: number
  price: number
  discount_amount?: number
  discount_type?: 'amount' | 'percent'
  total: number
  gst_rate?: number
  hsn_sac_code?: string
}

/**
 * Customer created inline during invoice creation.
 * Avoids a separate customer-create API call.
 */
export interface InlineCustomer {
  name: string
  phone_number?: string
  address?: string
  gstin?: string
  customer_type?: string
  notes?: string
}

/** Common fields for invoice create and edit. */
export interface InvoiceBase {
  customer_id?: number
  invoice_number?: string
  /** ISO date string, e.g. `'2026-04-11'` */
  invoice_date?: string
  /** ISO date string for payment due date. */
  due_date?: string
  line_items: InvoiceLineItem[]
  discount_type?: 'amount' | 'percent'
  discount_amount?: number
  /** Invoice-level tax rate % (e.g. `18`). Item-level `gst_rate` takes precedence if set. */
  tax_rate?: number
  po_number?: string
  shipping_address?: string
  notes?: string
  payment_status?: 'paid' | 'partial' | 'unpaid'
  grand_total?: number
}

/** Body for `POST /invoices/`. Either `customer_id` or `new_customer` must be provided. */
export interface InvoiceCreate extends InvoiceBase {
  new_customer?: InlineCustomer | null
}

/** Full invoice detail (returned by `GET /invoices/{id}`). */
export interface Invoice extends InvoiceBase {
  id: number
  customer_name?: string
  customer_type?: string
  amount_paid?: number
  sub_total: number
  total_tax_amount: number
  discount_amount: number
  grand_total: number
  created_at: string
  updated_at?: string
}

/**
 * Compact invoice row returned by `GET /invoices/`.
 * `total_amount` = `grand_total`. `payment_status` is `'paid' | 'partial' | 'unpaid'`.
 */
export interface InvoiceListResponse {
  id: number
  invoice_number: string
  customer_name: string
  customer_id: number
  customer_type?: string
  invoice_date: string
  due_date?: string
  total_amount: number
  amount_paid?: number
  payment_status: string
}

/** Response from `POST /invoices/calculate` — preview totals without saving. */
export interface InvoiceCalculationResponse {
  subtotal: number
  discount_amount: number
  tax_amount: number
  grand_total: number
}

/** Reason categories for goods returns. */
export enum ReturnReasonCategory {
  DAMAGED = "damaged_goods",
  UNABLE_TO_PAY = "was_not_able_to_pay",
  UNABLE_TO_SELL = "was_not_able_to_sell",
  BETTER_DEAL = "found_a_better_deal",
  QUALITY_ISSUE = "quality_issue",
  WRONG_ITEM = "wrong_item_delivered",
  OTHER = "other",
}

/**
 * A single stock movement record.
 * Written automatically on invoice create/delete, return create/delete, and manual adjustments.
 */
export interface StockAuditEntry {
  id: number
  item_id: number
  item_name?: string
  variant_id?: number
  variant_value?: string
  /** Signed quantity change. Positive = stock in, negative = stock out. */
  delta: number
  /** Stock quantity after this movement was applied. */
  delta_after: number
  reason?: string
  created_at: string
}

/** A single line item within a return receipt. */
export interface ReturnLineItemBase {
  item_id: number
  quantity_returned: number
  /** Credit amount for this line (quantity × price). */
  amount: number
  reason?: string
  reason_category?: ReturnReasonCategory
}

export interface ReturnLineItemCreate extends ReturnLineItemBase {}

export interface ReturnLineItem extends ReturnLineItemBase {
  id: number
  return_receipt_id: number
  item_id: number
  item_name?: string
  quantity_returned: number
  amount: number
  reason?: string
  reason_category?: ReturnReasonCategory
}

/** Body for `POST /returns/`. */
export interface ReturnReceiptCreate extends ReturnReceiptBase {
  line_items: ReturnLineItemCreate[]
  is_partial: boolean
  total_items_in_invoice: number
  items_returned_count: number
}

export interface ReturnReceiptBase {
  invoice_id: number
  return_date: string
  total_credit: number
  notes?: string
}

/**
 * Full goods return detail.
 * On create, a `credit_note` payment is auto-created and FIFO-allocated to outstanding invoices.
 */
export interface ReturnReceipt extends ReturnReceiptBase {
  id: number
  invoice_id: number
  invoice_number: string
  invoice_date: string
  customer_name?: string
  is_partial: boolean
  total_items_in_invoice: number
  items_returned_count: number
  reason_category?: string
  total_credit: number
  notes: string
  return_date: string
  created_at: string
  line_items: ReturnLineItem[]
  stock_audit?: StockAuditEntry[]
}

/** How much of a payment was applied to a specific invoice (FIFO allocation detail). */
export interface PaymentAllocation {
  id: number
  payment_id: number
  invoice_id: number
  invoice_number: string | null
  allocated_amount: number
  created_at: string
}

/**
 * A customer payment record.
 * `amount` is immutable after creation. Use PATCH to update `date`, `payment_method`, or `notes`.
 * `credit_balance` holds any surplus not allocated to an invoice (rare).
 */
export interface Payment {
  id: number
  customer_id: number
  customer_name: string | null
  date: string
  amount: number
  payment_method: string | null
  reference_number: string | null
  credit_balance: number | null
  notes: string | null
  created_at: string
  allocations: PaymentAllocation[]
}

/** Body for `POST /payments/`. FIFO allocation happens automatically. */
export interface PaymentCreate {
  customer_id: number
  /** ISO date string, e.g. `'2026-04-11'` */
  date: string
  amount: number
  /** `'cash'` | `'upi'` | `'card'` | `'cheque'` | `'bank_transfer'` */
  payment_method?: string
  reference_number?: string
  notes?: string
}

/** Body for `PATCH /payments/{id}`. Amount cannot be changed here. */
export interface PaymentUpdate {
  date?: string
  payment_method?: string
  reference_number?: string
  notes?: string
}

/** Invoice row as shown in the per-customer ledger. */
export interface InvoiceLedger {
  id: number
  invoice_number: string
  invoice_date: string
  due_date?: string
  grand_total: number
  amount_paid: number
  unpaid: number
  payment_status: 'Paid' | 'Partially Paid' | 'Unpaid'
}

/** Full customer ledger — all invoices + payments + summary totals. */
export interface CustomerLedger {
  customer_id: number
  customer_name: string
  customer_phone?: string
  customer_address?: string
  customer_gstin?: string
  /** Customer-level credit period in days; overrides company default when set. */
  credit_days?: number
  opening_balance: number
  total_invoiced: number
  total_paid: number
  total_unpaid: number
  invoices: InvoiceLedger[]
  payments: Payment[]
}

/** A single FIFO allocation detail as shown on the invoice detail page. */
export interface InvoiceAllocationDetail {
  id: number
  payment_id: number
  date: string
  allocated_amount: number
  notes?: string
  created_at: string
}

/**
 * Per-customer receivables summary — returned by `GET /customers/outstanding/`.
 * Computed in a single SQL aggregate (no N+1).
 */
export interface CustomerOutstanding {
  id: number
  name: string
  phone_number?: string
  customer_type: string
  total_outstanding: number
  overdue_amount: number
  overdue_invoice_count: number
  unpaid_invoice_count: number
  oldest_unpaid_date?: string
}

/** A single customer's row in the AR aging report. */
export interface AgingBucket {
  customer_id: number
  customer_name: string
  customer_type: string
  /** Not yet due (no due_date, or due_date ≥ today). */
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total_outstanding: number
}

/** Response from `GET /reports/aging/`. `totals` sums all customer rows. */
export interface AgingReportResponse {
  rows: AgingBucket[]
  totals: AgingBucket
}

export interface SalesByMethod {
  method: string
  count: number
  total: number
}

export interface SalesByType {
  customer_type: string
  count: number
  total: number
}

/** Response from `GET /reports/daily-summary/`. */
export interface DailySummaryResponse {
  date: string
  invoice_count: number
  total_sales: number
  by_customer_type: SalesByType[]
  payment_count: number
  total_collected: number
  by_payment_method: SalesByMethod[]
}

/** One month's revenue data in the revenue report series. */
export interface MonthlyRevenue {
  /** `'YYYY-MM'` format */
  month: string
  /** `'Jan 2026'` format */
  month_label: string
  retail: number
  wholesale: number
  total: number
  invoice_count: number
}

/** Top customer by revenue for the selected period. */
export interface TopCustomer {
  customer_id: number
  customer_name: string
  customer_type: string
  total: number
  invoice_count: number
}

/** Period totals for the revenue report summary tile. */
export interface RevenueSummary {
  retail_total: number
  wholesale_total: number
  grand_total: number
  /** Retail as a percentage of grand_total. */
  retail_pct: number
  /** Wholesale as a percentage of grand_total. */
  wholesale_pct: number
  invoice_count: number
}

/** Response from `GET /reports/revenue/`. Months with no invoices are included with zero values. */
export interface RevenueReportResponse {
  months: MonthlyRevenue[]
  top_customers: TopCustomer[]
  summary: RevenueSummary
  period_months: number
}

/** Single GST rate slab row (also used as the totals row). */
export interface GstSlab {
  rate: number
  invoice_count: number
  taxable_value: number
  cgst: number
  sgst: number
  total_tax: number
  gross_billed: number
}

/** Response from `GET /reports/gst-summary/`. */
export interface GstSummaryResponse {
  from_date: string
  to_date: string
  slabs: GstSlab[]
  totals: GstSlab
}

/** One month row in the P&L breakdown. */
export interface PnLMonth {
  month: string         // 'YYYY-MM'
  month_label: string   // 'Apr 2026'
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin_pct: number
  invoice_count: number
}

export interface PnLSummary {
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin_pct: number
  items_without_cost: number  // line items excluded from COGS (no purchase_price)
}

/** Response from `GET /reports/pnl/`. */
export interface PnLResponse {
  from_date: string
  to_date: string
  months: PnLMonth[]
  summary: PnLSummary
}

/**
 * Response from `POST /invoices/counter-sale/`.
 * `change_due` = `amount_paid - grand_total` (cash returned to customer).
 */
export interface CounterSaleResult {
  id: number
  invoice_number: string
  invoice_date: string
  customer_id: number
  customer_name: string
  grand_total: number
  amount_paid: number
  /** Surplus cash returned to the customer. Zero if exact payment. */
  change_due: number
  payment_id: number
  payment_method: string
  payment_status: string
  line_items: InvoiceLineItem[]
}
