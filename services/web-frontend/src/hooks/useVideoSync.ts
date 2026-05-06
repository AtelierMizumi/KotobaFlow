"use client";
import { useEffect, useState, useRef, RefObject } from "react";
import type { Segment } from "@/lib/types";
import type { VideoPlayerHandle } from "@/components/VideoPlayer";

/** Binary search to find active segment index at a given timestamp. */
function findActiveSegment(segments: Segment[], time: number): number {
  let lo = 0, hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (time < seg.start) hi = mid - 1;
    else if (time > seg.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * Synchronizes the video currentTime with the active transcript segment.
 * Uses requestAnimationFrame for smooth, low-overhead polling.
 */
export function useVideoSync(
  segments: Segment[],
  videoRef: RefObject<VideoPlayerHandle | null>
) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!segments.length) return;

    const tick = () => {
      const player = videoRef.current;
      if (player) {
        const time = player.getCurrentTime();
        const idx = findActiveSegment(segments, time);
        setActiveIndex((prev) => (prev !== idx ? idx : prev));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [segments, videoRef]);

  const seekTo = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.seekTo(timestamp);
    }
  };

  return { activeIndex, seekTo };
}
