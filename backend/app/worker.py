"""
Background CSV/XLSX validation worker using Celery + Redis.
Sequential SMTP processing (1 at a time) with rate-limiting + jitter delay.
Each result is committed to DB immediately after processing for live UI updates.

Supports:
- Email verification (multi-address per cell, any separator)
- Instagram URL verification
- LinkedIn URL verification
- WhatsApp number verification
- Pause / Resume / Terminate controls via DB status flag
"""
import os
import re
import csv
import io
import time
import random
import logging
from celery import Celery
from app.models.database import SessionLocal
from app.models.models import ValidationJob, ValidationResult
from app.core.smtp_socks5 import check_email  # SOCKS5-enabled email checker

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Celery app
# ---------------------------------------------------------------------------
celery_app = Celery(__name__)
celery_app.conf.broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
celery_app.conf.task_ignore_result = True
celery_app.conf.worker_concurrency = 1
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
SMTP_DELAY_MIN = float(os.environ.get("SMTP_DELAY_MIN", "1.2"))
SMTP_DELAY_MAX = float(os.environ.get("SMTP_DELAY_MAX", "2.8"))


# ---------------------------------------------------------------------------
# Email helpers
# ---------------------------------------------------------------------------

def split_emails(cell_value: str) -> list:
    """
    Split a cell that may contain multiple email addresses separated by any delimiter.
    Supports: comma, semicolon, pipe, slash, space, newline.
    """
    if not cell_value:
        return []
    # Use regex to find all valid-looking email addresses
    emails = re.findall(r"[a-zA-Z0-9_.+\-\/]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-.]+", cell_value)
    return [e.strip().rstrip(".,;") for e in emails if e.strip()]


def is_header_or_garbage(value: str, column_name: str) -> bool:
    """Return True if the cell value looks like a column header or garbage."""
    if not value:
        return True
    v = value.strip().lower()
    col = column_name.strip().lower()
    return (
        v == col
        or "report mail" in v
        or "mail id" in v
        or ("@" not in v)
    )


def get_overall_status(email_statuses: list) -> tuple:
    """
    Given a list of per-email status dicts, compute the overall status.
    If ANY email is DELIVERABLE, the row is considered to have valid emails.
    Returns (overall_status, summary_reason).
    """
    if not email_statuses:
        return ("UNKNOWN", "No emails found")

    deliverable = [e for e in email_statuses if e["status"] == "DELIVERABLE"]
    catch_all = [e for e in email_statuses if e["status"] == "CATCH_ALL"]
    not_deliverable = [e for e in email_statuses if e["status"] in ("NOT DELIVERABLE", "NOT_DELIVERABLE")]
    risky = [e for e in email_statuses if e["status"] == "RISKY"]
    unknown = [e for e in email_statuses if e["status"] == "UNKNOWN"]

    total = len(email_statuses)
    valid_n = len(deliverable)
    invalid_n = len(not_deliverable)

    summary_parts = []
    for item in email_statuses:
        summary_parts.append(f"{item['email']}: {item['reason']}")
    summary = " | ".join(summary_parts)

    # Overall status logic: at least one deliverable = row is valid
    if deliverable:
        return ("DELIVERABLE", f"valid({valid_n}), invalid({invalid_n}), total({total}) | " + summary)
    elif catch_all:
        return ("CATCH_ALL", f"catch_all({len(catch_all)}), invalid({invalid_n}) | " + summary)
    elif risky:
        return ("RISKY", summary)
    elif unknown:
        return ("UNKNOWN", summary)
    else:
        return ("NOT DELIVERABLE", summary)


