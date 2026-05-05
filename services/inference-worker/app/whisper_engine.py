"""
KotobaFlow — Whisper Engine
Manages the Faster-Whisper model for Japanese speech-to-text.
"""

import os
import logging
from typing import Generator

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class WhisperEngine:
    """Wrapper around Faster-Whisper for optimized Japanese STT."""

    def __init__(self):
        self.model_size = os.getenv("WHISPER_MODEL", "medium")
        self.device = os.getenv("WHISPER_DEVICE", "cpu")
        self.compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        self.language = os.getenv("WHISPER_LANGUAGE", "ja")
        self.beam_size = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
        self.cpu_threads = int(os.getenv("WHISPER_CPU_THREADS", "2"))
        self.num_workers = int(os.getenv("WHISPER_NUM_WORKERS", "1"))
        self.model: WhisperModel | None = None

    def load_model(self):
        """Load the Whisper model into memory."""
        if self.model is not None:
            logger.info("Model already loaded, skipping.")
            return

        logger.info(
            f"Loading Whisper model: {self.model_size} "
            f"(device={self.device}, compute_type={self.compute_type})"
        )

        model_cache = os.getenv("WHISPER_MODEL_DIR", "/app/models")

        self.model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type,
            cpu_threads=self.cpu_threads,
            num_workers=self.num_workers,
            download_root=model_cache,
        )
        logger.info("Whisper model loaded successfully.")

    def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe an audio file and return full result with word-level timestamps.
        
        Returns:
            {
                "language": "ja",
                "duration": 120.5,
                "segments": [
                    {
                        "id": 0,
                        "start": 1.24,
                        "end": 4.56,
                        "text": "今日はいい天気ですね",
                        "words": [
                            {"word": "今日", "start": 1.24, "end": 1.80, "probability": 0.95},
                            ...
                        ]
                    }
                ]
            }
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        segments_gen, info = self.model.transcribe(
            audio_path,
            language=self.language,
            beam_size=self.beam_size,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
        )

        segments = []
        for seg in segments_gen:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3),
                    })

            segments.append({
                "id": seg.id,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                "words": words,
            })

        return {
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 3),
            "segments": segments,
        }

    def transcribe_streaming(self, audio_path: str) -> Generator[dict, None, None]:
        """
        Stream transcription results segment-by-segment.
        Yields one segment dict at a time for real-time display.
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        segments_gen, info = self.model.transcribe(
            audio_path,
            language=self.language,
            beam_size=self.beam_size,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
        )

        for seg in segments_gen:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3),
                    })

            yield {
                "id": seg.id,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                "words": words,
            }
