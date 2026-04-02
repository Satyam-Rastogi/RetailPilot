# RetailPilot

A FIFO-based shop management system for small Indian retail and wholesale businesses. Handles invoicing, payments, ledgers, GST tax breakdowns, stock tracking, and returns — built to production quality as a solo project.

## Why RetailPilot

- **FIFO allocation:** payments apply to oldest unpaid invoices first — predictable, auditable, correct.
- **Per-item GST:** CGST/SGST split per rate, HSN-wise tax summary table on every invoice.
- **Three modes:** Retail (B2C walk-in, immediate payment), Wholesale (B2B credit/FIFO ledger), Mixed (both simultaneously).
- **Alembic migrations:** all schema changes version-controlled; no manual ALTER TABLE scripts.
- **Structured logging:** request-timing middleware, global exception handlers, per-module loggers.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy ORM, SQLite, Uvicorn |
| Migrations | Alembic (version-controlled schema) |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| State | TanStack Query (React Query) |
| UI | Framer Motion, Recharts, Lucide React, Sonner |
| Fonts | Syne (display), Inter (body), Geist Mono (numbers) |

## Data Model

### Core Entities

- **Customer** — `name`, `phone`, `email`, `address`, `gstin`, `customer_type` (Retail/Wholesale), `credit_days`
- **Supplier** — `name`, `contact_person`, `phone`, `gstin`, bank details
- **Item** — `item_name`, `sku`, `brand`, `selling_price_retail/wholesale`, `purchase_price`, `hsn_sac_code`, `gst_rate`, `current_stock_quantity`, `low_stock_threshold`, `is_active` (soft delete)
- **ItemVariant** — size/color variants with per-variant stock
- **Invoice** — `invoice_number`, `customer_id`, `invoice_date`, `due_date`, `grand_total`, `amount_paid`, `payment_status`
- **InvoiceLineItem** — `item_id`, `quantity`, `unit_price`, `gst_rate`, `hsn_sac_code` (snapshot at invoice time)
- **Payment** — `customer_id`, `date`, `amount`, `payment_method`, `reference_number`, `credit_balance`
- **PaymentAllocation** — maps a payment to a specific invoice with `allocated_amount`
- **ReturnReceipt** — `invoice_id`, `customer_id`, `total_credit`, `is_partial`
- **ReturnLineItem** — `item_id`, `quantity_returned`, `amount`, validated against original invoice qty
- **StockAudit** — `item_id`, `delta`, `delta_after`, `reason` — every stock movement logged
- **CompanyProfile** — `shop_name`, `shop_gstin`, `upi_id`, bank details, `default_tax_rate`

### FIFO Logic

- Payments allocate to oldest unpaid invoices first (order by `invoice_date ASC`)
- Overpayments set `PaymentModel.credit_balance`; not written to notes
- Return credits auto-create a `PaymentModel(payment_method="credit_note")` and FIFO-allocate
- Deleting a payment reverses all its `PaymentAllocation` rows and adjusts `invoice.amount_paid`

## API Endpoints (Selected)

```
GET  /api/v1/invoices/summary/              # KPI counts + outstanding totals (dashboard)
GET  /api/v1/invoices/                      # list with filters: payment_status, overdue_only, customer_name, date range
POST /api/v1/invoices/                      # create invoice + line items; validates stock before deducting
GET  /api/v1/invoices/{id}                  # detail with line items, payments, returns
DELETE /api/v1/invoices/{id}                # blocked if amount_paid > 0

GET  /api/v1/payments/customer/{id}/ledger  # FIFO ledger: invoices + payments + totals with date filter
POST /api/v1/payments/                      # create payment; runs FIFO allocation automatically
DELETE /api/v1/payments/{id}                # reverses allocations, resets invoice statuses

GET  /api/v1/items/                         # list with search + low_stock_only filter
POST /api/v1/items/{id}/adjust-stock        # manual adjustment with reason; writes StockAudit row
GET  /api/v1/items/stock-audit/             # paginated audit log

POST /api/v1/returns/                       # create return; validates qty, restores stock, creates credit_note payment
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# First run: creates DB schema and auto-stamps Alembic at head
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# After schema changes, generate and apply migrations:
alembic revision --autogenerate -m "describe_change"
alembic upgrade head
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # runs on http://localhost:5173
```

## Features

### Done

- Invoice management (create, view, delete) with stock validation
- FIFO payment allocation engine with full reversal on delete
- Per-customer ledger with date range filtering (invoices + payments both filtered)
- Return receipts with quantity validation against original invoice
- Return credits auto-allocated via FIFO into customer payment history
- Per-item GST rate (0/5/12/18/28%) with CGST/SGST breakdown grouped by rate
- HSN-wise tax summary table on invoice detail and print layout
- Stock management: adjust stock with reason, full audit log
- Soft delete for items (`is_active`) — history preserved
- Walk-in Customer auto-seeded (retail counter sales without creating a named customer)
- Payment method field (Cash/UPI/Card/Cheque/Bank Transfer) + reference number
- Auto price fill in invoice creation based on customer type (retail/wholesale)
- Server-side pagination on all list endpoints
- Server-side search on customers, suppliers, items, invoices
- Overdue invoice filter (`overdue_only`) + payment_status filter
- `due_date` on invoices, auto-calculated from `customer.credit_days`
- Dashboard KPI cards via `/invoices/summary/` (one SQL aggregate query)
- Low-stock items filtered at backend (`?low_stock_only=true`)
- GST invoice print layout with clean white styling
- Keyboard accessibility: Escape/Tab/Enter/Arrow with focus trap on all modals
- GSTIN format validation (regex) on customer, supplier, and company profile
- Alembic migration infrastructure with initial schema migration

### Open (P2 — Strategic)

- Global outstanding receivables view (P2-6) — all customers sorted by balance with overdue flags
- Credit limit per customer with breach warnings (P2-5)
- Revenue reporting / analytics dashboard (P2-1)
- GST-compliant PDF: place of supply, amount in words, IGST routing (P2-2)
- One-step retail counter sale (invoice + payment in single flow) (RET-2)
- Aging report: outstanding invoices bucketed by age (WS-1)
- Daily sales summary by payment method (RET-4)

## Project Structure

```
RetailPilot/
├── backend/
│   ├── alembic/                   # migration scripts
│   │   └── versions/              # one file per migration
│   ├── app/
│   │   ├── api/v1/endpoints/      # FastAPI route handlers
│   │   ├── core/                  # logging_config.py
│   │   ├── db/                    # session.py, base.py
│   │   ├── domain/                # entities, services (calculation_service.py)
│   │   ├── models/                # SQLAlchemy ORM models
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   └── utils/                 # pagination, normalization
│   └── alembic.ini
└── frontend/
    └── src/
        ├── components/            # reusable UI (Pagination, CreateInvoiceModal, etc.)
        ├── hooks/                 # useModalKeyboard
        ├── lib/                   # utils.ts, toast.ts
        ├── pages/                 # one file per route
        ├── services/api.ts        # typed API client
        └── types/api.ts           # all TypeScript interfaces
```
