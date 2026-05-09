"use client";
import { useRef, forwardRef, useImperativeHandle, useState } from "react";
import dynamic from "next/dynamic";
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface VideoPlayerProps {
  videoUrl?: string;
  jobId: string;
  loading?: boolean;
  error?: string | null;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  element: HTMLVideoElement | null;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ videoUrl, jobId, loading, error }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [playerError, setPlayerError] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (playerRef.current) {
          playerRef.current.seekTo(time, "seconds");
        } else if (videoRef.current) {
          videoRef.current.currentTime = time;
          videoRef.current.play().catch(() => {});
        }
      },
      getCurrentTime: () => {
        if (playerRef.current) return playerRef.current.getCurrentTime() || 0;
        if (videoRef.current) return videoRef.current.currentTime || 0;
        return 0;
      },
      get element() {
        return videoRef.current || (playerRef.current?.getInternalPlayer() as HTMLVideoElement) || null;
      },
    }));

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    const src = videoUrl ?? `${apiBase}/api/media/audio/${jobId}`;

    return (
      <div
        id="video-player-container"
        style={{
          position: "relative",
          width: "100%",
          background: "#000",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <div style={{ color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <span>Đang tải thông tin...</span>
          </div>
        ) : error || playerError ? (
          <div style={{ color: "var(--accent-red)", textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚠</div>
            <div>{error || "Video không thể phát (có thể do bị chặn nhúng)."}</div>
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, color: "var(--accent-primary)", textDecoration: "underline" }}>
                Mở video trên YouTube
              </a>
            )}
          </div>
        ) : videoUrl ? (
          <ReactPlayer
            ref={playerRef}
            url={src}
            controls={true}
            width="100%"
            height="100%"
            onError={() => setPlayerError(true)}
            config={{
              youtube: {
                playerVars: { 
                  origin: typeof window !== "undefined" ? window.location.origin : undefined 
                }
              }
            }}
          />
        ) : (
          /* Audio-only mode: waveform placeholder */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ fontSize: "4rem" }}>🎵</div>
            <div style={{ fontSize: "0.9rem" }}>Chế độ audio</div>
            <audio
              ref={videoRef as unknown as React.RefObject<HTMLAudioElement>}
              id="main-audio"
              src={src}
              controls
              style={{ width: 300 }}
            />
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
