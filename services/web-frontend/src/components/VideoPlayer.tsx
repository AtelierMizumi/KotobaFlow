"use client";
import { useRef, forwardRef, useImperativeHandle, useState } from "react";
import ReactPlayerType from "react-player";
const ReactPlayer = ReactPlayerType as any;

interface VideoPlayerProps {
  videoUrl?: string;
  jobId: string;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  element: HTMLVideoElement | null;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ videoUrl, jobId }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [playing, setPlaying] = useState(false);

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
        {videoUrl ? (
          <ReactPlayer
            ref={playerRef}
            url={src}
            controls
            width="100%"
            height="100%"
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
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
