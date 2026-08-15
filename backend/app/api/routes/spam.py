from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.core.spam_checker import analyze_content

router = APIRouter()


class SpamCheckRequest(BaseModel):
    content: str
    subject: Optional[str] = None


@router.post("/check")
def check_spam(request: SpamCheckRequest):
    return analyze_content(request.content, subject=request.subject)
