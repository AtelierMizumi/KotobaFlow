"""
KotobaFlow — Media Extractor
Handles audio extraction using yt-dlp and FFmpeg.
"""

import asyncio
import json
import logging
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class MediaExtractor:
    """Extracts and converts audio from YouTube URLs or local files."""

    def __init__(self, cache_dir: Path, sample_rate: int = 16000, max_duration: int = 3600):
        self.cache_dir = cache_dir
        self.sample_rate = sample_rate
        self.max_duration = max_duration
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    async def extract_metadata(self, url: str) -> dict:
        """Extract metadata from a URL or file without downloading."""
        if Path(url).exists():
            # Local file — use ffprobe
            return await self._probe_local(url)

        # YouTube / remote URL — use yt-dlp
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-playlist",
            url,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(f"yt-dlp metadata failed: {stderr.decode()}")

        info = json.loads(stdout.decode())
        return {
            "title": info.get("title", "Unknown"),
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail"),
            "channel": info.get("channel"),
            "upload_date": info.get("upload_date"),
            "description": info.get("description", "")[:500],
            "source": "youtube",
        }

    async def _probe_local(self, filepath: str) -> dict:
        """Probe a local file with ffprobe."""
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            filepath,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        info = json.loads(stdout.decode())

        fmt = info.get("format", {})
        return {
            "title": Path(filepath).stem,
            "duration": float(fmt.get("duration", 0)),
            "source": "upload",
        }

    async def extract_audio(self, url: str, job_id: str) -> Path:
        """
        Extract audio and convert to 16kHz mono WAV.
        
        Pipeline:
          - For YouTube: yt-dlp → best audio → pipe → FFmpeg → 16kHz mono WAV
          - For local file: FFmpeg → 16kHz mono WAV
        """
        output_path = self.cache_dir / f"{job_id}.wav"

        if output_path.exists():
            logger.info(f"[{job_id}] Using cached audio: {output_path}")
            return output_path

        if Path(url).exists():
            # Local file — direct FFmpeg conversion
            await self._ffmpeg_convert(url, output_path)
        else:
            # YouTube — yt-dlp pipe to FFmpeg
            await self._ytdlp_extract(url, output_path)

        return output_path

    async def _ytdlp_extract(self, url: str, output_path: Path):
        """Download best audio from YouTube and convert to WAV."""
        # Step 1: Download with yt-dlp to a temp file
        temp_audio = output_path.with_suffix(".temp_audio")

        ytdlp_cmd = [
            "yt-dlp",
            "-f", "ba",              # Best audio
            "--no-playlist",
            "-o", str(temp_audio),
            url,
        ]

        logger.info(f"Downloading audio: {' '.join(ytdlp_cmd)}")
        proc = await asyncio.create_subprocess_exec(
            *ytdlp_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(f"yt-dlp download failed: {stderr.decode()}")

        # Find the actual downloaded file (yt-dlp may add extension)
        actual_file = None
        for f in output_path.parent.glob(f"{temp_audio.stem}*"):
            actual_file = f
            break

        if not actual_file or not actual_file.exists():
            raise RuntimeError("Downloaded audio file not found")

        # Step 2: Convert to 16kHz mono WAV with FFmpeg
        await self._ffmpeg_convert(str(actual_file), output_path)

        # Cleanup temp file
        actual_file.unlink(missing_ok=True)

    async def _ffmpeg_convert(self, input_path: str, output_path: Path):
        """Convert any audio to 16kHz mono WAV using FFmpeg."""
        cmd = [
            "ffmpeg",
            "-i", input_path,
            "-vn",                   # No video
            "-ar", str(self.sample_rate),  # 16kHz
            "-ac", "1",              # Mono
            "-c:a", "pcm_s16le",     # 16-bit PCM
            "-y",                    # Overwrite
            str(output_path),
        ]

        logger.info(f"Converting audio: {' '.join(cmd)}")
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg conversion failed: {stderr.decode()}")

        logger.info(f"Audio ready: {output_path} ({output_path.stat().st_size} bytes)")
