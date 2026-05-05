"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { lookupWord } from "@/lib/api";
import type { NLPToken, DictionaryEntry } from "@/lib/types";
import type { LookupResult } from "@/lib/jmdict-idb";

interface DictionaryPopupProps {
  token: NLPToken;
  anchorEl: HTMLElement;
  onClose: () => void;
  onAddFlashcard?: (token: NLPToken, dict: DictionaryEntry) => void;
  /** Client-side lookup function from useJMDict (instant, offline) */
  clientLookup?: (term: string) => Promise<LookupResult | null>;
}

function JLPTBadge({ level }: { level: string | null }) {
  if (!level) return null;
  return <span className={`jlpt-badge jlpt-${level}`}>{level}</span>;
}

export default function DictionaryPopup({
  token,
  anchorEl,
  onClose,
  onAddFlashcard,
  clientLookup,
}: DictionaryPopupProps) {
  const [dict, setDict] = useState<DictionaryEntry | null>(null);
  const [inflectionInfo, setInflectionInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"idb" | "api" | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Smart positioning
  const rect = anchorEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const showAbove = spaceBelow < 260;
  const top = showAbove
    ? rect.top - 10 + window.scrollY
    : rect.bottom + 8 + window.scrollY;
  const left = Math.min(
    Math.max(rect.left + window.scrollX, 8),
    window.innerWidth - 340
  );

  // ---------------------------------------------------------------------------
  // Lookup: client-side IndexedDB first, fallback to API
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDict(null);
    setInflectionInfo(null);

    async function doLookup() {
      // 1. Try pre-loaded token dictionary data
      if (token.dictionary) {
        if (!cancelled) {
          setDict(token.dictionary as DictionaryEntry);
          setSource("idb");
          setLoading(false);
        }
        return;
      }

      // 2. Try client-side IndexedDB (instant, ~0ms)
      if (clientLookup) {
        const result = await clientLookup(token.base_form);
        if (!cancelled && result) {
          setDict({
            word: result.entry.kanji[0] || result.entry.readings[0],
            readings: result.entry.readings,
            meanings_en: result.entry.meanings_en,
            meanings_vi: result.entry.meanings_vi,
            pos_tags: result.entry.pos_tags,
            jlpt_level: result.entry.jlpt_level,
            common: result.entry.common,
          });
          if (result.inflectionType !== "original") {
            setInflectionInfo(result.inflectionType);
          }
          setSource("idb");
          setLoading(false);
          return;
        }
      }

      // 3. Fallback: server API (handles cases not in IndexedDB yet)
      try {
        const res = await lookupWord(token.base_form);
        if (!cancelled) {
          setDict(res.dictionary ?? null);
          setSource("api");
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    doLookup();
    return () => { cancelled = true; };
  }, [token, clientLookup]);

  // Close on outside click
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAddFlashcard = useCallback(() => {
    if (dict) onAddFlashcard?.(token, dict);
    onClose();
  }, [dict, token, onAddFlashcard, onClose]);

  return (
    <div
      ref={popupRef}
      className="dict-popup"
      id="dictionary-popup"
      style={{
        top,
        left,
        transform: showAbove ? "translateY(-100%)" : "none",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Word + reading */}
          <div lang="ja" style={{ fontSize: "2rem", fontWeight: 600, lineHeight: 1 }}>
            {token.surface}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <span lang="ja">{token.reading}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              {token.pos}
            </span>
          </div>

          {/* Inflection info badge */}
          {inflectionInfo && (
            <div style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 8px",
              borderRadius: 99,
              background: "rgba(124,106,247,0.12)",
              border: "1px solid rgba(124,106,247,0.25)",
              fontSize: "0.7rem",
              color: "var(--accent-primary)",
            }}>
              <span>⚡</span>
              <span lang="ja">{token.surface}</span>
              <span style={{ color: "var(--text-muted)" }}>→</span>
              <span lang="ja">{dict?.word ?? token.base_form}</span>
              <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>({inflectionInfo})</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            id="close-dict-popup"
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "1rem", lineHeight: 1,
            }}
            aria-label="Đóng"
          >✕</button>
          <JLPTBadge level={dict?.jlpt_level ?? null} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px" }}>
        {loading ? (
          <div className="status-bar">
            <div className="spinner" />
            <span style={{ fontSize: "0.8rem" }}>Đang tra từ điển...</span>
          </div>
        ) : dict ? (
          <>
            {/* English meanings */}
            {dict.meanings_en.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  🇬🇧 English
                </div>
                <ol style={{ listStyle: "decimal", color: "var(--text-primary)", fontSize: "0.87rem", lineHeight: 1.65, paddingLeft: "1.2em" }}>
                  {dict.meanings_en.slice(0, 4).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Vietnamese meanings */}
            {dict.meanings_vi && dict.meanings_vi.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  🇻🇳 Tiếng Việt
                </div>
                <ol style={{ listStyle: "decimal", color: "var(--accent-secondary)", fontSize: "0.87rem", lineHeight: 1.65, paddingLeft: "1.2em" }}>
                  {dict.meanings_vi.slice(0, 3).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Common marker */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              {dict.common && (
                <span style={{ fontSize: "0.72rem", color: "var(--accent-secondary)" }}>
                  ✓ Từ phổ biến
                </span>
              )}
              {/* Source indicator */}
              <span style={{
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}>
                {source === "idb" ? "⚡ Offline" : "☁ API"}
              </span>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "8px 0" }}>
            Không tìm thấy trong từ điển
          </div>
        )}
      </div>

      {/* Footer — Add flashcard */}
      {dict && onAddFlashcard && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          <button
            id="add-flashcard-btn"
            className="btn-primary"
            onClick={handleAddFlashcard}
            style={{ width: "100%", fontSize: "0.82rem", padding: "8px" }}
          >
            🃏 Thêm vào Flashcard
          </button>
        </div>
      )}
    </div>
  );
}
