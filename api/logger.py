"""
Structured JSON logger for the entire backend.

Usage:
    from api.logger import get_logger
    logger = get_logger(__name__)
    logger.info("asset_processed", asset=name, faces=3, quality=0.82)
    logger.warning("low_confidence", asset=name, score=0.3)
    logger.error("model_failed", error=str(e))

Output (JSON in production, coloured console in dev):
    {"event": "asset_processed", "asset": "IMG_001.jpg", "faces": 3, ...}
"""

import logging
import os
import sys
import uuid
from contextvars import ContextVar

import structlog

# Per-request ID stored in a context variable — set by middleware
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def sanitize_log_kwargs(kwargs: dict) -> dict:
    """
    Remove structlog-reserved keys from metadata kwargs.
    The positional message is already the `event` field in structlog.
    """
    if not kwargs:
        return kwargs
    if "event" in kwargs:
        kwargs = dict(kwargs)
        kwargs.pop("event", None)
    return kwargs


class SafeBoundLogger(structlog.stdlib.BoundLogger):
    """
    Defensive BoundLogger that strips reserved `event` kwarg from:
      - bind/new context
      - regular log method kwargs
    This prevents runtime collisions like:
      meth() got multiple values for argument 'event'
    """

    def bind(self, **new_values):
        return super().bind(**sanitize_log_kwargs(new_values))

    def new(self, **new_values):
        return super().new(**sanitize_log_kwargs(new_values))

    def debug(self, event=None, *args, **kw):
        return super().debug(event, *args, **sanitize_log_kwargs(kw))

    def info(self, event=None, *args, **kw):
        return super().info(event, *args, **sanitize_log_kwargs(kw))

    def warning(self, event=None, *args, **kw):
        return super().warning(event, *args, **sanitize_log_kwargs(kw))

    def error(self, event=None, *args, **kw):
        return super().error(event, *args, **sanitize_log_kwargs(kw))

    def exception(self, event=None, *args, **kw):
        return super().exception(event, *args, **sanitize_log_kwargs(kw))


def get_request_id() -> str:
    return request_id_var.get() or str(uuid.uuid4())[:8]


def _add_request_id(logger, method, event_dict):
    """structlog processor: inject request_id into every log record."""
    rid = request_id_var.get()
    if rid:
        event_dict["request_id"] = rid
    return event_dict


def setup_logging(log_level: str = "INFO", json_output: bool = True) -> None:
    """
    Configure structlog + stdlib logging.
    Call once at application startup.

    Args:
        log_level:   'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
        json_output: True = JSON (production), False = coloured console (dev)
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        _add_request_id,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if json_output:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=SafeBoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Silence noisy third-party loggers
    for noisy in ["uvicorn.access", "httpx", "httpcore", "urllib3"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger for the given module name."""
    return structlog.get_logger(name)
