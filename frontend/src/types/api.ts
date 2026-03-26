export interface StockAdjust {
  delta: number
  reason?: string
}

export interface CompanyProfile {
  id: number
  shop_name: string
  shop_address?: string
  shop_phone?: string
  shop_gstin?: string
  default_tax_rate: number
  currency_symbol: string
  receiver_bank_name?: string
  receiver_account_number?: string
  receiver_ifsc_code?: string
  created_at: string
  updated_at?: string
}

export interface CustomerBase {
  name: string
  phone_number?: string
  email?: string
  address?: string
  gstin?: string
  customer_type?: string
  credit_days?: number
  notes?: string
}

export interface Customer extends CustomerBase {
  id: number
  created_at: string
  updated_at?: string
}

export interface CustomerListResponse {
  id: number
  name: string
  phone_number?: string
  customer_type: string
  credit_days?: number
}

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

export interface Supplier extends SupplierBase {
  id: number
  created_at: string
  updated_at?: string
}

export interface SupplierListResponse {
  id: number
  name: string
  phone_number?: string
  gstin?: string
}

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
}

export interface Item extends ItemBase {
  id: number
  created_at: string
  updated_at?: string
}

export interface ItemListResponse {
  id: number
  item_name: string
  brand_name: string
  sku?: string
  current_stock_quantity: number
  selling_price_retail: number
  selling_price_wholesale: number
  enable_low_stock_alert: boolean
  low_stock_threshold?: number
  is_low_stock?: boolean
  unit_of_measurement?: string
}

export interface InvoiceLineItem {
  item_id: number
  item_name?: string
  quantity: number
  price: number
  discount_amount?: number
  discount_type?: 'amount' | 'percent'
  total: number
}

export interface InlineCustomer {
  name: string
  phone_number?: string
  address?: string
  gstin?: string
  customer_type?: string
  notes?: string
}

export interface InvoiceBase {
  customer_id?: number
  invoice_number?: string
  invoice_date?: string
  due_date?: string
  line_items: InvoiceLineItem[]
  discount_type?: 'amount' | 'percent'
  discount_amount?: number
  tax_rate?: number
  po_number?: string
  shipping_address?: string
  notes?: string
  payment_status?: 'paid' | 'partial' | 'unpaid'
  grand_total?: number
}

export interface InvoiceCreate extends InvoiceBase {
  new_customer?: InlineCustomer | null
}

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

export interface InvoiceListResponse {
  id: number
  invoice_number: string
  customer_name: string
  customer_id: number
  customer_type?: string
  invoice_date: string
  due_date?: string
  total_amount: number
  payment_status: string
}

export interface InvoiceCalculationResponse {
  subtotal: number
  discount_amount: number
  tax_amount: number
  grand_total: number
}

export enum ReturnReasonCategory {
  DAMAGED = "damaged_goods",
  UNABLE_TO_PAY = "was_not_able_to_pay",
  UNABLE_TO_SELL = "was_not_able_to_sell",
  BETTER_DEAL = "found_a_better_deal",
  QUALITY_ISSUE = "quality_issue",
  WRONG_ITEM = "wrong_item_delivered",
  OTHER = "other",
}

export interface StockAuditEntry {
  id: number
  item_id: number
  item_name?: string
  quantity_change: number
  reason: string
  created_at: string
}

export interface ReturnLineItemBase {
  item_id: number
  quantity_returned: number
  amount: number
  reason?: string
  reason_category?: ReturnReasonCategory
}

export interface ReturnLineItemCreate extends ReturnLineItemBase {
}

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

export interface ReturnReceiptBase {
  invoice_id: number
  return_date: string
  total_credit: number
  notes?: string
}

export interface ReturnReceiptCreate extends ReturnReceiptBase {
  line_items: ReturnLineItemCreate[]
  is_partial: boolean
  total_items_in_invoice: number
  items_returned_count: number
}

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

export interface PaymentAllocation {
  id: number
  payment_id: number
  invoice_id: number
  invoice_number: string | null
  allocated_amount: number
  created_at: string
}

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

export interface PaymentCreate {
  customer_id: number
  date: string
  amount: number
  payment_method?: string
  reference_number?: string
  notes?: string
}

export interface PaymentUpdate {
  date?: string
  payment_method?: string
  reference_number?: string
  notes?: string
}

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

export interface CustomerLedger {
  customer_id: number
  customer_name: string
  total_invoiced: number
  total_paid: number
  total_unpaid: number
  invoices: InvoiceLedger[]
  payments: Payment[]
}

export interface InvoiceAllocationDetail {
  id: number
  payment_id: number
  date: string
  allocated_amount: number
  notes?: string
  created_at: string
}

export interface WholesaleLedgerSummary {
  customer_id: number
  customer_name: string
  customer_type: string
  total_invoiced: number
  total_paid: number
  total_unpaid: number
  last_activity: string | null
  invoice_count: number
  payment_count: number
}
