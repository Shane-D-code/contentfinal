"""Guardrail: never pass `event=` kwarg to structlog logger methods.

Structlog uses first positional arg as event; passing event= triggers runtime errors.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LOGGER_CALL = re.compile(r"\b(?:logger|_log)\.(?:info|warning|error|debug|exception)\s*\(")
EVENT_KW = re.compile(r"\bevent\s*=")


def test_no_structlog_event_keyword_in_logger_calls():
    violations = []
    for path in ROOT.rglob("*.py"):
        if "/.venv/" in str(path):
            continue
        if path.name.startswith("test_") and path.name != "test_structlog_event_kwarg_guard.py":
            # include tests too; no special skip needed
            pass
        text = path.read_text(encoding="utf-8", errors="ignore")
        lines = text.splitlines()
        for i, line in enumerate(lines, start=1):
            if LOGGER_CALL.search(line) and EVENT_KW.search(line):
                violations.append(f"{path}:{i}:{line.strip()}")
    assert not violations, "Found invalid structlog event= usage:\n" + "\n".join(violations)
