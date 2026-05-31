# Use Python 3.11-slim as the robust base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# HF model repo where dermavision.onnx is stored (override with --build-arg)
ARG HF_MODEL_REPO=WilfredAyine/dermavision-onnx

WORKDIR /app

# Install system dependencies, curl, OpenCV support, Node.js 20,
# and native build tools required by better-sqlite3 (node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgl1 \
    build-essential \
    python3-dev \
    libsqlite3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Prepare Django Python Backend ----
COPY backend/requirements.txt ./backend/requirements.txt
# Upgrade pip and install requirements + gunicorn + huggingface_hub for model download
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r ./backend/requirements.txt \
    && pip install --no-cache-dir gunicorn huggingface_hub

COPY backend/ ./backend/

# ---- Download ONNX model from Hugging Face Hub ----
# Single-line form required — Dockerfile parser breaks on multi-line python3 -c "..." blocks
RUN python3 -c "import pathlib, huggingface_hub; dst=pathlib.Path('/app/backend/model'); dst.mkdir(parents=True, exist_ok=True); huggingface_hub.hf_hub_download(repo_id='${HF_MODEL_REPO}', filename='dermavision.onnx', local_dir=str(dst)); print('Model downloaded OK')"

# ---- Prepare Node.js & React Frontend ----
COPY package*.json ./
# Force installation of devDependencies (Vite, esbuild, typescript) for building
RUN npm ci --include=dev

COPY . .
# Build both the Vite frontend and bundle the Express server
RUN npm run build

# Copy start script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Hugging Face Spaces expects port 7860
EXPOSE 7860

CMD ["./start.sh"]
