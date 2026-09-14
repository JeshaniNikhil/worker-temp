#!/bin/bash
echo "Updating systemd service..."

# The original file has '-n worker@volknode', we need to add the -Q flag before it
sed -i 's/-n worker@volknode/-Q celery,single_checks -n worker@volknode/' /etc/systemd/system/email-worker.service

echo "Reloading and restarting worker..."
systemctl daemon-reload
systemctl restart email-worker

echo "Done! The worker is now listening to single_checks."
