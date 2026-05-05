import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KotobaFlow — Học tiếng Nhật qua video",
  description:
    "Hệ thống học tiếng Nhật tương tác qua video với phụ đề Karaoke, Furigana và từ điển thông minh.",
  keywords: ["học tiếng Nhật", "Japanese learning", "furigana", "karaoke subtitles", "JLPT"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
