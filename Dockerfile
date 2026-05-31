# Use a Node image with Debian Bookworm as the base (includes Python 3.11 support)
FROM node:20-bookworm-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

WORKDIR /app

# Install Python, pip, virtualenv, and system dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# ---- Prepare Django Backend ----
COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r ./backend/requirements.txt

COPY backend/ ./backend/
RUN cd backend && python3 manage.py collectstatic --noinput

# ---- Prepare Node.js & React Frontend ----
COPY package*.json ./
RUN npm ci

COPY . .
# Build both the Vite frontend and bundle the Express server
RUN npm run build

# Copy start script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Hugging Face Spaces expects port 7860
EXPOSE 7860

CMD ["./start.sh"]
