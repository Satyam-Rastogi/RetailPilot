import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.api.v1 import api_router
from app.models import company_profile, customer, supplier, item, item_variant, invoice, return_receipt, payment  # noqa: F401 — registers models
from app.models.customer import CustomerModel
from app.core.logging_config import configure_logging, get_logger

# ── Logging ───────────────────────────────────────────────────────────────────
configure_logging()
logger = get_logger("retailpilot.main")

# ── Database ──────────────────────────────────────────────────────────────────
# Schema is managed by Alembic. create_all() here only applies to brand-new
# installs where no migration history exists yet (e.g. fresh dev clone).
# After the initial setup, always use `alembic upgrade head` for schema changes.
def _init_db() -> None:
    from sqlalchemy import inspect, text
    with engine.connect() as conn:
        has_version_table = inspect(engine).has_table("alembic_version")
        if has_version_table:
            # DB is managed by Alembic — don't touch it
            logger.info("Database under Alembic control — skipping create_all.")
            return
    # Fresh install: create all tables and stamp at head so Alembic takes over
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Fresh install: database schema created via create_all.")
        # Auto-stamp so future migrations work correctly
        from alembic.config import Config
        from alembic import command as alembic_command
        import os
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_command.stamp(alembic_cfg, "head")
        logger.info("Fresh install: Alembic version stamped at head.")
    except Exception as exc:
        logger.critical("Failed to initialise database: %s", exc, exc_info=True)
        raise

_init_db()

# ── Ensure Walk-in Customer exists ────────────────────────────────────────────
def _ensure_walkin_customer() -> None:
    db = SessionLocal()
    try:
        exists = db.query(CustomerModel).filter(
            CustomerModel.name == "Walk-in Customer"
        ).first()
        if not exists:
            db.add(CustomerModel(
                name="Walk-in Customer",
                customer_type="Retail",
                notes="System record — covers one-time / cash sales.",
            ))
            db.commit()
            logger.info("Walk-in Customer seeded.")
    finally:
        db.close()

_ensure_walkin_customer()

# ── OpenAPI tag descriptions ──────────────────────────────────────────────────
_OPENAPI_TAGS = [
    {
        "name": "Company Profile",
        "description": "Shop identity — name, address, GSTIN, bank details. Single record; GET returns it, POST creates it on first run, PUT updates it.",
    },
    {
        "name": "Customers",
        "description": (
            "Customer CRUD plus receivables intelligence.\n\n"
            "- **Walk-in Customer** is a system record (auto-seeded, protected from deletion) used for one-time cash sales.\n"
            "- `GET /outstanding/` runs a single SQL aggregate — no N+1 — and returns every customer's total outstanding and overdue amounts.\n"
            "- Supports search by name and filter by creation date."
        ),
    },
    {
        "name": "Suppliers",
        "description": "Supplier CRUD with bank-detail and GSTIN fields. Used to link items to their procurement source.",
    },
    {
        "name": "Items",
        "description": (
            "Inventory catalogue with variant support.\n\n"
            "- Items can have size/colour **variants** — when `has_variants=true`, stock is tracked at variant level.\n"
            "- `DELETE` soft-deletes (`is_active=false`); records remain in invoice history.\n"
            "- `POST /{id}/stock` writes a `StockAudit` row in addition to updating `current_stock_quantity`.\n"
            "- `GET /stock-audit/` returns full stock movement history, filterable by item, direction, and entry type."
        ),
    },
    {
        "name": "Invoices",
        "description": (
            "Sales invoice lifecycle — creation, editing, payment tracking, and CSV export.\n\n"
            "**Invoice number format:** `INV-{YEAR}-{0001}-{WS|RE}` (WS = Wholesale, RE = Retail).\n\n"
            "**Side effects on create:**\n"
            "- Stock is deducted for each line item.\n"
            "- Invoice sequence counter is incremented (per-year, per-type).\n\n"
            "**Side effects on edit:** stock delta is guarded — only net changes applied.\n\n"
            "**DELETE** is blocked if `amount_paid > 0`.\n\n"
            "`POST /counter-sale/` creates an invoice + full payment in a single atomic transaction and returns `change_due`."
        ),
    },
    {
        "name": "Stock",
        "description": "Manual stock adjustment endpoints. Each call writes a `StockAudit` record with delta and reason.",
    },
    {
        "name": "Returns",
        "description": (
            "Goods return handling.\n\n"
            "**On create:** validates return quantities against original invoice, restores stock, and creates a `credit_note` payment that is FIFO-allocated to outstanding invoices.\n\n"
            "**DELETE** fully reverses the return: undoes FIFO allocation, removes the credit_note payment, and corrects stock."
        ),
    },
    {
        "name": "Payments",
        "description": (
            "Customer payment lifecycle with FIFO allocation.\n\n"
            "**FIFO rule:** payments are always allocated to the oldest unpaid invoice first. This is deterministic and auditable.\n\n"
            "**Immutability:** payment `amount` is locked after creation. Only `date`, `payment_method`, and `notes` are editable.\n\n"
            "**DELETE** fully reverses: removes all allocations, restores invoice `amount_paid` and `payment_status`.\n\n"
            "Ledger endpoints aggregate invoice + payment history per customer for the receivables view."
        ),
    },
    {
        "name": "Reports",
        "description": (
            "Analytics and reporting endpoints — all read-only aggregations.\n\n"
            "| Endpoint | Purpose |\n"
            "|---|---|\n"
            "| `/aging/` | AR aging buckets (Current / 1-30 / 31-60 / 61-90 / 90+) |\n"
            "| `/daily-summary/` | Invoice count + total sales + payment breakdown for one day |\n"
            "| `/revenue/` | Monthly revenue split by Retail/Wholesale + top 10 customers |\n"
            "| `/inventory-value/` | Stock statement with cost/retail value, by-brand and by-category breakdowns |\n"
            "| `/best-sellers/` | Top items, brands, price brackets, and segment breakdown |\n"
            "| `/gst-summary/` | GST liability grouped by rate slab with CGST/SGST split |"
        ),
    },
    {
        "name": "health",
        "description": "Service health check.",
    },
]

