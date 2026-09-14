#!/bin/bash
echo "Updating systemd service..."

# Add the custom queues
sed -i 's/-n worker@volknode/-Q celery,single_checks -n worker@volknode/' /etc/systemd/system/email-worker.service

# Increase concurrency to 2 so it can handle CSVs and single checks simultaneously
sed -i 's/concurrency=1/concurrency=2/' /etc/systemd/system/email-worker.service

echo "Reloading and restarting worker..."
systemctl daemon-reload
systemctl restart email-worker

echo "Done! The worker is now listening to single_checks with concurrency=2."
