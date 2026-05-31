# Use Python 3.11-slim as the robust base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

WORKDIR /app

# Install system dependencies, curl, OpenCV support, and Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgl1 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Prepare Django Python Backend ----
COPY backend/requirements.txt ./backend/requirements.txt
# Upgrade pip and install requirements + gunicorn directly in container
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r ./backend/requirements.txt \
    && pip install --no-cache-dir gunicorn

COPY backend/ ./backend/

# ---- Prepare Node.js & React Frontend ----
COPY package*.json ./
# Force installation of devDependencies (Vite, esbuild, typescript) for building, even if NODE_ENV=production
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
