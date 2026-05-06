"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { streamTranscription } from "@/lib/api";
import type { Segment } from "@/lib/types";

export type TranscribeStatus = "idle" | "connecting" | "transcribing" | "done" | "error";

interface UseTranscribeReturn {
  segments: Segment[];
  status: TranscribeStatus;
  statusMessage: string;
  start: (jobId: string) => void;
  reset: () => void;
}

/** Manages the WebSocket connection to the inference-worker with auto-reconnect. */
export function useTranscribe(): UseTranscribeReturn {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const cleanupRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);
  const maxAttempts = 3;

  const start = useCallback((jobId: string) => {
    // Cleanup any existing connection
    if (cleanupRef.current) cleanupRef.current();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    // Only reset segments on first attempt
    if (attemptRef.current === 0) {
      setSegments([]);
    }
    
    setStatus("connecting");
    setStatusMessage(attemptRef.current > 0 ? `Đang thử kết nối lại (lần ${attemptRef.current}/${maxAttempts})...` : "Đang kết nối...");

    const cleanup = streamTranscription(jobId, {
      onStatus: (msg) => {
        setStatus("transcribing");
        setStatusMessage(msg);
      },
      onSegment: (segment) => {
        setSegments((prev) => {
          // Prevent duplicates if reconnected
          if (prev.some((s) => s.id === segment.id)) return prev;
          return [...prev, segment];
        });
      },
      onComplete: (total) => {
        setStatus("done");
        setStatusMessage(`Hoàn thành: ${total} câu`);
        attemptRef.current = 0; // Reset attempts on success
      },
      onError: (msg) => {
        console.error("[useTranscribe] WS Error:", msg);
        if (attemptRef.current < maxAttempts) {
          attemptRef.current++;
          setStatus("connecting");
          setStatusMessage(`Mất kết nối. Thử lại sau 2 giây...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            start(jobId);
          }, 2000 * attemptRef.current); // Exponential backoff
        } else {
          setStatus("error");
          setStatusMessage("Không thể kết nối đến máy chủ phiên âm.");
        }
      },
    });

    cleanupRef.current = cleanup;
  }, []);

  const reset = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    attemptRef.current = 0;
    setSegments([]);
    setStatus("idle");
    setStatusMessage("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return { segments, status, statusMessage, start, reset };
}
