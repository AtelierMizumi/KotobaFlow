# ==============================================================================
# Inference Worker — Faster-Whisper STT
# CPU-optimized Python image for speech-to-text
# ==============================================================================
FROM python:3.11-slim AS base

# Install system dependencies for CTranslate2
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 kotobaflow && \
    useradd --system --uid 1001 --gid kotobaflow worker

WORKDIR /app
ENV HF_HOME=/app/models/huggingface

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create directories
RUN mkdir -p /app/models /app/media-cache && \
    chown -R worker:kotobaflow /app

USER worker

EXPOSE 8001

# Pre-download model on first run (cached in volume)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
