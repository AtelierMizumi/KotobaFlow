"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { extractFromUrl, uploadFile, waitForJob } from "@/lib/api";

export default function UrlInputForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      setStatus("Đang gửi URL...");
      const job = await extractFromUrl(url.trim());
      if (job.cached) {
        setStatus("⚡ Đã xử lý trước đó, đang mở...");
        router.push(`/study/${job.job_id}`);
        return;
      }
      setStatus("Đang tải và xử lý audio...");
      await waitForJob(job.job_id, setStatus);
      router.push(`/study/${job.job_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      setLoading(false);
    }
  }, [url, router]);

  const handleFileDrop = useCallback(async (file: File) => {
    setLoading(true);
    setError("");

    try {
      setStatus("Đang upload file...");
      const job = await uploadFile(file);
      setStatus("Đang xử lý audio...");
      await waitForJob(job.job_id, setStatus);
      router.push(`/study/${job.job_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      setLoading(false);
    }
  }, [router]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileDrop(file);
  }, [handleFileDrop]);

  return (
    <div style={{ width: "100%", maxWidth: 560 }}>
      {/* URL Input */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{
          display: "flex",
          gap: 8,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "6px 6px 6px 16px",
          transition: "border-color 0.2s",
        }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
        >
          <input
            id="youtube-url-input"
            type="url"
            placeholder="Dán link YouTube tại đây..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "0.95rem",
            }}
          />
          <button
            id="submit-url-btn"
            type="submit"
            disabled={loading || !url.trim()}
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: "0.88rem" }}
          >
            {loading ? "⏳" : "▶ Bắt đầu"}
          </button>
        </div>
      </form>

      {/* Drag & Drop */}
      <div style={{ textAlign: "center", margin: "12px 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
        hoặc
      </div>
      <div
        id="file-drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "video/*,audio/*";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFileDrop(file);
          };
          input.click();
        }}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent-primary)" : "var(--border-subtle)"}`,
          borderRadius: "var(--radius-md)",
          padding: "24px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s",
          background: dragOver ? "rgba(124,106,247,0.05)" : "transparent",
        }}
      >
        <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>📁</div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Kéo thả file video/audio
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 4 }}>
          MP4, MKV, MP3, WAV được hỗ trợ
        </div>
      </div>

      {/* Status / Error */}
      {loading && (
        <div className="status-bar" style={{ marginTop: 16 }}>
          <div className="spinner" />
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div style={{
          marginTop: 16,
          padding: "10px 16px",
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.3)",
          borderRadius: "var(--radius-sm)",
          color: "var(--accent-red)",
          fontSize: "0.85rem",
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
