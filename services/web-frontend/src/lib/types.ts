// =============================================================================
// KotobaFlow — Shared TypeScript Types
// =============================================================================

/** A single word token with timing info from Whisper */
export interface WordToken {
  word: string;
  start: number;
  end: number;
  probability: number;
}

/** NLP analysis of a token */
export interface NLPToken {
  surface: string;
  base_form: string;
  reading: string;
  reading_katakana: string;
  pos: string;
  pos_detail: string;
  has_kanji: boolean;
  furigana_html: string;
  dictionary?: DictionaryEntry;
}

/** Dictionary entry from JMDict */
export interface DictionaryEntry {
  word: string;
  readings: string[];
  meanings_en: string[];
  meanings_vi: string[];
  pos_tags: string[];
  jlpt_level: string | null;
  common: boolean;
}

/** NLP analysis of a full sentence */
export interface NLPAnalysis {
  sentence: string;
  furigana_html: string;
  tokens: NLPToken[];
}

/** A transcript segment with optional NLP enrichment */
export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordToken[];
  nlp?: NLPAnalysis;
}

/** Full transcription result */
export interface TranscriptResult {
  language: string;
  language_probability: number;
  duration: number;
  segments: Segment[];
}

/** Media extraction job status */
export interface MediaJob {
  job_id: string;
  status: "pending" | "processing" | "ready" | "error";
  progress?: number;
  error?: string;
  metadata?: VideoMetadata;
}

/** Video metadata */
export interface VideoMetadata {
  title: string;
  duration: number;
  thumbnail?: string;
  channel?: string;
  upload_date?: string;
  description?: string;
  source: "youtube" | "upload";
}

/** WebSocket message from inference-worker */
export type WSMessage =
  | { type: "status"; message: string }
  | { type: "segment"; data: Segment }
  | { type: "complete"; total_segments: number }
  | { type: "error"; message: string };

/** Study modes */
export type StudyMode = "listening" | "shadowing" | "dictation" | "summary";

/** A flashcard created from a video segment */
export interface Flashcard {
  id: string;
  word: string;
  reading: string;
  meaning_en: string;
  meaning_vi: string;
  sentence: string;
  sentence_audio_url?: string;
  screenshot_url?: string;
  context_video_id: string;
  context_timestamp: number;
  srs_level: number;
  next_review: string;
}