# ── App ───────────────────────────────────────────────────────────────────────
_DESCRIPTION = """
## RetailPilot API

Backend for **RetailPilot** — a shop management system built for small Indian retail and wholesale businesses.

### Key design decisions

| Decision | Detail |
|---|---|
| **FIFO allocation** | Payments always applied to oldest invoice first — deterministic and auditable |
| **Payment immutability** | Amount locked after creation; only date/method/notes editable |
| **Walk-in Customer** | System-seeded record for cash sales; protected from deletion |
| **Soft delete on items** | `is_active=false`; invoice history is preserved |
| **Counter sale** | Single atomic endpoint: invoice + full payment + stock deduction |

### Authentication

Not implemented yet — all endpoints are open. Intended for single-user local deployment.

### Pagination

All list endpoints return:
```json
{
  "data": [...],
  "total_items": 42,
  "total_pages": 5,
  "current_page": 1,
  "page_size": 10,
  "has_next": true,
  "has_previous": false
}
```

### Error shapes

```json
// Validation (422)
{"detail": "field_name: error message"}

// Application errors (400 / 404 / 409)
{"detail": "Human-readable message"}

// Server errors (500 / 503)
{"detail": "An unexpected server error occurred. Please try again later."}
```
"""

app = FastAPI(
    title="RetailPilot API",
    description=_DESCRIPTION,
    version="1.0.0",
    openapi_tags=_OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "RetailPilot",
        "url": "https://github.com/Satyam-Rastogi/RetailPilot",
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request-timing middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        elapsed = round((time.perf_counter() - start) * 1000)
        logger.error(
            "Unhandled exception during %s %s (%dms): %s",
            request.method, request.url.path, elapsed, exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected server error occurred. Please try again later."},
        )
    elapsed = round((time.perf_counter() - start) * 1000)
    level = "warning" if response.status_code >= 400 else "info"
    getattr(logger, level)(
        "%s %s → %d (%dms)",
        request.method, request.url.path, response.status_code, elapsed,
    )
    return response


# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = []
    for err in errors:
        loc = " → ".join(str(p) for p in err["loc"] if p not in ("body", "query"))
        messages.append(f"{loc}: {err['msg']}" if loc else err["msg"])
    detail = "; ".join(messages) if messages else "Invalid request data."
    logger.warning(
        "Validation error on %s %s: %s",
        request.method, request.url.path, detail,
    )
    return JSONResponse(status_code=422, content={"detail": detail})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    raw = str(exc.orig) if hasattr(exc, "orig") else str(exc)
    logger.error(
        "DB integrity error on %s %s: %s",
        request.method, request.url.path, raw,
    )
    if "UNIQUE constraint" in raw:
        detail = "A record with this value already exists."
    elif "FOREIGN KEY constraint" in raw:
        detail = "Operation failed — a referenced record is missing or still in use."
    else:
        detail = "Database constraint violation. Check your input and try again."
    return JSONResponse(status_code=409, content={"detail": detail})


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error(
        "DB error on %s %s: %s",
        request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "A database error occurred. Please try again in a moment."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled error on %s %s: %s",
        request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again later."},
    )


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["health"])
def health_check():
    return {"status": "healthy", "message": "RetailPilot API is running"}
