"use client";
import type { StudyMode } from "@/lib/types";

const MODES: { id: StudyMode; label: string; icon: string; desc: string }[] = [
  { id: "listening",  label: "聞く",        icon: "🎧", desc: "Xem & nghe bình thường" },
  { id: "shadowing",  label: "シャドーイング", icon: "🗣", desc: "Luyện phát âm theo" },
  { id: "dictation",  label: "書き取り",     icon: "✍️", desc: "Chép chính tả" },
  { id: "summary",    label: "要約",         icon: "📝", desc: "Tóm tắt nội dung" },
];

interface StudyModeBarProps {
  current: StudyMode;
  onChange: (mode: StudyMode) => void;
  videoTitle?: string;
}

export default function StudyModeBar({ current, onChange, videoTitle }: StudyModeBarProps) {
  return (
    <div
      id="study-mode-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Video title */}
      <div style={{
        fontSize: "0.88rem",
        color: "var(--text-primary)",
        fontWeight: 500,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 400,
        flex: 1,
      }}>
        {videoTitle ?? "KotobaFlow"}
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            id={`mode-tab-${mode.id}`}
            className={`mode-tab${current === mode.id ? " active" : ""}`}
            onClick={() => onChange(mode.id)}
            title={mode.desc}
            lang="ja"
          >
            <span style={{ marginRight: 4 }}>{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
