"use client";
import { useRef, forwardRef, useImperativeHandle } from "react";

interface VideoPlayerProps {
  videoUrl?: string;
  jobId: string;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  element: HTMLVideoElement | null;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ videoUrl, jobId }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          videoRef.current.play();
        }
      },
      get element() {
        return videoRef.current;
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
        {videoUrl ? (
          <video
            ref={videoRef}
            id="main-video"
            src={src}
            controls
            style={{ width: "100%", height: "100%", display: "block" }}
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
