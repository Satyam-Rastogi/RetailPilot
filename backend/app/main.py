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

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="RetailPilot API",
    description="Shop management system for small retail businesses",
    version="1.0.0",
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
