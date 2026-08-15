from app.models.database import engine, Base
from app.models.models import ValidationJob, ValidationResult, Template

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("Database tables created successfully!")
