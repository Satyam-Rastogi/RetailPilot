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

> Full interactive docs with request/response schemas available at **`http://localhost:8000/docs`** (Swagger UI) or **`http://localhost:8000/redoc`** (ReDoc) when the backend is running.

```
GET  /api/v1/invoices/summary/              # KPI counts + outstanding totals (dashboard)
GET  /api/v1/invoices/                      # list with filters: payment_status, overdue_only, customer_name, date range
POST /api/v1/invoices/                      # create invoice + line items; validates stock before deducting
POST /api/v1/invoices/counter-sale/         # invoice + immediate payment in one transaction (retail counter)
GET  /api/v1/invoices/{id}                  # detail with line items, payments, returns
DELETE /api/v1/invoices/{id}               # blocked if amount_paid > 0
GET  /api/v1/invoices/export/               # streaming CSV export with same filters as list

GET  /api/v1/payments/customer/{id}/ledger  # FIFO ledger: invoices + payments + totals with date filter
POST /api/v1/payments/                      # create payment; runs FIFO allocation automatically
DELETE /api/v1/payments/{id}               # reverses allocations, resets invoice statuses

GET  /api/v1/customers/outstanding/         # all customers: outstanding, overdue amount/count, oldest unpaid date (one SQL aggregate)

GET  /api/v1/reports/aging/                 # unpaid invoices per customer bucketed by days overdue (Current/1-30/31-60/61-90/90+)
GET  /api/v1/reports/daily-summary/         # invoices + collections for a date split by customer type and payment method
GET  /api/v1/reports/revenue/               # monthly revenue by customer type for a configurable lookback period
GET  /api/v1/reports/inventory-value/       # full stock statement: per-item cost/retail value, velocity (30d), by-brand + by-category
GET  /api/v1/reports/best-sellers/          # top items/brands/price-brackets/segments — period, metric, customer_type filters
GET  /api/v1/reports/gst-summary/           # GST liability by rate slab with CGST/SGST split

GET  /api/v1/items/                         # list with search + low_stock_only filter
POST /api/v1/items/{id}/stock               # manual adjustment with reason; writes StockAudit row
GET  /api/v1/items/stock-audit/             # paginated audit log

POST /api/v1/returns/                       # create return; validates qty, restores stock, creates credit_note payment
DELETE /api/v1/returns/{id}                # reverses FIFO allocation + stock + deletes credit_note payment
```

## Planned: AI Chatbot

A Claude-powered conversational agent that can perform any action available through the existing API — no separate logic needed, just tool use wrappers around the existing endpoints.

### Interfaces

| Interface | Description |
|---|---|
| **Web text** | Floating `ChatWidget` in the React app — message history, streaming responses |
| **Web voice** | Push-to-talk via browser Web Speech API (MVP) → upgradeable to Deepgram/Whisper + ElevenLabs |
| **Telegram** | `python-telegram-bot` webhook — text the bot from phone to query/act |

### Architecture

```
User message (text/voice/Telegram)
        ↓
  ChatAgent (backend/app/chatbot/agent.py)
        ↓ calls Anthropic Claude with tool use
  tools.py — wraps existing /api/v1/* endpoints
        ↓ executes tool calls against DB
  Natural language response → back to interface
```

### Example Queries

- "What does Ramesh owe?" → outstanding balance + overdue invoices
- "Record ₹5000 cash payment from Ramesh" → creates payment via FIFO engine
- "Which items are running low?" → low-stock list
- "Show me today's sales" → dashboard KPIs
- "Show aging report" → bucket table formatted as text

### Environment Variables (when implemented)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API access |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_WEBHOOK_URL` | Public HTTPS URL for Telegram webhook |

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

