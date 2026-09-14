#!/usr/bin/env python3
"""
Database migration script to add missing columns to production database.
Adds: user_id, column_mapping, email_statuses, and all social media columns.
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@127.0.0.1:5434/emailplatform")

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    migrations = [
        # Add user_id to validation_jobs
        "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);",
        "CREATE INDEX IF NOT EXISTS ix_validation_jobs_user_id ON validation_jobs(user_id);",
        
        # Add column_mapping to validation_jobs
        "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS column_mapping JSON;",
        
        # Add email_statuses to validation_results (for multi-email support)
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS email_statuses JSON;",
        
        # Add Instagram columns
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS instagram_url VARCHAR;",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS instagram_status VARCHAR;",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS instagram_reason VARCHAR;",
        
        # Add LinkedIn columns
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS linkedin_status VARCHAR;",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS linkedin_reason VARCHAR;",
        
        # Add WhatsApp columns
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR;",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR;",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS whatsapp_reason VARCHAR;",
    ]
    
    with engine.connect() as conn:
        for migration in migrations:
            print(f"Running: {migration[:80]}...")
            try:
                conn.execute(text(migration))
                conn.commit()
                print("  ✓ Success")
            except Exception as e:
                print(f"  ✗ Error (may already exist): {e}")
    
    print("\n✅ Migration complete!")

if __name__ == "__main__":
    run_migration()
