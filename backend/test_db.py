import os
from sqlalchemy import create_engine
engine = create_engine('postgresql://user:password@127.0.0.1:5434/emailplatform')
try:
    with engine.connect() as conn:
        res = conn.execute("SELECT disposable_count FROM validation_jobs LIMIT 1")
    print("Column exists!")
except Exception as e:
    print(f"Error: {e}")
