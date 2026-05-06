"""
KotobaFlow — Inference Worker Service
Provides REST + WebSocket APIs for Japanese speech-to-text using Faster-Whisper.
Now with transcript caching to avoid re-running Whisper for the same video.
"""

import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from pydantic import BaseModel

from app.whisper_engine import WhisperEngine

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MEDIA_SERVICE_URL = os.getenv("MEDIA_SERVICE_URL", "http://media-handler:8003")
NLP_SERVICE_URL = os.getenv("NLP_SERVICE_URL", "http://nlp-processor:8002")
TRANSCRIPT_CACHE_DIR = Path(os.getenv("TRANSCRIPT_CACHE_DIR", "/app/media-cache"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Whisper Engine (singleton)
# ---------------------------------------------------------------------------
engine = WhisperEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the Whisper model on startup."""
    logger.info("Loading Whisper model on startup...")
    engine.load_model()
    logger.info("Whisper model ready.")
    yield
    logger.info("Shutting down inference worker.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="KotobaFlow Inference Worker",
    description="Speech-to-text service using Faster-Whisper",
    version="0.2.0",
    lifespan=lifespan,
)



# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class TranscribeRequest(BaseModel):
    job_id: str
    enrich_nlp: bool = True  # Whether to also run NLP analysis


# ---------------------------------------------------------------------------
# Transcript Cache Helpers
# ---------------------------------------------------------------------------
def _transcript_cache_path(job_id: str) -> Path:
    """Get the cache file path for a job's transcript."""
    return TRANSCRIPT_CACHE_DIR / f"{job_id}_transcript.json"


def _load_cached_transcript(job_id: str) -> dict | None:
    """Load a cached transcript if it exists."""
    path = _transcript_cache_path(job_id)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            logger.info(f"[{job_id}] Transcript loaded from cache")
            return data
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"[{job_id}] Failed to load cached transcript: {e}")
    return None


def _save_transcript_cache(job_id: str, segments: list[dict]):
    """Save transcript segments to cache."""
    path = _transcript_cache_path(job_id)
    try:
        TRANSCRIPT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"segments": segments, "job_id": job_id}, f, ensure_ascii=False)
        logger.info(f"[{job_id}] Transcript cached to {path}")
    except OSError as e:
        logger.warning(f"[{job_id}] Failed to save transcript cache: {e}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker."""
    model_loaded = engine.model is not None
    return {
        "status": "healthy" if model_loaded else "loading",
        "service": "inference-worker",
        "model_loaded": model_loaded,
        "model_size": engine.model_size,
    }


@app.post("/api/transcribe")
async def transcribe(request: TranscribeRequest):
    """
    Full transcription of a media-handler job.
    Downloads audio from media-handler, runs Whisper, optionally enriches with NLP.
    Returns cached result if available.
    """
    # Check cache first
    cached = _load_cached_transcript(request.job_id)
    if cached:
        return cached

    # Fetch audio from media-handler
    audio_path = await _download_audio(request.job_id)

    # Run transcription
    result = engine.transcribe(audio_path)

    # Optionally enrich with NLP
    if request.enrich_nlp:
        result = await _enrich_with_nlp(result)

    # Cache the result
    _save_transcript_cache(request.job_id, result.get("segments", []))

    return result


@app.get("/api/transcript/{job_id}")
async def get_cached_transcript(job_id: str):
    """Get a cached transcript if available (no re-processing)."""
    cached = _load_cached_transcript(job_id)
    if cached:
        return {"cached": True, **cached}
    return {"cached": False, "segments": []}


@app.websocket("/ws/transcribe")
async def ws_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint for streaming transcription.
    
    Client sends: {"job_id": "abc123", "enrich_nlp": true}
    Server streams: {"type": "segment", "data": {...}} per segment
    Server ends:    {"type": "complete", "total_segments": N}
    
    If a cached transcript exists, streams from cache (instant).
    """
    await websocket.accept()
    logger.info("WebSocket client connected")

    try:
        # Receive initial request
        init_data = await websocket.receive_json()
        job_id = init_data.get("job_id")
        enrich_nlp = init_data.get("enrich_nlp", True)

        if not job_id:
            await websocket.send_json({"type": "error", "message": "job_id required"})
            await websocket.close()
            return

        # Check transcript cache first
        cached = _load_cached_transcript(job_id)
        if cached and cached.get("segments"):
            await websocket.send_json({
                "type": "status",
                "message": "Đang tải từ cache...",
            })
            segments = cached["segments"]
            for seg in segments:
                await websocket.send_json({"type": "segment", "data": seg})
            await websocket.send_json({
                "type": "complete",
                "total_segments": len(segments),
                "cached": True,
            })
            return

        # Download audio
        await websocket.send_json({"type": "status", "message": "Đang tải audio..."})
        audio_path = await _download_audio(job_id)

        # Stream transcription
        await websocket.send_json({"type": "status", "message": "Đang phiên âm..."})
        segment_count = 0
        all_segments: list[dict] = []

        for segment in engine.transcribe_streaming(audio_path):
            # Optionally enrich each segment with NLP
            if enrich_nlp:
                segment = await _enrich_segment_nlp(segment)

            await websocket.send_json({
                "type": "segment",
                "data": segment,
            })
            all_segments.append(segment)
            segment_count += 1

        # Cache the completed transcript
        _save_transcript_cache(job_id, all_segments)

        await websocket.send_json({
            "type": "complete",
            "total_segments": segment_count,
        })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
async def _download_audio(job_id: str) -> str:
    """Download audio from media-handler service."""
    audio_path = f"/app/media-cache/{job_id}.wav"

    # Check if already cached locally
    import os
    if os.path.exists(audio_path):
        return audio_path

    # Download from media-handler
    async with httpx.AsyncClient(timeout=300) as client:
        # Check job status first
        status_resp = await client.get(f"{MEDIA_SERVICE_URL}/api/status/{job_id}")
        if status_resp.status_code != 200:
            raise HTTPException(status_code=404, detail=f"Media job {job_id} not found")

        status = status_resp.json()
        if status["status"] != "ready":
            raise HTTPException(
                status_code=409,
                detail=f"Media job not ready: {status['status']}",
            )

        # Download audio
        audio_resp = await client.get(f"{MEDIA_SERVICE_URL}/api/audio/{job_id}")
        if audio_resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download audio")

        with open(audio_path, "wb") as f:
            f.write(audio_resp.content)

    return audio_path


async def _enrich_with_nlp(result: dict) -> dict:
    """Enrich all segments with NLP analysis (furigana, POS, dictionary)."""
    texts = [seg["text"] for seg in result["segments"]]

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                f"{NLP_SERVICE_URL}/api/batch-analyze",
                json={"sentences": texts},
            )
            if resp.status_code == 200:
                nlp_results = resp.json()
                for i, seg in enumerate(result["segments"]):
                    if i < len(nlp_results.get("results", [])):
                        seg["nlp"] = nlp_results["results"][i]
        except Exception as e:
            logger.warning(f"NLP enrichment failed: {e}")

    return result


async def _enrich_segment_nlp(segment: dict) -> dict:
    """Enrich a single segment with NLP analysis."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{NLP_SERVICE_URL}/api/analyze",
                json={"text": segment["text"]},
            )
            if resp.status_code == 200:
                segment["nlp"] = resp.json()
        except Exception as e:
            logger.warning(f"NLP enrichment failed for segment {segment['id']}: {e}")

    return segment
