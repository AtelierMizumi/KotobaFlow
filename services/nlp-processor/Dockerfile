# ==============================================================================
# NLP Processor — SudachiPy + JMDict
# Lightweight Python image for Japanese text analysis
# ==============================================================================
FROM python:3.11-slim AS base

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 kotobaflow && \
    useradd --system --uid 1001 --gid kotobaflow worker

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create data directory
RUN mkdir -p /app/data && chown -R worker:kotobaflow /app

USER worker

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
