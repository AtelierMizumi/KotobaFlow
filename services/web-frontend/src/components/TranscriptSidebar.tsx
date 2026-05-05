"use client";
import { useRef, useEffect } from "react";
import type { Segment } from "@/lib/types";

interface TranscriptSidebarProps {
  segments: Segment[];
  activeIndex: number;
  onSeek: (timestamp: number) => void;
  status: string;
  statusMessage: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TranscriptSidebar({
  segments,
  activeIndex,
  onSeek,
  status,
  statusMessage,
}: TranscriptSidebarProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && listRef.current) {
      const list = listRef.current;
      const item = activeRef.current;
      const listTop = list.scrollTop;
      const listBottom = listTop + list.clientHeight;
      const itemTop = item.offsetTop;
      const itemBottom = itemTop + item.offsetHeight;
      if (itemTop < listTop || itemBottom > listBottom) {
        list.scrollTo({ top: itemTop - list.clientHeight / 2, behavior: "smooth" });
      }
    }
  }, [activeIndex]);

  const isTranscribing = status === "transcribing" || status === "connecting";

  return (
    <div
      id="transcript-sidebar"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Transcript
        </h2>
        {segments.length > 0 && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {segments.length} câu
          </span>
        )}
      </div>

      {/* Status bar */}
      {isTranscribing && (
        <div className="status-bar" style={{ margin: "8px 12px", flexShrink: 0 }}>
          <div className="spinner" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Segment list */}
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}
      >
        {segments.length === 0 && !isTranscribing && (
          <div style={{
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            textAlign: "center",
            padding: "32px 16px",
          }}>
            {status === "idle"
              ? "Transcript sẽ xuất hiện ở đây"
              : "Đang xử lý..."}
          </div>
        )}

        {segments.map((seg, i) => (
          <div
            key={seg.id}
            ref={i === activeIndex ? activeRef : null}
            id={`transcript-item-${seg.id}`}
            className={`transcript-item${i === activeIndex ? " active" : ""}`}
            onClick={() => onSeek(seg.start)}
            title={`Nhảy đến ${formatTime(seg.start)}`}
          >
            <span className="timestamp">{formatTime(seg.start)}</span>
            <span className="text" lang="ja">{seg.text}</span>
          </div>
        ))}

        {/* Streaming indicator */}
        {isTranscribing && segments.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            color: "var(--text-muted)",
            fontSize: "0.78rem",
          }}>
            <div className="spinner" style={{ width: 10, height: 10 }} />
            <span>Đang nhận dữ liệu...</span>
          </div>
        )}
      </div>
    </div>
  );
}
