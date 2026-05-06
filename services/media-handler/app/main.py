"""
KotobaFlow — Media Handler Service
Extracts audio from YouTube URLs and uploaded files using yt-dlp + FFmpeg.
Now with persistent SQLite job cache and video library API.
"""

import os
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel

from app.extractor import MediaExtractor
from app.cache_db import JobCacheDB

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MEDIA_CACHE_DIR = Path(os.getenv("MEDIA_CACHE_DIR", "/app/media-cache"))
MAX_VIDEO_DURATION = int(os.getenv("MAX_VIDEO_DURATION", "3600"))
AUDIO_SAMPLE_RATE = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
CACHE_MAX_AGE_DAYS = int(os.getenv("CACHE_MAX_AGE_DAYS", "30"))

MEDIA_CACHE_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="KotobaFlow Media Handler",
    description="Audio extraction service using yt-dlp + FFmpeg",
    version="0.2.0",
)


extractor = MediaExtractor(
    cache_dir=MEDIA_CACHE_DIR,
    sample_rate=AUDIO_SAMPLE_RATE,
    max_duration=MAX_VIDEO_DURATION,
)

# Persistent SQLite job cache (replaces in-memory dict)
job_cache = JobCacheDB(MEDIA_CACHE_DIR / "jobs.db")


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
    cached: bool = False


class JobListResponse(BaseModel):
    jobs: list[dict]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------
async def process_extraction(job_id: str, url: str):
    """Background task to extract audio from a URL."""
    try:
        job_cache.update_status(job_id, "processing")
        logger.info(f"[{job_id}] Starting extraction: {url}")

        metadata = await extractor.extract_metadata(url)
        metadata["original_url"] = url
        job_cache.update_status(job_id, "processing", metadata=metadata)

        # Check duration limit
        duration = metadata.get("duration", 0)
        if duration > MAX_VIDEO_DURATION:
            raise ValueError(
                f"Video too long: {duration}s (max {MAX_VIDEO_DURATION}s)"
            )

        audio_path = await extractor.extract_audio(url, job_id)
        job_cache.update_status(
            job_id, "ready",
            audio_path=str(audio_path),
            metadata=metadata,
        )
        logger.info(f"[{job_id}] Extraction complete: {audio_path}")

    except Exception as e:
        logger.error(f"[{job_id}] Extraction failed: {e}")
        job_cache.update_status(job_id, "error", error=str(e))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker."""
    return {"status": "healthy", "service": "media-handler"}


@app.post("/api/extract", response_model=JobStatus)
async def extract_audio(request: ExtractRequest, background_tasks: BackgroundTasks):
    """Submit a URL for audio extraction. Returns cached result if available."""
    url = request.url.strip()

    # Check cache: same URL already processed?
    cached_job = job_cache.get_by_url_hash(url)
    if cached_job:
        audio_path = cached_job.get("audio_path")
        if audio_path and Path(audio_path).exists():
            logger.info(f"Cache hit for URL: {url} → job {cached_job['job_id']}")
            return JobStatus(
                job_id=cached_job["job_id"],
                status="ready",
                metadata=cached_job.get("metadata"),
                cached=True,
            )

    # No cache hit → create new job
    job_id = str(uuid.uuid4())[:8]
    job_cache.save_job(job_id=job_id, url=url, status="pending")
    background_tasks.add_task(process_extraction, job_id, url)
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

    metadata = {"title": file.filename, "source": "upload"}
    job_cache.save_job(
        job_id=job_id,
        url=str(upload_path),
        status="pending",
        metadata=metadata,
    )
    background_tasks.add_task(process_extraction, job_id, str(upload_path))
    return JobStatus(job_id=job_id, status="pending")


@app.get("/api/status/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Check the status of an extraction job."""
    job = job_cache.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        error=job.get("error"),
        metadata=job.get("metadata"),
    )


@app.get("/api/audio/{job_id}")
async def get_audio(job_id: str):
    """Stream the extracted audio file (16kHz mono WAV)."""
    job = job_cache.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

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
    job = job_cache.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job.get("metadata", {})


# ---------------------------------------------------------------------------
# Video Library API
# ---------------------------------------------------------------------------
@app.get("/api/jobs", response_model=JobListResponse)
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status: ready, error, pending"),
    search: Optional[str] = Query(None, description="Search in title/URL"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List all processed jobs for the video library."""
    jobs = job_cache.list_jobs(status=status, search=search, limit=limit, offset=offset)
    total = job_cache.count_jobs(status=status)
    return JobListResponse(jobs=jobs, total=total, limit=limit, offset=offset)


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated audio file."""
    job = job_cache.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Delete audio file
    audio_path = job.get("audio_path")
    if audio_path:
        Path(audio_path).unlink(missing_ok=True)

    # Delete transcript cache
    transcript_path = MEDIA_CACHE_DIR / f"{job_id}_transcript.json"
    transcript_path.unlink(missing_ok=True)

    job_cache.delete_job(job_id)
    return {"message": f"Job {job_id} deleted"}


@app.post("/api/cleanup")
async def cleanup_old_jobs():
    """Clean up old failed/pending jobs."""
    job_cache.cleanup_old(max_age_days=CACHE_MAX_AGE_DAYS)
    return {"message": "Cleanup complete"}


# ---------------------------------------------------------------------------
# Cache check endpoint
# ---------------------------------------------------------------------------
@app.post("/api/check-cache")
async def check_cache(request: ExtractRequest):
    """Check if a URL has already been processed (for frontend quick-check)."""
    cached_job = job_cache.get_by_url_hash(request.url.strip())
    if cached_job and cached_job.get("audio_path") and Path(cached_job["audio_path"]).exists():
        return {
            "cached": True,
            "job_id": cached_job["job_id"],
            "metadata": cached_job.get("metadata"),
        }
    return {"cached": False}
