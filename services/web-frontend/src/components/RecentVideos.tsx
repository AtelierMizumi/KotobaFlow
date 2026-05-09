"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs } from "@/lib/api";
import VideoCard from "./VideoCard";

export default function RecentVideos() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecent() {
      try {
        // Fetch up to 4 most recent jobs
        const res = await listJobs(undefined, undefined, 4, 0);
        setJobs(res.jobs || []);
      } catch (err) {
        console.error("Failed to load recent videos:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, []);

  if (loading) return null; // Or a skeleton if you prefer
  if (jobs.length === 0) return null; // Don't show the section if no history

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Xem gần đây
        </h2>
        <Link href="/library" style={{ color: "var(--accent-primary)", fontSize: "0.9rem", textDecoration: "none" }}>
          Xem tất cả →
        </Link>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
        gap: 16 
      }}>
        {jobs.map((job) => (
          <VideoCard
            key={job.job_id}
            jobId={job.job_id}
            title={job.metadata?.title || job.url}
            thumbnail={job.metadata?.thumbnail}
            duration={job.metadata?.duration}
            status={job.status}
            createdAt={job.created_at}
          />
        ))}
      </div>
    </div>
  );
}
