"use client";
import { useRouter } from "next/navigation";

interface VideoCardProps {
  jobId: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  status: string;
  createdAt: string;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Vừa xong";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

export default function VideoCard({ jobId, title, thumbnail, duration, status, createdAt }: VideoCardProps) {
  const router = useRouter();
  
  const handleClick = () => {
    if (status === "ready") {
      router.push(`/study/${jobId}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        cursor: status === "ready" ? "pointer" : "default",
        transition: "transform 0.2s, border-color 0.2s",
        opacity: status === "error" ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (status === "ready") {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = "var(--accent-primary)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16/9", backgroundColor: "#000" }}>
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={title} 
            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        ) : (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "2rem" }}>
            🎵
          </div>
        )}
        
        {duration && (
          <div style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: "0.75rem",
            fontWeight: "bold"
          }}>
            {formatDuration(duration)}
          </div>
        )}

        {status === "pending" || status === "processing" ? (
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(251,191,36,0.9)",
            color: "#000",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: "0.75rem",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}>
            <div className="spinner" style={{ width: 12, height: 12, borderTopColor: "#000" }} />
            Đang xử lý
          </div>
        ) : status === "error" ? (
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(248,113,113,0.9)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: "0.75rem",
            fontWeight: "bold"
          }}>
            Lỗi
          </div>
        ) : null}
      </div>
      
      <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          margin: "0 0 8px 0",
          color: "var(--text-primary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden"
        }}>
          {title || "Video không có tiêu đề"}
        </h3>
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.8rem" }}>
          <span>{timeAgo(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
