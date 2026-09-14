from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.models.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)


class ValidationJob(Base):
    __tablename__ = "validation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    filename = Column(String, index=True)
    status = Column(String, default="PENDING") # PENDING, PROCESSING, PAUSED, TERMINATED, COMPLETED, FAILED
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    valid_count = Column(Integer, default=0)
    invalid_count = Column(Integer, default=0)
    disposable_count = Column(Integer, default=0)
    unknown_count = Column(Integer, default=0)
    column_mapping = Column(JSON, nullable=True)  # {"email": "Email", "instagram": "Instagram", ...}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="validation_jobs")
    results = relationship("ValidationResult", back_populates="job", cascade="all, delete-orphan")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("validation_jobs.id"))
    email = Column(String, index=True)
    status = Column(String) # DELIVERABLE, NOT_DELIVERABLE, CATCH_ALL, RISKY, UNKNOWN
    reason = Column(String)
    original_data = Column(JSON) # Store the original CSV row as JSON
    
    # Multi-email support: stores per-email statuses when cell has multiple emails
    email_statuses = Column(JSON, nullable=True)  # [{"email": "a@b.com", "status": "DELIVERABLE", "reason": "..."}]
    
    # Social media verification
    instagram_url = Column(String, nullable=True)
    instagram_status = Column(String, nullable=True)  # VALID, INVALID, UNKNOWN
    instagram_reason = Column(String, nullable=True)
    
    linkedin_url = Column(String, nullable=True)
    linkedin_status = Column(String, nullable=True)
    linkedin_reason = Column(String, nullable=True)
    
    whatsapp_number = Column(String, nullable=True)
    whatsapp_status = Column(String, nullable=True)
    whatsapp_reason = Column(String, nullable=True)
    
    job = relationship("ValidationJob", back_populates="results")


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subject = Column(String)
    body_html = Column(Text)
    body_text = Column(Text)
    variables = Column(JSON, default=list) # List of variables used
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
