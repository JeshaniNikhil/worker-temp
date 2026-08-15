import os
from celery import Celery
import csv
import io
from app.models.database import SessionLocal
from app.models.models import ValidationJob, ValidationResult
from app.core.email_checker import check_email
import time

from concurrent.futures import ThreadPoolExecutor

celery_app = Celery(__name__)
celery_app.conf.broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
celery_app.conf.result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

@celery_app.task(bind=True)
def process_csv_validation(self, job_id: int, file_content: str, email_column: str):
    db = SessionLocal()
    try:
        job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
        if not job:
            return
            
        job.status = "PROCESSING"
        db.commit()
        
        # Parse CSV
        f = io.StringIO(file_content)
        reader = csv.DictReader(f)
        
        rows_to_process = []
        for row in reader:
            email = row.get(email_column, "")
            email_clean = email.strip() if email else ""
            # Skip duplicate header rows, blank values, or rows matching common report headers
            if (not email_clean or
                email_clean.lower() == email_column.lower() or
                "report mail" in email_clean.lower() or
                "mail id" in email_clean.lower() or
                "@" not in email_clean):
                continue
            rows_to_process.append((email_clean, row))
        
        # Update total_records to only count rows with real emails (exclude blanks)
        job.total_records = len(rows_to_process)
        db.commit()
        
        valid_count = 0
        invalid_count = 0
        disposable_count = 0
        unknown_count = 0
        processed = 0
        
        # Use concurrent ThreadPoolExecutor but limit to 10 to avoid IP blocks from rate-limiting
        max_workers = min(10, len(rows_to_process) or 1)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(check_email, email)
                for email, row in rows_to_process
            ]
            
            for i, future in enumerate(futures):
                email, row = rows_to_process[i]
                try:
                    status, reason = future.result()
                except Exception as exc:
                    status, reason = "UNKNOWN", f"Check execution failed: {exc}"
                
                # Update counts
                if status == "VALID":
                    valid_count += 1
                elif status == "NOT VALID":
                    invalid_count += 1
                elif status == "DISPOSABLE":
                    disposable_count += 1
                else:
                    unknown_count += 1
                    
                processed += 1
                
                # Save result
                result = ValidationResult(
                    job_id=job.id,
                    email=email,
                    status=status,
                    reason=reason,
                    original_data=row
                )
                db.add(result)
                
                # Periodically commit and update job status
                if processed % 5 == 0:
                    job.processed_records = processed
                    job.valid_count = valid_count
                    job.invalid_count = invalid_count
                    job.disposable_count = disposable_count
                    job.unknown_count = unknown_count
                    db.commit()
                    
        # Final update
        job.status = "COMPLETED"
        job.processed_records = processed
        job.valid_count = valid_count
        job.invalid_count = invalid_count
        job.disposable_count = disposable_count
        job.unknown_count = unknown_count
        db.commit()
        
    except Exception as e:
        if job:
            job.status = "FAILED"
            db.commit()
        raise e
    finally:
        db.close()
