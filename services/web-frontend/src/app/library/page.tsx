"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listJobs } from "@/lib/api";
import VideoCard from "@/components/VideoCard";

export default function LibraryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        const statusParam = filter === "all" ? undefined : filter;
        const res = await listJobs(statusParam, undefined, 50, 0);
        setJobs(res.jobs || []);
      } catch (err: any) {
        setError(err.message || "Failed to load library");
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [filter]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            className="btn-ghost"
            onClick={() => router.push("/")}
            style={{ fontSize: "1.2rem", padding: "8px 12px" }}
          >
            ←
          </button>
          <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Thư viện của bạn</h1>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "ready", "processing", "error"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--border-subtle)",
                background: filter === f ? "var(--accent-primary)" : "var(--bg-elevated)",
                color: filter === f ? "#fff" : "var(--text-secondary)",
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {f === "all" ? "Tất cả" : f === "ready" ? "Hoàn thành" : f === "processing" ? "Đang xử lý" : "Lỗi"}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div style={{ color: "var(--accent-red)", padding: 20, textAlign: "center", background: "rgba(248,113,113,0.1)", borderRadius: "var(--radius-md)" }}>
          {error}
        </div>
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📭</div>
          <p>Chưa có video nào ở đây.</p>
        </div>
      ) : (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
          gap: 20 
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
      )}
    </div>
  );
}
