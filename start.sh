#!/bin/bash

# Activate python virtual environment & start Django
source /opt/venv/bin/activate
cd /app/backend
gunicorn core.wsgi:application --bind 127.0.0.1:8000 --workers 2 --timeout 120 &

# Start Express/Vite Frontend in the root
cd /app
npm run start
