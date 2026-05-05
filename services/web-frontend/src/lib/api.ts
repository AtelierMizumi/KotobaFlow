// =============================================================================
// KotobaFlow — API Client
// All communication with the backend (via API Gateway at :8000)
// =============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8001";

// ---------------------------------------------------------------------------
// Media Handler
// ---------------------------------------------------------------------------

/** Submit a YouTube URL for audio extraction. Returns job_id. */
export async function extractFromUrl(url: string) {
  const res = await fetch(`${API_BASE}/api/media/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Extract failed: ${res.statusText}`);
  return res.json();
}

/** Upload a local media file. Returns job_id. */
export async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/media/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

/** Poll the status of a media extraction job. */
export async function getJobStatus(jobId: string) {
  const res = await fetch(`${API_BASE}/api/media/status/${jobId}`);
  if (!res.ok) throw new Error(`Status check failed: ${res.statusText}`);
  return res.json();
}

/** Get video metadata for a job. */
export async function getMetadata(jobId: string) {
  const res = await fetch(`${API_BASE}/api/media/metadata/${jobId}`);
  if (!res.ok) throw new Error(`Metadata fetch failed: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// NLP Processor
// ---------------------------------------------------------------------------

/** Analyze a single Japanese sentence — returns tokens + furigana. */
export async function analyzeText(text: string) {
  const res = await fetch(`${API_BASE}/api/nlp/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Analysis failed: ${res.statusText}`);
  return res.json();
}

/** Look up a word in the JMDict dictionary. */
export async function lookupWord(word: string) {
  const res = await fetch(`${API_BASE}/api/nlp/lookup/${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error(`Lookup failed: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Inference Worker — WebSocket streaming
// ---------------------------------------------------------------------------

export interface TranscribeCallbacks {
  onStatus: (message: string) => void;
  onSegment: (segment: import("./types").Segment) => void;
  onComplete: (totalSegments: number) => void;
  onError: (message: string) => void;
}

/**
 * Connect to inference-worker WebSocket and stream transcription results.
 * Returns a cleanup function to close the connection.
 */
export function streamTranscription(
  jobId: string,
  callbacks: TranscribeCallbacks
): () => void {
  // Connect directly to inference-worker for WebSocket (bypasses nginx for WS)
  const wsUrl = `${WS_BASE}/ws/transcribe`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ job_id: jobId, enrich_nlp: true }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "status":
        callbacks.onStatus(msg.message);
        break;
      case "segment":
        callbacks.onSegment(msg.data);
        break;
      case "complete":
        callbacks.onComplete(msg.total_segments);
        break;
      case "error":
        callbacks.onError(msg.message);
        break;
    }
  };

  ws.onerror = () => callbacks.onError("WebSocket connection error");
  ws.onclose = () => {};

  return () => ws.close();
}

// ---------------------------------------------------------------------------
// Polling helper — wait for a job to be ready
// ---------------------------------------------------------------------------

/** Poll job status every 1.5s until ready or error. */
export async function waitForJob(
  jobId: string,
  onProgress?: (status: string) => void,
  maxAttempts = 120
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await getJobStatus(jobId);
    onProgress?.(job.status);
    if (job.status === "ready") return;
    if (job.status === "error") throw new Error(job.error ?? "Job failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Job timed out after 3 minutes");
}
