"""Alembic environment — wired to RetailPilot models and settings."""
import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Make sure `app` is importable ────────────────────────────────────────────
# alembic is always run from /backend so `app` is on the path via
# prepend_sys_path = . in alembic.ini. This is a safety net for edge cases.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ── App imports ───────────────────────────────────────────────────────────────
from app.core.config import settings
from app.db.session import Base  # noqa: F401

# Import every model so they register with Base.metadata before autogenerate runs
from app.models import (  # noqa: F401
    company_profile,
    customer,
    supplier,
    item,
    item_variant,
    stock_audit,
    invoice,
    invoice_sequence,
    return_receipt,
    payment,
)

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

# Pull the real DB URL from app settings (respects .env / environment variables)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Tell autogenerate which metadata to compare against
target_metadata = Base.metadata


# ── Migration runners ─────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live DB connection (useful for review/CI)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_server_default=True,
        render_as_batch=True,  # needed for SQLite ALTER TABLE emulation
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_server_default=True,
            # render_as_batch is required for SQLite: it can't ALTER columns in-place,
            # so Alembic recreates the table. Safe for Postgres/MySQL too (no-op there).
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