# ---------------------------------------------------------------------------
# Main Celery task
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, max_retries=0)
def process_csv_validation(
    self,
    job_id: int,
    file_content: str,
    email_column: str,
    instagram_column: str = "",
    linkedin_column: str = "",
    whatsapp_column: str = "",
):
    """
    Celery task: validate emails (and optionally social media) from uploaded file.
    - Sequential SMTP processing with rate-limiting
    - Commits each result immediately for live progressive UI
    - Respects PAUSED / TERMINATED status flags set by API
    - CALLS check_email() DIRECTLY (no nested Celery tasks)
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

        # Parse CSV rows
        f = io.StringIO(file_content)
        reader = csv.DictReader(f)
        rows_to_process = []

        for row in reader:
            email_cell = row.get(email_column, "").strip() if email_column else ""
            # Skip blank rows and header-like garbage
            if email_column and (not email_cell or is_header_or_garbage(email_cell, email_column)):
                continue
            # If no email column configured, still process row for social media
            rows_to_process.append(row)

        # Update total
        job.total_records = len(rows_to_process)
        db.commit()

        # Determine if we're checking social media
        check_instagram = bool(instagram_column)
        check_linkedin_flag = bool(linkedin_column)
        check_whatsapp = bool(whatsapp_column)

        valid_count = 0
        invalid_count = 0
        catchall_count = 0
        risky_count = 0
        unknown_count = 0

        logger.info(
            f"[WORKER] Job {job_id}: Starting validation of {len(rows_to_process)} rows. "
            f"Email={email_column}, IG={instagram_column}, LI={linkedin_column}, WA={whatsapp_column}"
        )

        for i, row in enumerate(rows_to_process):

            # ── Check for PAUSE / TERMINATE ─────────────────────────────────
            db.refresh(job)
            if job.status == "TERMINATED":
                logger.info(f"[WORKER] Job {job_id}: Terminated by user at row {i+1}.")
                return
            while job.status == "PAUSED":
                logger.info(f"[WORKER] Job {job_id}: Paused at row {i+1}. Waiting...")
                time.sleep(5)
                db.refresh(job)
                if job.status == "TERMINATED":
                    logger.info(f"[WORKER] Job {job_id}: Terminated while paused.")
                    return
            # Resume detected — set back to PROCESSING
            if job.status not in ("PROCESSING", "PAUSED", "TERMINATED"):
                job.status = "PROCESSING"
                db.commit()

            # Rate-limit delay
            if i > 0:
                delay = random.uniform(SMTP_DELAY_MIN, SMTP_DELAY_MAX)
                time.sleep(delay)

            # ── Email verification ───────────────────────────────────────────
            email_primary = ""
            overall_status = "UNKNOWN"
            overall_reason = "No email column configured"
            email_statuses_list = []

            if email_column:
                email_cell = row.get(email_column, "").strip()
                found_emails = split_emails(email_cell)

                if not found_emails:
                    overall_status = "UNKNOWN"
                    overall_reason = "No valid email address found in cell"
                    email_primary = email_cell
                else:
                    email_primary = found_emails[0]
                    for em in found_emails:
                        try:
                            # DIRECT CALL - no nested Celery tasks!
                            st, reason = check_email(em)
                        except Exception as exc:
                            st, reason = "UNKNOWN", f"Validation error: {exc}"
                        email_statuses_list.append({"email": em, "status": st, "reason": reason})

                    overall_status, overall_reason = get_overall_status(email_statuses_list)

            # Update counts
            if overall_status == "DELIVERABLE":
                valid_count += 1
            elif overall_status in ("NOT DELIVERABLE", "NOT_DELIVERABLE"):
                invalid_count += 1
            elif overall_status == "CATCH_ALL":
                catchall_count += 1
            elif overall_status == "RISKY":
                risky_count += 1
            else:
                unknown_count += 1

            # ── Social media verification ────────────────────────────────────
            ig_url, ig_status, ig_reason = "", None, None
            li_url, li_status, li_reason = "", None, None
            wa_num, wa_status, wa_reason = "", None, None

            if check_instagram:
                from app.core.social_checker import check_instagram as _chk_ig
                ig_raw = row.get(instagram_column, "").strip()
                ig_url, ig_status, ig_reason = _chk_ig(ig_raw)

            if check_linkedin_flag:
                from app.core.social_checker import check_linkedin as _chk_li
                li_raw = row.get(linkedin_column, "").strip()
                li_url, li_status, li_reason = _chk_li(li_raw)

            if check_whatsapp:
                from app.core.social_checker import check_whatsapp as _chk_wa
                wa_raw = row.get(whatsapp_column, "").strip()
                wa_num, wa_status, wa_reason = _chk_wa(wa_raw)

            # ── Persist result ───────────────────────────────────────────────
            result = ValidationResult(
                job_id=job.id,
                email=email_primary,
                status=overall_status,
                reason=overall_reason,
                original_data=row,
                email_statuses=email_statuses_list if len(email_statuses_list) > 1 else None,
                instagram_url=ig_url or None,
                instagram_status=ig_status,
                instagram_reason=ig_reason,
                linkedin_url=li_url or None,
                linkedin_status=li_status,
                linkedin_reason=li_reason,
                whatsapp_number=wa_num or None,
                whatsapp_status=wa_status,
                whatsapp_reason=wa_reason,
            )
            db.add(result)

            job.processed_records = i + 1
            job.valid_count = valid_count
            job.invalid_count = invalid_count
            job.disposable_count = catchall_count
            job.unknown_count = risky_count + unknown_count
            db.commit()

            logger.info(f"[WORKER] Job {job_id}: [{i+1}/{len(rows_to_process)}] → {overall_status}")

        # ── Finalize ─────────────────────────────────────────────────────────
        job.status = "COMPLETED"
        job.processed_records = len(rows_to_process)
        job.valid_count = valid_count
        job.invalid_count = invalid_count
        job.disposable_count = catchall_count
        job.unknown_count = risky_count + unknown_count
        db.commit()

        logger.info(
            f"[WORKER] Job {job_id} COMPLETED. "
            f"valid={valid_count} invalid={invalid_count} "
            f"catch_all={catchall_count} risky+unknown={risky_count + unknown_count}"
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
