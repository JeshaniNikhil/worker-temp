from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io
import codecs
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
    from app.core.email_checker import check_email
    import time
    
    start_time = time.time()
    status, reason = check_email(req.email)
    end_time = time.time()
    
    return {
        "email": req.email,
        "status": status,
        "reason": reason,
        "execution_time_ms": round((end_time - start_time) * 1000, 2)
    }

@router.post("/deep")
def validate_email_deep(req: SingleValidationRequest):
    """Run all 12 checks on an email. No Port 25 required."""
    from app.core.email_checker import check_email_detailed
    import time

    start_time = time.time()
    result = check_email_detailed(req.email)
    end_time = time.time()

    result["execution_time_ms"] = round((end_time - start_time) * 1000, 2)
    return result

@router.post("/upload", response_model=ValidationJobResponse)
async def upload_csv(
    req: UploadCSVRequest,
    db: Session = Depends(get_db)
):
    if not req.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    content_str = req.content
    email_column = req.email_column
    
    # Count rows and validate column
    f = io.StringIO(content_str)
    reader = csv.DictReader(f)
    
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty or invalid.")
    
    if email_column not in reader.fieldnames:
        raise HTTPException(status_code=400, detail=f"Column '{email_column}' not found in CSV headers: {reader.fieldnames}")
        
    total_records = sum(1 for _ in reader)
    
    # Create job
    job = ValidationJob(
        filename=req.filename,
        total_records=total_records,
        status="PENDING"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Trigger Celery task
    process_csv_validation.delay(job.id, content_str, email_column)
    
    return job

@router.get("/jobs", response_model=List[ValidationJobResponse])
def get_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    jobs = db.query(ValidationJob).order_by(ValidationJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs

@router.get("/jobs/{job_id}", response_model=ValidationJobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/jobs/{job_id}/results", response_model=List[ValidationResultResponse])
def get_job_results(job_id: int, skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    results = db.query(ValidationResult).filter(ValidationResult.job_id == job_id).offset(skip).limit(limit).all()
    return results

@router.get("/jobs/{job_id}/columns")
def get_job_columns(job_id: int, db: Session = Depends(get_db)):
    """Return CSV column names from the first result of a job."""
    first_result = db.query(ValidationResult).filter(ValidationResult.job_id == job_id).first()
    if not first_result or not first_result.original_data:
        raise HTTPException(status_code=404, detail="No results found for this job")
    return {"columns": list(first_result.original_data.keys())}

@router.get("/jobs/{job_id}/download")
def download_results(job_id: int, template_id: Optional[int] = None, db: Session = Depends(get_db)):
    job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    results = db.query(ValidationResult).filter(ValidationResult.job_id == job_id).all()
    
    if not results:
        raise HTTPException(status_code=400, detail="No results found for this job")
        
    # Get original fieldnames
    first_result = results[0]
    fieldnames = list(first_result.original_data.keys())
    
    # Add new columns
    fieldnames.extend(["Email Status", "Email Check Reason"])
    
    # Retrieve template if provided
    template = None
    if template_id:
        template = db.query(Template).filter(Template.id == template_id).first()
        if template:
            fieldnames.append("Personalized Content")
            
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for result in results:
        row = result.original_data.copy()
        row["Email Status"] = result.status
        row["Email Check Reason"] = result.reason
        
        if template:
            # Simple variable replacement
            rendered_text = template.body_text
            for k, v in result.original_data.items():
                rendered_text = rendered_text.replace(f"{{{{{k}}}}}", str(v or ""))
            row["Personalized Content"] = rendered_text
            
        writer.writerow(row)
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=processed_{job.filename}"}
    )
