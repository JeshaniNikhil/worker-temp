#!/bin/bash
# Quick start native Python API on Volknode (1vCPU, 1GB RAM)

echo "🚀 Starting Wolf Validator API..."
cd /opt/wolf-validator-backend
source venv/bin/activate
export $(cat .env | grep -v '#' | xargs)
uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 2 --loop uvloop
