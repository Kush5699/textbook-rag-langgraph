FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Poppler and Tesseract make scanned textbook PDFs usable through OCR.
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-guj \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Opt in for a full local CrossEncoder reranker with:
# docker build --build-arg INSTALL_RERANKER=true .
ARG INSTALL_RERANKER=false
COPY requirements-reranker.txt .
RUN if [ "$INSTALL_RERANKER" = "true" ]; then pip install -r requirements-reranker.txt; fi

COPY app ./app
COPY tests ./tests
RUN mkdir -p /app/data /app/uploads && useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
