"""Deep structlog audit: prevent reserved event-key collisions."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

LOG_CALL = re.compile(r"\b(?:logger|_log)\.(?:info|warning|error|debug|exception)\s*\(")
BIND_CALL = re.compile(r"\b(?:logger|_log)\.(?:bind|new)\s*\(")
EVENT_KW = re.compile(r"\bevent\s*=")
DICT_EVENT = re.compile(r"\{[^\n}]*['\"]event['\"]\s*:")


def _iter_py_files():
    for p in ROOT.rglob("*.py"):
        if "/.venv/" in str(p):
            continue
        yield p


def test_no_event_kwarg_in_logger_or_bind_calls():
    violations = []
    for path in _iter_py_files():
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for i, line in enumerate(lines, start=1):
            if (LOG_CALL.search(line) or BIND_CALL.search(line)) and EVENT_KW.search(line):
                violations.append(f"{path}:{i}:{line.strip()}")
    assert not violations, "Reserved event kwarg used in logger/bind/new calls:\n" + "\n".join(violations)


def test_no_inline_payload_dict_with_event_key_for_logging():
    """Conservative guard for obvious inline payloads with reserved event key."""
    violations = []
    for path in _iter_py_files():
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for i, line in enumerate(lines, start=1):
            if DICT_EVENT.search(line) and "logger" in line:
                violations.append(f"{path}:{i}:{line.strip()}")
    assert not violations, "Inline logging payload contains reserved event key:\n" + "\n".join(violations)
