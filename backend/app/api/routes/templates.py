from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.models.database import get_db
from app.models.models import Template
from app.models.schemas import TemplateCreate, TemplateResponse

router = APIRouter()

@router.post("/", response_model=TemplateResponse)
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    db_template = Template(
        name=template.name,
        subject=template.subject,
        body_html=template.body_html,
        body_text=template.body_text,
        variables=template.variables
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/", response_model=List[TemplateResponse])
def get_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    templates = db.query(Template).offset(skip).limit(limit).all()
    return templates

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, template: TemplateCreate, db: Session = Depends(get_db)):
    db_template = db.query(Template).filter(Template.id == template_id).first()
    if db_template is None:
        raise HTTPException(status_code=404, detail="Template not found")
        
    db_template.name = template.name
    db_template.subject = template.subject
    db_template.body_html = template.body_html
    db_template.body_text = template.body_text
    db_template.variables = template.variables
    
    db.commit()
    db.refresh(db_template)
    return db_template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    db_template = db.query(Template).filter(Template.id == template_id).first()
    if db_template is None:
        raise HTTPException(status_code=404, detail="Template not found")
        
    db.delete(db_template)
    db.commit()
    return {"message": "Template deleted"}
