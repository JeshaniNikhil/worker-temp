from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class TemplateBase(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: str
    variables: List[str] = []

class TemplateCreate(TemplateBase):
    pass

class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ValidationJobResponse(BaseModel):
    id: int
    filename: str
    status: str
    total_records: int
    processed_records: int
    valid_count: int
    invalid_count: int
    disposable_count: int
    unknown_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ValidationResultResponse(BaseModel):
    id: int
    job_id: int
    email: str
    status: str
    reason: str
    original_data: Dict[str, Any]

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
