#!/usr/bin/env python3
"""
KotobaFlow — Vietnamese Dictionary Builder
Adds Vietnamese meanings to the JMDict SQLite database.

Sources for Vietnamese-Japanese dictionary data:
  1. Community-contributed Mazii/Jisho-style data
  2. Manual CSV imports
  3. Future: Translation API enrichment

Usage: python build_vi_dict.py <jmdict.db> [vi_data.csv]

CSV format (tab-separated):
  word<TAB>meaning
  天気<TAB>thời tiết
  食べる<TAB>ăn
"""

import csv
import sqlite3
import sys
from pathlib import Path


# Common JLPT N5-N3 vocabulary with Vietnamese meanings
# This seed data covers the most essential words for beginners
SEED_DATA = [
    # N5 Essential
    ("食べる", "ăn"),
    ("飲む", "uống"),
    ("行く", "đi"),
    ("来る", "đến"),
    ("見る", "xem, nhìn"),
    ("聞く", "nghe, hỏi"),
    ("読む", "đọc"),
    ("書く", "viết"),
    ("話す", "nói"),
    ("買う", "mua"),
    ("分かる", "hiểu"),
    ("思う", "nghĩ"),
    ("知る", "biết"),
    ("住む", "sống, cư trú"),
    ("使う", "sử dụng"),
    ("作る", "làm, tạo"),
    ("待つ", "đợi, chờ"),
    ("持つ", "giữ, cầm"),
    ("歩く", "đi bộ"),
    ("走る", "chạy"),
    ("泳ぐ", "bơi"),
    ("遊ぶ", "chơi"),
    ("勉強", "học tập"),
    ("仕事", "công việc"),
    ("学校", "trường học"),
    ("先生", "giáo viên, thầy/cô"),
    ("学生", "học sinh, sinh viên"),
    ("友達", "bạn bè"),
    ("家族", "gia đình"),
    ("天気", "thời tiết"),
    ("時間", "thời gian"),
    ("今日", "hôm nay"),
    ("明日", "ngày mai"),
    ("昨日", "hôm qua"),
    ("朝", "buổi sáng"),
    ("昼", "buổi trưa"),
    ("夜", "buổi tối, đêm"),
    ("水", "nước"),
    ("食べ物", "đồ ăn"),
    ("飲み物", "đồ uống"),
    ("電車", "tàu điện"),
    ("車", "xe hơi"),
    ("駅", "ga tàu"),
    ("病院", "bệnh viện"),
    ("銀行", "ngân hàng"),
    ("映画", "phim"),
    ("音楽", "âm nhạc"),
    ("写真", "ảnh, hình"),
    ("新聞", "báo"),
    ("電話", "điện thoại"),
    # N4
    ("経験", "kinh nghiệm"),
    ("準備", "chuẩn bị"),
    ("説明", "giải thích"),
    ("約束", "hẹn, hứa"),
    ("練習", "luyện tập"),
    ("研究", "nghiên cứu"),
    ("出発", "xuất phát"),
    ("到着", "đến nơi"),
    ("最初", "đầu tiên"),
    ("最後", "cuối cùng"),
    ("将来", "tương lai"),
    ("社会", "xã hội"),
    ("文化", "văn hóa"),
    ("政治", "chính trị"),
    ("経済", "kinh tế"),
    ("歴史", "lịch sử"),
    ("自然", "tự nhiên"),
    ("環境", "môi trường"),
    ("安全", "an toàn"),
    ("危険", "nguy hiểm"),
]


def build_vietnamese_table(db_path: str, csv_path: str = None):
    """Add Vietnamese meanings table to the JMDict database."""

    if not Path(db_path).exists():
        print(f"Error: Database not found: {db_path}")
        print("Run scripts/setup.sh first to create the JMDict database.")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create Vietnamese meanings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meanings_vi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            base_form TEXT,
            meaning TEXT NOT NULL
        )
    """)

    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vi_word ON meanings_vi(word)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vi_base ON meanings_vi(base_form)")

    # Clear existing data (for re-runs)
    cursor.execute("DELETE FROM meanings_vi")

    # Insert seed data
    print(f"Inserting {len(SEED_DATA)} seed Vietnamese meanings...")
    for word, meaning in SEED_DATA:
        cursor.execute(
            "INSERT INTO meanings_vi (word, base_form, meaning) VALUES (?, ?, ?)",
            (word, word, meaning),
        )

    # Import from CSV if provided
    if csv_path and Path(csv_path).exists():
        print(f"Importing from CSV: {csv_path}")
        count = 0
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f, delimiter="\t")
            for row in reader:
                if len(row) >= 2:
                    word, meaning = row[0].strip(), row[1].strip()
                    if word and meaning:
                        cursor.execute(
                            "INSERT INTO meanings_vi (word, base_form, meaning) VALUES (?, ?, ?)",
                            (word, word, meaning),
                        )
                        count += 1
        print(f"  Imported {count} entries from CSV.")

    conn.commit()

    # Stats
    cursor.execute("SELECT COUNT(*) FROM meanings_vi")
    total = cursor.fetchone()[0]
    print(f"Vietnamese dictionary ready: {total} entries")

    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <jmdict.db> [vi_data.csv]")
        sys.exit(1)

    csv_file = sys.argv[2] if len(sys.argv) > 2 else None
    build_vietnamese_table(sys.argv[1], csv_file)
