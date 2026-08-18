# Multi-stage build for GSSTB Scholar Fullstack on Render
# Stage 1: Build React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend with EasyOCR and dependencies
FROM python:3.11-slim AS runner
WORKDIR /app

# Install system dependencies for OpenCV and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ /app/backend/

# Copy compiled frontend from Stage 1 into backend static directory
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Set working directory to backend
WORKDIR /app/backend

# Create persistent data directories
RUN mkdir -p /app/backend/data/pdfs /app/backend/data/chroma /app/backend/data/bm25

# Environment configuration
ENV PORT=8001
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

# Start Uvicorn server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
