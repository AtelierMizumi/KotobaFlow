# ==============================================================================
# Media Handler — yt-dlp + FFmpeg
# Lightweight Python image with media tools
# ==============================================================================
FROM python:3.11-slim AS base

# Install system dependencies (ffmpeg + yt-dlp needs)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 kotobaflow && \
    useradd --system --uid 1001 --gid kotobaflow worker

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create cache directory
RUN mkdir -p /app/media-cache && chown -R worker:kotobaflow /app

USER worker

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
