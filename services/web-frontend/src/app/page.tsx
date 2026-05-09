import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import RecentVideos from "@/components/RecentVideos";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "60px 20px",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,106,247,0.15) 0%, transparent 70%)",
      }}
    >
      {/* Top nav */}
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <Link href="/library" style={{ 
          color: "var(--text-secondary)", 
          textDecoration: "none",
          fontSize: "0.95rem",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-elevated)",
          padding: "8px 16px",
          borderRadius: "var(--radius-full)",
          border: "1px solid var(--border-subtle)",
        }}>
          <span>📚</span> Thư viện của bạn
        </Link>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 48, marginTop: 40 }}>
        <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>言葉</div>
        <h1 style={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1.1, marginBottom: 16 }}>
          <span className="glow-text">KotobaFlow</span>
        </h1>
        <p style={{
          color: "var(--text-secondary)",
          fontSize: "1.05rem",
          maxWidth: 480,
          lineHeight: 1.7,
          margin: "0 auto 8px",
        }}>
          Học tiếng Nhật thông qua video yêu thích với phụ đề tương tác,
          Furigana tự động và từ điển thông minh.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Powered by Faster-Whisper · SudachiPy · JMDict
        </p>
      </div>

      {/* URL Input */}
      <UrlInputForm />

      {/* Recent Videos Section */}
      <div style={{ width: "100%", maxWidth: 900, marginTop: 60 }}>
        <RecentVideos />
      </div>

      {/* Feature pills */}
      <div style={{
        display: "flex",
        gap: 10,
        marginTop: 60,
        marginBottom: 40,
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {[
          { icon: "🎌", label: "Furigana tự động" },
          { icon: "📖", label: "Từ điển Nhật-Việt" },
          { icon: "🗣", label: "Luyện Shadowing" },
          { icon: "🃏", label: "Tạo Flashcard" },
          { icon: "🎯", label: "JLPT N5–N1" },
        ].map((f) => (
          <div
            key={f.label}
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
