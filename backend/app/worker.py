"""
Background CSV validation worker using Celery + Redis.
Sequential SMTP processing (1 at a time) with rate-limiting + jitter delay
to protect Contabo server from IP bans.
Each result is committed to DB immediately after processing for live UI updates.
"""
import os
import csv
import io
import time
import random
import logging
from celery import Celery
from app.models.database import SessionLocal
from app.models.models import ValidationJob, ValidationResult
from app.core.email_checker import check_email

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Celery app (uses Redis broker as before)
# ---------------------------------------------------------------------------
celery_app = Celery(__name__)
celery_app.conf.broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
celery_app.conf.result_backend = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

# Allow results to be stored in Redis so the API can await single verifications
celery_app.conf.task_ignore_result = False

# Ensure only 1 task runs at a time per worker to prevent SMTP overload
celery_app.conf.worker_concurrency = 1
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1

# ---------------------------------------------------------------------------
# Rate limiting config (tune via env vars for Contabo safety)
# Sequential: 1 email at a time, with random delay between each SMTP check
# ---------------------------------------------------------------------------
SMTP_DELAY_MIN = float(os.environ.get("SMTP_DELAY_MIN", "1.2"))   # seconds min delay
SMTP_DELAY_MAX = float(os.environ.get("SMTP_DELAY_MAX", "2.8"))   # seconds max delay


@celery_app.task(bind=True, max_retries=0)
def process_csv_validation(self, job_id: int, file_content: str, email_column: str):
    """
    Celery task: validate emails from a CSV file sequentially with rate-limiting.
    - NO ThreadPoolExecutor (sequential = safe for Contabo/anti-abuse)
    - Random delay between each SMTP check (jitter prevents pattern-based bans)
    - Commits result to DB after EVERY email (live progressive UI updates)
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
        if not job:
            logger.error(f"[WORKER] Job {job_id} not found in DB.")
            return

        job.status = "PROCESSING"
        db.commit()

        # Parse CSV and filter valid email rows
        f = io.StringIO(file_content)
        reader = csv.DictReader(f)

        rows_to_process = []
        for row in reader:
            email = row.get(email_column, "")
            email_clean = email.strip() if email else ""
            # Skip blank values, duplicate headers, report-style header rows
            if (
                not email_clean
                or email_clean.lower() == email_column.lower()
                or "report mail" in email_clean.lower()
                or "mail id" in email_clean.lower()
                or "@" not in email_clean
            ):
                continue
            rows_to_process.append((email_clean, row))

        # Update total_records to count only real email rows
        job.total_records = len(rows_to_process)
        db.commit()

        valid_count = 0
        invalid_count = 0
        catchall_count = 0
        risky_count = 0
        unknown_count = 0

        logger.info(
            f"[WORKER] Job {job_id}: Starting SEQUENTIAL validation of "
            f"{len(rows_to_process)} emails. "
            f"Rate limit: {SMTP_DELAY_MIN:.1f}–{SMTP_DELAY_MAX:.1f}s delay between checks."
        )

        # ── SEQUENTIAL loop (NO ThreadPoolExecutor) ──────────────────────────
        for i, (email, row) in enumerate(rows_to_process):

            # Rate-limit delay BEFORE each check (skip very first)
            if i > 0:
                delay = random.uniform(SMTP_DELAY_MIN, SMTP_DELAY_MAX)
                logger.debug(
                    f"[WORKER] Job {job_id}: Waiting {delay:.2f}s before "
                    f"email {i+1}/{len(rows_to_process)} (rate limit)"
                )
                time.sleep(delay)

            logger.info(
                f"[WORKER] Job {job_id}: [{i+1}/{len(rows_to_process)}] "
                f"Checking: {email}"
            )

            # --- Validate single email ---
            try:
                status, reason = check_email(email)
            except Exception as exc:
                logger.error(
                    f"[WORKER] Job {job_id}: Exception validating {email}: {exc}",
                    exc_info=True
                )
                status, reason = "UNKNOWN", f"Validation error: {exc}"

            # --- Update counts ---
            if status == "DELIVERABLE":
                valid_count += 1
            elif status in ("NOT DELIVERABLE", "NOT_DELIVERABLE"):
                invalid_count += 1
            elif status == "CATCH_ALL":
                catchall_count += 1
            elif status == "RISKY":
                risky_count += 1
            else:
                unknown_count += 1

            # --- Commit result to DB immediately (enables live UI updates) ---
            result = ValidationResult(
                job_id=job.id,
                email=email,
                status=status,
                reason=reason,
                original_data=row,
            )
            db.add(result)

            # Update job progress after EVERY email
            job.processed_records = i + 1
            job.valid_count = valid_count
            job.invalid_count = invalid_count
            # Reuse disposable_count for catch-all count
            job.disposable_count = catchall_count
            job.unknown_count = risky_count + unknown_count
            db.commit()

            logger.info(
                f"[WORKER] Job {job_id}: [{i+1}/{len(rows_to_process)}] "
                f"{email} → {status}"
            )

        # ── Final job status ─────────────────────────────────────────────────
        job.status = "COMPLETED"
        job.processed_records = len(rows_to_process)
        job.valid_count = valid_count
        job.invalid_count = invalid_count
        job.disposable_count = catchall_count
        job.unknown_count = risky_count + unknown_count
        db.commit()

        logger.info(
            f"[WORKER] Job {job_id} COMPLETED. "
            f"deliverable={valid_count} invalid={invalid_count} "
            f"catch_all={catchall_count} risky={risky_count} unknown={unknown_count}"
        )

    except Exception as e:
        logger.error(f"[WORKER] Job {job_id} FAILED: {e}", exc_info=True)
        if job:
            try:
                job.status = "FAILED"
                db.commit()
            except Exception:
                pass
        raise
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=0)
def verify_single_email_task(self, email: str):
    """RPC Task to run deep email validation on Volknode and return the result."""
    from app.core.email_checker import check_email_detailed
    return check_email_detailed(email)

@celery_app.task(bind=True, max_retries=0)
def verify_single_email_basic_task(self, email: str):
    """RPC Task to run basic email validation on Volknode and return the result."""
    from app.core.email_checker import check_email
    return check_email(email)
