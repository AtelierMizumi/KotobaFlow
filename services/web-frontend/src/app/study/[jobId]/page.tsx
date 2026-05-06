"use client";
import { use, useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVideoSync } from "@/hooks/useVideoSync";
import { useTranscribe } from "@/hooks/useTranscribe";
import { getMetadata } from "@/lib/api";
import VideoPlayer, { VideoPlayerHandle } from "@/components/VideoPlayer";
import KaraokeSubtitle from "@/components/KaraokeSubtitle";
import TranscriptSidebar from "@/components/TranscriptSidebar";
import StudyModeBar from "@/components/StudyModeBar";
import type { StudyMode, NLPToken, DictionaryEntry, Segment, VideoMetadata } from "@/lib/types";

export default function StudyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const router = useRouter();

  const videoRef = useRef<VideoPlayerHandle>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>("listening");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const { segments, status, statusMessage, start } = useTranscribe();
  const { activeIndex, seekTo } = useVideoSync(segments, videoRef);

  // Load metadata and start transcription on mount
  useEffect(() => {
    if (!jobId) return;

    getMetadata(jobId)
      .then(setMetadata)
      .catch(() => {});

    start(jobId);
  }, [jobId, start]);

  const handleSeek = useCallback((timestamp: number) => {
    seekTo(timestamp);
    videoRef.current?.seekTo(timestamp);
  }, [seekTo]);

  const handleAddFlashcard = useCallback(
    (token: NLPToken, dict: DictionaryEntry, segment: Segment) => {
      // TODO Phase 5: save to IndexedDB + call flashcard API
      console.log("Add flashcard:", { token, dict, segment });
      alert(`「${token.surface}」を追加しました！\n(Flashcard feature coming in Phase 5)`);
    },
    []
  );

  return (
    <div
      id="study-page"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      {/* Top bar */}
      <StudyModeBar
        current={studyMode}
        onChange={setStudyMode}
        videoTitle={metadata?.title}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Video + Karaoke */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Back button */}
          <div style={{ padding: "8px 12px", flexShrink: 0 }}>
            <button
              id="back-home-btn"
              className="btn-ghost"
              onClick={() => router.push("/")}
              style={{ fontSize: "0.8rem" }}
            >
              ← Trang chủ
            </button>
          </div>

          {/* Video player */}
          <div style={{ padding: "0 12px", flexShrink: 0 }}>
            <VideoPlayer
              ref={videoRef}
              jobId={jobId}
              videoUrl={metadata?.source === "youtube" ? metadata.original_url : undefined}
            />
          </div>

          {/* Karaoke subtitle */}
          <KaraokeSubtitle
            segments={segments}
            activeIndex={activeIndex}
            studyMode={studyMode}
            onAddFlashcard={handleAddFlashcard}
          />

          {/* Shadowing mode hint */}
          {studyMode === "shadowing" && (
            <div style={{
              padding: "8px 16px",
              background: "rgba(124,106,247,0.08)",
              borderTop: "1px solid var(--border-active)",
              fontSize: "0.82rem",
              color: "var(--accent-primary)",
              textAlign: "center",
              flexShrink: 0,
            }}>
              🗣 Chế độ Shadowing — Hãy nhắc lại sau khi nghe!
            </div>
          )}

          {/* Dictation mode hint */}
          {studyMode === "dictation" && (
            <div style={{
              padding: "8px 16px",
              background: "rgba(251,191,36,0.06)",
              borderTop: "1px solid rgba(251,191,36,0.2)",
              fontSize: "0.82rem",
              color: "var(--accent-amber)",
              textAlign: "center",
              flexShrink: 0,
            }}>
              ✍️ Chế độ Chép chính tả — Văn bản đã bị ẩn, hãy lắng nghe!
            </div>
          )}
        </div>

        {/* Right: Transcript sidebar */}
        <div style={{ width: 280, flexShrink: 0, overflow: "hidden" }}>
          <TranscriptSidebar
            segments={segments}
            activeIndex={activeIndex}
            onSeek={handleSeek}
            status={status}
            statusMessage={statusMessage}
          />
        </div>
      </div>
    </div>
  );
}
