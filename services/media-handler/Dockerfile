# ==============================================================================
# Media Handler — yt-dlp + FFmpeg
# Lightweight Python image with media tools
# ==============================================================================
# Stage 1: Get static FFmpeg binaries
FROM mwader/static-ffmpeg:7.1.1 AS ffmpeg

# Stage 2: Final Image
FROM python:3.11-slim AS base

# Copy static ffmpeg and ffprobe from Stage 1
COPY --from=ffmpeg /ffmpeg /usr/local/bin/
COPY --from=ffmpeg /ffprobe /usr/local/bin/

# Install only minimal system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        nodejs \
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
