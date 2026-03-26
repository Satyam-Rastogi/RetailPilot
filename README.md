# RetailPilot Ledger System

A FIFO-based ledger system for wholesale customers with per-customer ledgers, a complete frontend ledger UI, seed data validation, and an extensible plan for AI-assisted orchestration. The project emphasizes data integrity, auditable allocations, and a modern frontend UI for inspecting ledgers, invoices, and payments.

## Why RetailPilot

- FIFO allocation: payments are applied to oldest unpaid invoices first, ensuring predictable, auditable behavior.
- Explicit ORM relationships: back_populates are used to preserve clear bidirectional links between entities, avoiding common ORM pitfalls.
- End-to-end visibility: per-customer ledgers, per-invoice status, and per-payment allocations are exposed via a robust API and a polished frontend.
- Seeded data and validation: a comprehensive seed makes it easy to reproduce scenarios and verify integrity.
- Extensible roadmap: designed to accommodate pagination, caching, lazy loading, and AI-assisted orchestration.

## Tech Stack

- Backend: FastAPI, SQLAlchemy ORM, SQLite (local dev), Uvicorn
- Frontend: React + TypeScript, React Query
- Tests: PyTest with HTTPX for API tests
- Seed & Migrations: Python scripts for seeding and validation

## Core Concepts & Data Model

- Core Entities:
  - Customer: basic profile data with type (Wholesale/Retail).
  - Invoice: represents charges to a customer; includes grand_total, amount_paid, and unpaid balance.
  - Payment: money received from a customer; can have multiple allocations to invoices.
  - PaymentAllocation: maps a payment to a specific invoice with an allocated amount.
- FIFO Allocation:
  - Payments post to the oldest unpaid invoices first.
  - Overpayments create a credit balance recorded in the payment notes; no forward-invariance on invoices.
  - Deleting a payment reverses allocations back to the invoices.
- Ledger Calculations:
  - total_invoiced: sum of all invoices’ grand_total for a customer.
  - total_paid: sum of all payments for a customer.
  - total_unpaid: total_invoiced - total_paid.

## Data Model Details

- Customer (CustomerModel)
  - id: integer, primary key
  - name: string
  - phone_number: string
  - address: string
  - gstin: string
  - customer_type: string (Wholesale/Retail)
  - notes: text
  - created_at / updated_at: timestamps
  - Relationships: invoices, payments

- Invoice (InvoiceModel)
  - id, invoice_number, invoice_date
  - customer_id: FK to customers.id
  - sub_total, tax_rate, total_tax_amount, grand_total
  - discount_type, discount_amount, notes
  - amount_paid: amount already paid (sum of allocations)
  - payment_status: Unpaid / Partially Paid / Paid
  - created_at / updated_at
  - Relationships: customer, line_items, payment_allocations

- Payment (PaymentModel)
  - id, customer_id, date, amount, notes, created_at
  - Relationships: customer, allocations

- PaymentAllocation (PaymentAllocationModel)
  - id, payment_id, invoice_id, allocated_amount, created_at
  - Relationships: payment, invoice

## API Surface (Selected Endpoints)

- Payments
  - POST /api/v1/payments/ – Create a payment; FIFO allocation happens automatically
  - GET /api/v1/payments/ – List payments; supports filters by customer_id, date_from, date_to, skip, limit
  - GET /api/v1/payments/{payment_id} – Details of a payment with allocations
  - PATCH /api/v1/payments/{payment_id} – Update non-financial fields (date, notes)
  - DELETE /api/v1/payments/{payment_id} – Delete a payment and reverse allocations
- Ledger
  - GET /api/v1/payments/customer/{customer_id}/ledger – Ledger summary with invoices and payments
  - GET /api/v1/payments/customer/{customer_id}/ledger/invoices – Invoice ledger only
- Invoices & Items
  - Endpoints for invoices and items used by the ledger UI
- AI Assistant (Phase 6+)
  - POST /api/v1/assistant/execute – Accepts structured intents and executes plans (dry-run by default)

## Frontend Overview

- Ledger Page: per-customer ledger with a summary of Total Invoiced, Total Paid, and Total Unpaid.
- Invoices Table: shows per-invoice totals and a status indicator (Unpaid / Partially Paid / Paid).
- Payments Table: shows date, amount, notes, and per-payment allocations.
- Payment Management: create, edit (date/notes only), and delete with confirmation.
- Date Range Filtering: filter ledgers by start/end date.

## Seed Data & Validation

- Seed covers: 8 customers (5 Wholesale, 3 Retail), 12 items, 5 suppliers, 24 invoices, 13 payments, and 22 allocations.
- Validation rules:
  - grand_total = sub_total + tax - discount
  - amount_paid equals sum of allocations for each invoice
  - outstanding equals grand_total - amount_paid

## Getting Started (Local Development)

Prerequisites:
- Backend: Python 3.11+, SQLite, virtualenv
- Frontend: Node.js 18±, npm/yarn

Backend setup:
- cd backend
- python -m venv venv
- Windows: venv\Scripts\activate, Linux/macOS: source venv/bin/activate
- pip install -r requirements.txt
- PYTHONPATH=. uvicorn app.main:app --reload --port 8000

Frontend setup:
- cd frontend
- npm install
- npm run dev

Seed Data & Validation:
- Run seed script to populate data and validate integrity (see backend/scripts and seed files)

Tests:
- Backend: pytest tests/ -v

## Observability, Security & Auditing

- The system records created_at timestamps for payments and allocations to enable full audit trails.
- Security and secrets handling are designed for future extension; plan for role-based mutations and audit logging in subsequent phases.

## Roadmap & Phases

- Phase 1: ORM Fix – explicit back_populates to remove ORM collisions
- Phase 2: FIFO Allocation Engine & Ledger APIs – complete
- Phase 3: Frontend Ledger UI – complete
- Phase 4: Seed, Migrations & Validation – complete
- Phase 5: Payment Management UI (create/edit/delete with FIFO updates) – complete
- Phase 6+: AI Orchestration & Pagination/Caching/Lazy Loading – upcoming
- Phase 7+: Bulk operations, reports, multi-tenancy – future

## Contributing

- Follow the repository’s guidelines for PRs and testing
- Keep changes surgical and well-scoped to avoid regressions
- Ensure tests pass before requesting a review

## Licensing

- Project licensed under the MIT license (as applicable in repository).

## Appendix: Quick Start Examples

- Get the ledger for a customer
  - `curl -X GET http://localhost:8000/api/v1/payments/customer/1/ledger`

- Create a payment for a customer
  - `curl -X POST http://localhost:8000/api/v1/payments/ \n  -H "Content-Type: application/json" \n  -d '{"customer_id":1,"date":"2025-12-01","amount":1000,"notes":"Seed payment"}'`

- View a payment with allocations
  - `curl -X GET http://localhost:8000/api/v1/payments/1`


