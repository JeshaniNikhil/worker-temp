import time
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import validation, templates, spam
from app.models.database import engine, Base
from app.models import models
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)

app = FastAPI(title="Email Validation & Template Platform API")


@app.on_event("startup")
def on_startup():
    # Retry DB connection up to 10 times (handles DB startup race condition in Docker)
    max_retries = 10
    retry_delay = 2
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created / verified successfully.")
            return
        except OperationalError as e:
            if attempt < max_retries - 1:
                logger.warning(
                    f"Database not ready (attempt {attempt + 1}/{max_retries}). "
                    f"Retrying in {retry_delay}s... Error: {e}"
                )
                time.sleep(retry_delay)
            else:
                logger.error("Could not connect to the database after multiple retries.")
                raise


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validation.router, prefix="/api/validation", tags=["validation"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(spam.router, prefix="/api/spam", tags=["spam"])


@app.get("/")
def read_root():
    return {"message": "Email Validation Platform API is running"}
