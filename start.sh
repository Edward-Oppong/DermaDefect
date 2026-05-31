#!/bin/bash

# Run collectstatic to ensure staticfiles dir exists (suppresses WhiteNoise warning)
cd /app/backend
python manage.py collectstatic --noinput --clear 2>&1 | tail -3

# Start Django backend:
#   --workers 1   : one worker to avoid loading the 346MB ONNX model twice
#   --timeout 300 : 5 min timeout — model load + coarse heatmap needs headroom
#   --preload     : load model in master before forking so workers inherit it
gunicorn core.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 1 \
    --timeout 300 \
    --preload &

# Start Express/Vite frontend in the root
cd /app
npm run start
