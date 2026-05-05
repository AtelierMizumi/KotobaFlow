"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { jmdict, type LookupResult } from "@/lib/jmdict-idb";

export type JMDictStatus = "idle" | "loading" | "ready" | "error";

interface UseJMDictReturn {
  status: JMDictStatus;
  entryCount: number;
  loadProgress: { loaded: number; total: number } | null;
  /** Instant client-side lookup — no network call */
  lookup: (term: string) => Promise<LookupResult | null>;
  /** Lookup using longest-prefix-match on raw text */
  lookupPrefix: (text: string) => Promise<LookupResult | null>;
  /** Force re-download from backend */
  reload: () => void;
}

const API_BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000")
  : "";

export function useJMDict(): UseJMDictReturn {
  const [status, setStatus] = useState<JMDictStatus>("idle");
  const [entryCount, setEntryCount] = useState(0);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const initRef = useRef(false);

  const initDB = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    setStatus("loading");
    try {
      await jmdict.init(API_BASE, (loaded, total) => {
        setLoadProgress({ loaded, total });
      });
      setEntryCount(jmdict.entryCount);
      setStatus("ready");
      setLoadProgress(null);
    } catch (err) {
      console.error("[useJMDict] Init failed:", err);
      setStatus("error");
      initRef.current = false; // allow retry
    }
  }, []);

  useEffect(() => {
    initDB();
  }, [initDB]);

  const lookup = useCallback(async (term: string): Promise<LookupResult | null> => {
    if (status !== "ready") return null;
    return jmdict.lookupExact(term);
  }, [status]);

  const lookupPrefix = useCallback(async (text: string): Promise<LookupResult | null> => {
    if (status !== "ready") return null;
    return jmdict.lookup(text);
  }, [status]);

  const reload = useCallback(async () => {
    await jmdict.clear();
    initRef.current = false;
    initDB();
  }, [initDB]);

  return { status, entryCount, loadProgress, lookup, lookupPrefix, reload };
}