- Invoice management (create, view, edit, delete) with stock validation
- FIFO payment allocation engine with full reversal on delete
- Per-customer ledger with date range filtering (invoices + payments both filtered)
- Return receipts with quantity validation against original invoice
- Delete return: `DELETE /returns/{id}` reverses FIFO allocations, credit note, and stock
- Return credits auto-allocated via FIFO into customer payment history
- Per-item GST rate (0/5/12/18/28%) with CGST/SGST breakdown grouped by rate
- HSN-wise tax summary table on invoice detail and print layout
- GST-compliant PDF invoice: two print templates — full GST Invoice (B2B, IGST/CGST+SGST routing based on state codes, GSTINs, place of supply, amount in words) and thermal Receipt (B2C)
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
- Keyboard accessibility: Escape/Tab/Enter/Arrow with focus trap on all modals
- GSTIN format validation (regex) on customer, supplier, and company profile
- Alembic migration infrastructure (all schema changes version-controlled)
- Gross margin % column on items table (retail gross margin, color-coded)
- Low-stock badge on sidebar Inventory nav item (live count, refreshes every 60s)
- "New Invoice" button on customer LedgerPage (pre-fills modal with that customer)
- HSN/SAC code required when `gst_rate > 0` on invoice line items (API validation)
- PO reference number on invoices (field, modal input, detail view, print)
- Global outstanding receivables: `GET /customers/outstanding/` (single SQL aggregate, no N+1) + Receivables page with overdue flags, type filter, amount filter, sortable columns, "Show Settled" toggle
- Credit limit per customer: `credit_limit` field + breach/near-limit warning banner in invoice creation modal
- Aging report: `GET /reports/aging/` bucketing unpaid invoices into Current/1–30/31–60/61–90/90+ day buckets + summary tiles + sortable table
- One-step counter sale: `POST /invoices/counter-sale/` + `CounterSaleModal` with Walk-in default, payment method, change due display, success receipt overlay
- Daily sales summary: `GET /reports/daily-summary/` + `DailySummaryPage` split by customer type and payment method with quick-date navigation
- Revenue analytics: `GET /reports/revenue/` + `RevenueAnalyticsPage` — stacked bar chart (Recharts), retail/wholesale split, top-10 customers by revenue
- Customer statement: `CustomerStatementPage` — unified invoice+payment timeline, opening/closing balance, printable PDF
- Item categories: `category` field on items with text input in form modal
- Supplier↔Item linkage: `supplier_id` FK on items, supplier dropdown in item form
- Bulk invoice CSV export: `GET /invoices/export/` streaming with active filters
- URL-persistent filter state: all list/filter pages use `useSearchParams` — filters, search, and pagination survive browser back/refresh and are shareable via URL
- Analytics Hub at `/analytics` — 6-card navigation hub linking all report and analytics pages
- Inventory Analytics at `/analytics/inventory` — waffle chart (stock status distribution), inventory value by brand (horizontal bar), fast/slow movers scatter (Stars/Overstocked/At Risk/Dead Weight quadrants), full stock statement table with search/filter/sort
- Best Sellers at `/analytics/best-sellers` — 4 tabs: Items (podium top-3, sparklines, scatter, ranking), Brands (bar + table), Price Brackets (revenue/units by bracket), Segments (Wholesale vs Retail comparison)
- Backend analytics endpoints: `GET /reports/inventory-value/` (stock statement + brand aggregation), `GET /reports/best-sellers/` (period + customer_type + metric filters), `GET /reports/gst-summary/` (GST amounts by rate slab)
- Comprehensive Swagger/OpenAPI docs: every endpoint has `summary`, `description` (business rules + side effects in markdown), and `responses` error codes; typed response schemas (`InvoiceListResponse`, `InvoiceSummaryResponse`) replacing `dict` on list/summary endpoints; `openapi_tags` with descriptions for all 10 tag groups; full app-level markdown description at `/docs`
- TSDoc comments on all TypeScript interfaces (`types/api.ts`) and all service methods (`services/api.ts`) — field-level notes on non-obvious fields, business rule callouts (FIFO, payment immutability, soft-delete semantics)

### Open

- Soft delete for invoices/payments/returns (`deleted_at` timestamp + filter) (P2-4)
- AI chatbot: Claude-powered agent via web UI (text + voice) and Telegram (AI-1/2/3)

## Project Structure

```
RetailPilot/
├── backend/
│   ├── alembic/                   # migration scripts
│   │   └── versions/              # one file per migration
│   ├── app/
│   │   ├── api/v1/endpoints/      # FastAPI route handlers (9 files)
│   │   ├── core/                  # logging_config.py
│   │   ├── db/                    # session.py, base.py
│   │   ├── domain/                # entities, services (calculation_service.py)
│   │   ├── models/                # SQLAlchemy ORM models (11 model classes)
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   └── utils/                 # pagination, normalization
│   └── alembic.ini
├── frontend/
│   └── src/
│       ├── components/            # reusable UI (Pagination, CreateInvoiceModal, etc.)
│       ├── lib/                   # utils.ts, toast.ts
│       ├── pages/                 # one file per route (16 pages)
│       ├── services/api.ts        # typed API client (13 service objects, TSDoc comments)
│       └── types/api.ts           # all TypeScript interfaces (TSDoc comments)
└── context/                       # compact AI session context files (~14k tokens total)
    ├── 01_PROJECT.md              # stack, architecture decisions, module status
    ├── 02_STATUS.md               # completeness %, open gaps, session history
    ├── 03_DATA_MODEL.md           # all entities, relationships, FIFO algorithm
    ├── 04_API.md                  # all endpoints, service objects, TS interfaces
    ├── 05_FRONTEND.md             # routes, pages, components, state patterns
    └── 06_CODE_PATTERNS.md        # endpoint/page/migration templates
```
