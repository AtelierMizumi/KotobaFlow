"""
KotobaFlow — Media Handler Service
Extracts audio from YouTube URLs and uploaded files using yt-dlp + FFmpeg.
"""

import os
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel

from app.extractor import MediaExtractor

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MEDIA_CACHE_DIR = Path(os.getenv("MEDIA_CACHE_DIR", "/app/media-cache"))
MAX_VIDEO_DURATION = int(os.getenv("MAX_VIDEO_DURATION", "3600"))
AUDIO_SAMPLE_RATE = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))

MEDIA_CACHE_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="KotobaFlow Media Handler",
    description="Audio extraction service using yt-dlp + FFmpeg",
    version="0.1.0",
)


extractor = MediaExtractor(
    cache_dir=MEDIA_CACHE_DIR,
    sample_rate=AUDIO_SAMPLE_RATE,
    max_duration=MAX_VIDEO_DURATION,
)

# In-memory job store (replace with Redis for production)
jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ExtractRequest(BaseModel):
    url: str


class JobStatus(BaseModel):
    job_id: str
    status: str  # "pending", "processing", "ready", "error"
    progress: Optional[float] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------
async def process_extraction(job_id: str, url: str):
    """Background task to extract audio from a URL."""
    try:
        jobs[job_id]["status"] = "processing"
        logger.info(f"[{job_id}] Starting extraction: {url}")

        metadata = await extractor.extract_metadata(url)
        metadata["original_url"] = url
        jobs[job_id]["metadata"] = metadata

        # Check duration limit
        duration = metadata.get("duration", 0)
        if duration > MAX_VIDEO_DURATION:
            raise ValueError(
                f"Video too long: {duration}s (max {MAX_VIDEO_DURATION}s)"
            )

        audio_path = await extractor.extract_audio(url, job_id)
        jobs[job_id]["audio_path"] = str(audio_path)
        jobs[job_id]["status"] = "ready"
        logger.info(f"[{job_id}] Extraction complete: {audio_path}")

    except Exception as e:
        logger.error(f"[{job_id}] Extraction failed: {e}")
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker."""
    return {"status": "healthy", "service": "media-handler"}


@app.post("/api/extract", response_model=JobStatus)
async def extract_audio(request: ExtractRequest, background_tasks: BackgroundTasks):
    """Submit a URL for audio extraction."""
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "status": "pending",
        "url": request.url,
        "metadata": None,
        "audio_path": None,
        "error": None,
    }
    background_tasks.add_task(process_extraction, job_id, request.url)
    return JobStatus(job_id=job_id, status="pending")


@app.post("/api/upload", response_model=JobStatus)
async def upload_file(
    background_tasks: BackgroundTasks, file: UploadFile = File(...)
):
    """Upload a media file for audio extraction."""
    job_id = str(uuid.uuid4())[:8]
    upload_path = MEDIA_CACHE_DIR / f"{job_id}_upload{Path(file.filename).suffix}"

    # Save uploaded file
    content = await file.read()
    with open(upload_path, "wb") as f:
        f.write(content)

    jobs[job_id] = {
        "status": "pending",
        "url": str(upload_path),
        "metadata": {"title": file.filename, "source": "upload"},
        "audio_path": None,
        "error": None,
    }
    background_tasks.add_task(process_extraction, job_id, str(upload_path))
    return JobStatus(job_id=job_id, status="pending")


@app.get("/api/status/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Check the status of an extraction job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    job = jobs[job_id]
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        error=job.get("error"),
        metadata=job.get("metadata"),
    )


@app.get("/api/audio/{job_id}")
async def get_audio(job_id: str):
    """Stream the extracted audio file (16kHz mono WAV)."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job = jobs[job_id]
    if job["status"] != "ready":
        raise HTTPException(
            status_code=409,
            detail=f"Job not ready. Current status: {job['status']}",
        )

    audio_path = Path(job["audio_path"])
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    return FileResponse(
        path=str(audio_path),
        media_type="audio/wav",
        filename=f"{job_id}.wav",
    )


@app.get("/api/metadata/{job_id}")
async def get_metadata(job_id: str):
    """Get video/audio metadata."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return jobs[job_id].get("metadata", {})
