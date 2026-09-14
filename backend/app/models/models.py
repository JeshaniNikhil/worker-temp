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
    filename = Column(String, index=True)
    status = Column(String, default="PENDING") # PENDING, PROCESSING, COMPLETED, FAILED
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    valid_count = Column(Integer, default=0)
    invalid_count = Column(Integer, default=0)
    disposable_count = Column(Integer, default=0)
    unknown_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    results = relationship("ValidationResult", back_populates="job", cascade="all, delete-orphan")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("validation_jobs.id"))
    email = Column(String, index=True)
    status = Column(String) # VALID, NOT VALID, DISPOSABLE, UNKNOWN
    reason = Column(String)
    original_data = Column(JSON) # Store the original CSV row as JSON
    
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
