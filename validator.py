import sys
import os
import argparse
import csv
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Ensure backend module can be found
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.email_checker import SMTPValidator

def format_result(res: dict) -> str:
    lines = [
        f"Email: {res.get('Email')}",
        f"Domain: {res.get('Domain')}",
        f"MX records: {', '.join(res.get('MX records', []))}",
        f"Selected MX: {res.get('Selected MX')}",
    ]
    if res.get('MX priority') is not None and res.get('MX priority') != "":
        lines.append(f"MX priority: {res.get('MX priority')}")
    
    lines.append(f"DNS result: {res.get('DNS result')}")
    lines.append(f"TCP connection result: {res.get('TCP connection result')} (Latency: {res.get('TCP latency')}s)")
    lines.append(f"SMTP banner: {res.get('SMTP banner')}")
    lines.append(f"EHLO response: {res.get('EHLO response')}")
    lines.append(f"MAIL FROM response: {res.get('MAIL FROM response')}")
    lines.append(f"RCPT TO response: {res.get('RCPT TO response')}")
    lines.append(f"SMTP response code: {res.get('SMTP response code')}")
    
    if res.get("Final classification") in ("VALID", "ACCEPTED"):
        lines.append(f"Result: {res.get('Final classification')} / ACCEPTED")
    else:
        lines.append(f"Result: {res.get('Final classification')}")
        
    lines.append(f"Reason: {res.get('Reason')}")
    lines.append(f"Timestamp: {res.get('Timestamp')}")
    return "\n".join(lines)

def process_single(email: str):
    print(f"Validating: {email}...\n")
    validator = SMTPValidator(timeout=10.0)
    result = validator.check_email_smtp(email)
    print(format_result(result))
    return result

def process_bulk(file_path: str, max_workers: int = 5):
    print(f"Loading {file_path}...")
    emails = []
    
    with open(file_path, "r", encoding="utf-8") as f:
        # Check if CSV
        if file_path.endswith('.csv'):
            reader = csv.reader(f)
            # Try to detect header
            first_row = next(reader, None)
            if first_row:
                # Naive guess: find the column with '@' or just use first column
                email_idx = 0
                for i, col in enumerate(first_row):
                    if '@' in col:
                        email_idx = i
                        emails.append(col.strip())
                        break
                    elif 'email' in col.lower() or 'mail' in col.lower():
                        email_idx = i
                        break
                        
                for row in reader:
                    if len(row) > email_idx and row[email_idx].strip():
                        emails.append(row[email_idx].strip())
        else:
            for line in f:
                line = line.strip()
                if line and '@' in line:
                    emails.append(line)
                    
    total = len(emails)
    print(f"Found {total} emails to validate.")
    
    counts = {
        "VALID": 0,
        "INVALID": 0,
        "UNKNOWN": 0,
        "TIMEOUT": 0,
        "TEMPORARY_FAILURE": 0,
        "CATCH_ALL": 0,
        "DNS_ERROR": 0,
        "NO_MX": 0,
        "CONNECTION_ERROR": 0,
        "INVALID_SYNTAX": 0
    }
    
    results = []
    start_time = time.time()
    
    validator = SMTPValidator(timeout=10.0)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(validator.check_email_smtp, email): email for email in emails}
        
        completed = 0
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            
            cls = res.get("Final classification")
            if cls in counts:
                counts[cls] += 1
            else:
                counts["UNKNOWN"] = counts.get("UNKNOWN", 0) + 1
                
            completed += 1
            progress = int((completed / total) * 100)
            sys.stdout.write(f"\rProgress: [{('=' * (progress // 2)).ljust(50)}] {progress}% ({completed}/{total})")
            sys.stdout.flush()
            
    end_time = time.time()
    print("\n\nValidation Complete!")
    print("-" * 30)
    for k, v in counts.items():
        if v > 0:
            print(f"{k}: {v}")
            
    speed = total / (end_time - start_time) if (end_time - start_time) > 0 else 0
    print(f"\nProcessing speed: {speed:.2f} emails/second")
    
    # Export to CSV
    export_file = f"validation_results_{int(time.time())}.csv"
    if results:
        keys = results[0].keys()
        with open(export_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(results)
        print(f"Exported to {export_file}")


def main():
    parser = argparse.ArgumentParser(description="Advanced Email Validator")
    parser.add_argument("email", nargs="?", help="A single email address to validate")
    parser.add_argument("--file", help="Path to a file containing emails (txt or csv)")
    parser.add_argument("--workers", type=int, default=5, help="Number of concurrent workers for bulk validation")
    
    args = parser.parse_args()
    
    if args.email:
        process_single(args.email)
    elif args.file:
        process_bulk(args.file, args.workers)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
