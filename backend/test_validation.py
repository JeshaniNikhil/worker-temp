import sys
import os
import csv
import io

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal, engine, Base
from app.models.models import ValidationJob, ValidationResult
from app.worker import process_csv_validation

# Make sure tables exist
Base.metadata.create_all(bind=engine)

def run_test():
    db = SessionLocal()
    
    # Create test job
    job = ValidationJob(
        filename="test_order.csv",
        status="PENDING"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    csv_data = """Sr. No.,Email,Name
1,test1@example.com,Test 1
2,test2@example.com,Test 2
3,test3@example.com,Test 3
4,test4@example.com,Test 4
5,test5@example.com,Test 5
"""
    print("Testing processing of CSV...")
    
    # Call the worker directly synchronously
    try:
        process_csv_validation(job.id, csv_data, "Email")
    except Exception as e:
        print(f"Error during processing: {e}")
        db.close()
        return False
        
    db.refresh(job)
    print(f"Job Status: {job.status}")
    
    # Check results
    results = db.query(ValidationResult).filter(ValidationResult.job_id == job.id).order_by(ValidationResult.id.asc()).all()
    
    success = True
    print("\nResults Order Validation:")
    print("-" * 50)
    for i, res in enumerate(results):
        expected_email = f"test{i+1}@example.com"
        print(f"Index: {i}, DB ID: {res.id}, Email: {res.email}, Expected: {expected_email}")
        if res.email != expected_email:
            print("❌ MISMATCH!")
            success = False
            
    if success:
        print("\n✅ Test Passed: Serial Order was preserved successfully!")
    else:
        print("\n❌ Test Failed: Order was NOT preserved.")
        
    db.close()
    return success

if __name__ == "__main__":
    result = run_test()
    if not result:
        sys.exit(1)
