#!/bin/bash
echo "Updating Volknode Worker..."
cd /root/worker-temp

# Force update from Github
git fetch origin
git reset --hard origin/main

# Update the service file to listen to the secret queue
echo "Updating systemd service..."
sed -i 's/-n worker@%h/-Q celery,single_checks -n worker@%h/' /etc/systemd/system/email-worker.service

# Reload and restart
echo "Restarting worker..."
systemctl daemon-reload
systemctl restart email-worker

echo "Done! The worker is now protected from ghost workers and listening to single_checks."
