from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io
from app.models.database import get_db
from app.models.models import ValidationJob, ValidationResult, Template
from app.models.schemas import ValidationJobResponse, ValidationResultResponse
from app.worker import process_csv_validation

router = APIRouter()

from pydantic import BaseModel

class UploadCSVRequest(BaseModel):
    filename: str
    content: str
    email_column: str

class SingleValidationRequest(BaseModel):
    email: str


@router.post("/single")
def validate_single_email(req: SingleValidationRequest):
    """Submit basic email check to Volknode. Returns task_id immediately."""
    from app.worker import verify_single_email_basic_task
    task = verify_single_email_basic_task.apply_async(args=[req.email], queue="single_checks")
    return {"task_id": task.id, "status": "pending", "email": req.email}


@router.post("/deep")
def validate_email_deep(req: SingleValidationRequest):
    """Submit deep 12-point email check to Volknode. Returns task_id immediately."""
    from app.worker import verify_single_email_task
    task = verify_single_email_task.apply_async(args=[req.email], queue="single_checks")
    return {"task_id": task.id, "status": "pending", "email": req.email}


@router.get("/task/{task_id}")
def get_task_status(task_id: str):
    """Poll for the result of a submitted verification task."""
    from app.worker import celery_app
    result = celery_app.AsyncResult(task_id)
    state = result.state
    if state == "SUCCESS":
        return {"status": "done", "result": result.get()}
    elif state == "FAILURE":
        return {"status": "error", "error": str(result.result)}
    else:
        return {"status": "pending"}


@router.post("/upload", response_model=ValidationJobResponse)
async def upload_csv(
    req: UploadCSVRequest,
    db: Session = Depends(get_db)
):
    """
    Upload a CSV for bulk email validation.
    Creates a job record immediately and dispatches it to Celery + Redis.
    Returns the job object immediately so the UI can start polling for live results.
    """
    try:
        if not req.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")

        content_str = req.content
        email_column = req.email_column

        # Validate CSV structure and column
        f = io.StringIO(content_str)
        reader = csv.DictReader(f)

        if reader.fieldnames is None:
            raise HTTPException(status_code=400, detail="The uploaded CSV file is empty or invalid.")

        if email_column not in reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Column '{email_column}' not found in CSV. "
                    f"Available columns: {list(reader.fieldnames)}"
                )
            )

        total_records = sum(1 for _ in reader)

        # Create job record in DB
        job = ValidationJob(
            filename=req.filename,
            total_records=total_records,
            status="PENDING"
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Dispatch to Celery worker via Redis broker (fire-and-forget)
        # ignore_result=True prevents the API from trying to connect to a result backend
        process_csv_validation.apply_async(args=[job.id, content_str, email_column], ignore_result=True)

        return job
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = f"Internal Error: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/jobs", response_model=List[ValidationJobResponse])
def get_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    jobs = (
        db.query(ValidationJob)
        .order_by(ValidationJob.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return jobs


@router.get("/jobs/{job_id}", response_model=ValidationJobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/results", response_model=List[ValidationResultResponse])
def get_job_results(
    job_id: int,
    skip: int = 0,
    limit: int = 2000,
    db: Session = Depends(get_db)
):
    """
    Returns validation results for a job ordered by ID ascending.
    Works during processing — returns partial results for live/progressive UI updates.
    Use skip + limit for pagination on very large jobs.
    """
    results = (
        db.query(ValidationResult)
        .filter(ValidationResult.job_id == job_id)
        .order_by(ValidationResult.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return results


@router.get("/jobs/{job_id}/results/count")
def get_job_results_count(job_id: int, db: Session = Depends(get_db)):
    """Return the current DB count of results for a job (used for live progress polling)."""
    count = db.query(ValidationResult).filter(ValidationResult.job_id == job_id).count()
    return {"count": count}


@router.get("/jobs/{job_id}/columns")
def get_job_columns(job_id: int, db: Session = Depends(get_db)):
    """Return CSV column names from the first result of a job."""
    first_result = (
        db.query(ValidationResult)
        .filter(ValidationResult.job_id == job_id)
        .first()
    )
    if not first_result or not first_result.original_data:
        raise HTTPException(status_code=404, detail="No results found for this job")
    return {"columns": list(first_result.original_data.keys())}


@router.get("/jobs/{job_id}/download")
def download_results(
    job_id: int,
    template_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    results = (
        db.query(ValidationResult)
        .filter(ValidationResult.job_id == job_id)
        .order_by(ValidationResult.id.asc())
        .all()
    )

    if not results:
        raise HTTPException(status_code=400, detail="No results found for this job")

    # Build fieldnames from first row's original_data
    first_result = results[0]
    fieldnames = list(first_result.original_data.keys())
    fieldnames.extend(["Email Status", "Email Check Reason"])

    # Retrieve template if provided
    template = None
    if template_id:
        template = db.query(Template).filter(Template.id == template_id).first()
        if template:
            fieldnames.append("Personalized Content")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()

    for result in results:
        row = result.original_data.copy()
        row["Email Status"] = result.status
        row["Email Check Reason"] = result.reason

        if template:
            rendered_text = template.body_text
            for k, v in result.original_data.items():
                rendered_text = rendered_text.replace(f"{{{{{k}}}}}", str(v or ""))
            row["Personalized Content"] = rendered_text

        writer.writerow(row)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=validated_{job.filename}"}
    )

@router.post("/social/{platform}")
async def validate_social(platform: str, req: dict):
    from app.core.social_checker import check_phone, check_whatsapp, check_facebook, check_instagram, check_linkedin, check_website
    
    # Try to extract the target string from common payload keys
    target = req.get("target") or req.get("phone") or req.get("number") or req.get("url") or req.get("username") or req.get("email") or req.get("raw") or ""
    
    if not target and len(req.values()) > 0:
        target = list(req.values())[0]

    target = str(target)

    if platform == "phone":
        return check_phone(target)
    elif platform == "whatsapp":
        return check_whatsapp(target)
    elif platform == "facebook":
        return check_facebook(target)
    elif platform == "instagram":
        return check_instagram(target)
    elif platform == "linkedin":
        return check_linkedin(target)
    elif platform == "website":
        return check_website(target)
    else:
        raise HTTPException(status_code=404, detail="Platform not found")
