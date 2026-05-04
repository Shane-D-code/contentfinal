"""
cleanup.py — Delete old uploads and outputs.

Usage:
    python cleanup.py                    # use defaults from .env
    python cleanup.py --dry-run          # preview without deleting
    python cleanup.py --upload-days 3    # override retention
    python cleanup.py --output-days 7

Schedule with cron:
    0 3 * * * /path/to/.venv/bin/python /path/to/cleanup.py >> /var/log/ce_cleanup.log 2>&1
"""

import argparse
import time
from pathlib import Path
from datetime import datetime

from config import settings
from api.logger import get_logger

logger = get_logger("cleanup")


def _age_days(path: Path) -> float:
    """Return file age in days."""
    return (time.time() - path.stat().st_mtime) / 86400


def clean_directory(
    directory: Path,
    max_age_days: int,
    dry_run: bool = False,
    label: str = "",
) -> dict:
    """
    Delete files older than max_age_days in directory.
    Returns summary dict.
    """
    if not directory.exists():
        return {"deleted": 0, "freed_bytes": 0, "errors": 0}

    deleted = 0
    freed = 0
    errors = 0

    for path in directory.rglob("*"):
        if not path.is_file():
            continue
        try:
            age = _age_days(path)
            if age > max_age_days:
                size = path.stat().st_size
                if dry_run:
                    logger.info(f"[DRY RUN] Would delete {label}/{path.name} (age={age:.1f}d, {size//1024}KB)")
                else:
                    path.unlink()
                    logger.info(f"Deleted {label}/{path.name} (age={age:.1f}d, {size//1024}KB)")
                deleted += 1
                freed += size
        except Exception as e:
            logger.error(f"Error processing {path}: {e}")
            errors += 1

    return {"deleted": deleted, "freed_bytes": freed, "errors": errors}


def run_cleanup(
    upload_days: int,
    output_days: int,
    dry_run: bool = False,
) -> None:
    start = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Cleanup started at {start}")

    upload_result = clean_directory(
        settings.upload_dir, upload_days, dry_run, label="uploads"
    )
    output_result = clean_directory(
        settings.output_dir, output_days, dry_run, label="output"
    )

    total_freed = (upload_result["freed_bytes"] + output_result["freed_bytes"]) / (1024 * 1024)
    logger.info(
        f"Cleanup complete — "
        f"uploads: {upload_result['deleted']} deleted, "
        f"output: {output_result['deleted']} deleted, "
        f"freed: {total_freed:.1f}MB"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean up old uploads and outputs")
    parser.add_argument("--upload-days", type=int, default=settings.upload_retention_days)
    parser.add_argument("--output-days", type=int, default=settings.output_retention_days)
    parser.add_argument("--dry-run", action="store_true", help="Preview without deleting")
    args = parser.parse_args()

    run_cleanup(
        upload_days=args.upload_days,
        output_days=args.output_days,
        dry_run=args.dry_run,
    )
