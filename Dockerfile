# Multi-stage build for GSSTB Scholar Fullstack on Render
# Stage 1: Build React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Ultra-lightweight Python Backend with Pre-Cached Embeddings & Tesseract OCR
FROM python:3.11-slim AS runner
WORKDIR /app

# Install lightweight system dependencies including native Tesseract C++ OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache SentenceTransformer model inside Docker image so queries never wait for HuggingFace downloads
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy backend code
COPY backend/ /app/backend/

# Copy compiled frontend from Stage 1 into backend static directory
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Set working directory to backend
WORKDIR /app/backend

# Create persistent data directories
RUN mkdir -p /app/backend/data/pdfs /app/backend/data/chroma /app/backend/data/bm25

# Low-memory environment optimizations
ENV PORT=8001
ENV PYTHONUNBUFFERED=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV TORCH_NUM_THREADS=1

EXPOSE 8001

# Start Uvicorn single-worker server on assigned Render PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 1"]
