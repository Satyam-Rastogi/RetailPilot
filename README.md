# RetailPilot Ledger System

RetailPilot is a FIFO-based payment ledger system designed for wholesale clients. It tracks invoices, payments, and allocations, with a frontend ledger UI to visualize totals, allocation history, and per-invoice status. It emphasizes explicit ORM relationships, end-to-end data integrity, and a clean, maintainable codebase.

## Prerequisites
- Backend: Python 3.11+ (or your project target), SQLite support; virtual environment optional
- Frontend: Node.js 14+ (or project-consistent version), npm or pnpm
- Git for version control

## Quick Start
- Clone: git clone <repo-url>
- Install dependencies:
  - Backend: cd backend; python -m venv env; source env/bin/activate (or .\env\Scripts\activate); pip install -r requirements.txt
  - Frontend: cd frontend; npm install
- Run locally:
  - Backend: cd backend; PYTHONPATH=. uvicorn app.main:app --reload --port 8000
  - Frontend: cd frontend; npm run dev
- Access:
  - API docs: http://localhost:8000/docs
  - Frontend: http://localhost:5173

## Project Structure
- backend/: FastAPI backend with SQLAlchemy models for Customer, Invoice, Payment, and PaymentAllocation
- frontend/: React + TypeScript frontend with Ledger UI

## Core Features
- FIFO allocation: payments applied to oldest unpaid invoices first
- Per-invoice accounting: grand_total, amount_paid, unpaid, status
- Payment allocations: trace allocations per payment
- Credit balances: unallocated payment portion treated as credit
- Ledger UI: per-customer ledger with totals, invoices, and payments

## Data Model Overview
- Payment, PaymentAllocation, Invoice, Customer
- Explicit back_populates relationships (no backrefs) for auditability
- Calculations enforced: grand_total = sub_total + tax - discount; amount_paid = sum(all allocations); outstanding = grand_total - amount_paid

## How to Contribute
- Branch off main for features
- Run backend tests with pytest and frontend tests with your preferred framework
- Run linters/formatters if configured in project

## Documentation & Roadmap
- LEDGER.md: API reference and usage
- BUILD_PROGRESS.md: project progress and phase status
- project_notes.md: design decisions and implementation rationale
- LEDGER-related code lives in backend/app/api/v1/endpoints/payments.py and frontend LedgerPage

## Release & Rollout
- Follow standard GitHub PR workflow
- Maintain a clean history with focused commits
- Ensure seed data is consistent and tests pass

## License
- Unspecified in this exercise

