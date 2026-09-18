#!/bin/bash
# Test bulk email validation on Oracle server

echo "=========================================="
echo "  Bulk Email Validation Test"
echo "=========================================="
echo ""

# Create test CSV
cat > /tmp/test_emails.csv << 'EOF'
Email,Name,Company
test@gmail.com,Test User,Test Inc
info@google.com,Google,Google Inc
support@github.com,GitHub,GitHub Inc
invalid@nonexistentdomain99999.com,Invalid,None
noreply@gmail.com,NoReply,Gmail
EOF

echo "[1/4] Created test CSV with 5 emails"
cat /tmp/test_emails.csv
echo ""

# Upload to API
echo "[2/4] Uploading to validation API..."
UPLOAD_RESPONSE=$(curl -s -k https://data-validator.wolfgroupindia.com/api/validation/upload \
  -X POST -H 'Content-Type: application/json' \
  -d "{
    \"filename\": \"test_bulk.csv\",
    \"content\": \"$(cat /tmp/test_emails.csv | base64 -w0)\",
    \"email_column\": \"Email\"
  }")

echo "$UPLOAD_RESPONSE" | jq .
JOB_ID=$(echo "$UPLOAD_RESPONSE" | jq -r .id)
echo ""

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
    echo "❌ Upload failed!"
    exit 1
fi

echo "✅ Job created: ID=$JOB_ID"
echo ""

# Wait for processing
echo "[3/4] Waiting for validation to complete..."
for i in {1..30}; do
    sleep 2
    STATUS=$(curl -s -k https://data-validator.wolfgroupindia.com/api/validation/jobs/$JOB_ID | jq -r .status)
    PROCESSED=$(curl -s -k https://data-validator.wolfgroupindia.com/api/validation/jobs/$JOB_ID | jq -r .processed_count)
    TOTAL=$(curl -s -k https://data-validator.wolfgroupindia.com/api/validation/jobs/$JOB_ID | jq -r .total_records)
    
    echo "  Status: $STATUS | Progress: $PROCESSED/$TOTAL"
    
    if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "FAILED" ]; then
        break
    fi
done
echo ""

# Get results
echo "[4/4] Fetching results..."
curl -s -k https://data-validator.wolfgroupindia.com/api/validation/jobs/$JOB_ID/download > /tmp/validated_results.csv

echo ""
echo "=========================================="
echo "  Results:"
echo "=========================================="
cat /tmp/validated_results.csv | column -t -s,
echo ""

echo "=========================================="
echo "  Summary:"
echo "=========================================="
curl -s -k https://data-validator.wolfgroupindia.com/api/validation/jobs/$JOB_ID | jq '{
  job_id: .id,
  status: .status,
  total: .total_records,
  processed: .processed_count,
  valid: .valid_count,
  invalid: .invalid_count,
  unknown: .unknown_count
}'
echo ""
