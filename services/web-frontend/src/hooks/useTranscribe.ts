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

/** Manages the WebSocket connection to the inference-worker. */
export function useTranscribe(): UseTranscribeReturn {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const cleanupRef = useRef<(() => void) | null>(null);

  const start = useCallback((jobId: string) => {
    // Cleanup any existing connection
    cleanupRef.current?.();

    setSegments([]);
    setStatus("connecting");
    setStatusMessage("Đang kết nối...");

    const cleanup = streamTranscription(jobId, {
      onStatus: (msg) => {
        setStatus("transcribing");
        setStatusMessage(msg);
      },
      onSegment: (segment) => {
        setSegments((prev) => [...prev, segment]);
      },
      onComplete: (total) => {
        setStatus("done");
        setStatusMessage(`Hoàn thành: ${total} câu`);
      },
      onError: (msg) => {
        setStatus("error");
        setStatusMessage(msg);
      },
    });

    cleanupRef.current = cleanup;
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setSegments([]);
    setStatus("idle");
    setStatusMessage("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  return { segments, status, statusMessage, start, reset };
}
