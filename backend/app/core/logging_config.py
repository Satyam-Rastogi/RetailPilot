"""
Structured logging setup for RetailPilot.
Configures a single root logger with formatted console output.
Import `get_logger(__name__)` in any module to get a named logger.
"""
import logging
import sys


_FMT = "%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"
_configured = False


def configure_logging(level: int = logging.INFO) -> None:
    """Call once at application startup."""
    global _configured
    if _configured:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FMT, datefmt=_DATE_FMT))

    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(handler)

    # Quiet chatty third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger (call configure_logging first)."""
    return logging.getLogger(name)
