#!/usr/bin/env python3
"""
KotobaFlow — JMDict SQLite Builder
Converts JMDict simplified JSON into an optimized SQLite database.

Usage: python build_jmdict_db.py <input.json> <output.db>
"""

import json
import sqlite3
import sys
from pathlib import Path


def build_database(json_path: str, db_path: str):
    """Convert JMDict JSON to SQLite with proper indexes."""
    print(f"Reading {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    words = data.get("words", [])
    print(f"Found {len(words)} entries.")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY,
            kanji_element TEXT,
            reading_element TEXT,
            base_form TEXT,
            sense_glosses_en TEXT,
            pos_tags TEXT,
            jlpt_level TEXT,
            is_common INTEGER DEFAULT 0
        )
    """)

    # Insert entries
    print("Inserting entries...")
    batch = []
    for i, word in enumerate(words):
        # Extract kanji forms
        kanji_forms = [k.get("text", "") for k in word.get("kanji", [])]
        kanji_element = kanji_forms[0] if kanji_forms else ""

        # Extract readings
        readings = [r.get("text", "") for r in word.get("kana", [])]
        reading_element = ";".join(readings)

        # Base form (kanji if available, else reading)
        base_form = kanji_element or (readings[0] if readings else "")

        # Extract senses/meanings
        glosses = []
        pos_set = set()
        for sense in word.get("sense", []):
            for gloss in sense.get("gloss", []):
                if gloss.get("lang", "eng") == "eng":
                    glosses.append(gloss.get("text", ""))
            for pos in sense.get("partOfSpeech", []):
                pos_set.add(pos)

        sense_glosses = ";".join(glosses[:10])  # Limit to 10 meanings
        pos_tags = ";".join(pos_set)

        # Check if common
        is_common = 0
        for k in word.get("kanji", []):
            if k.get("common", False):
                is_common = 1
                break
        if not is_common:
            for k in word.get("kana", []):
                if k.get("common", False):
                    is_common = 1
                    break

        batch.append((
            kanji_element,
            reading_element,
            base_form,
            sense_glosses,
            pos_tags,
            None,  # JLPT level (not in jmdict-simplified, can be added separately)
            is_common,
        ))

        if len(batch) >= 5000:
            cursor.executemany(
                "INSERT INTO entries (kanji_element, reading_element, base_form, "
                "sense_glosses_en, pos_tags, jlpt_level, is_common) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                batch,
            )
            batch.clear()
            print(f"  ... {i + 1}/{len(words)}")

    # Insert remaining
    if batch:
        cursor.executemany(
            "INSERT INTO entries (kanji_element, reading_element, base_form, "
            "sense_glosses_en, pos_tags, jlpt_level, is_common) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            batch,
        )

    # Create indexes for fast lookups
    print("Creating indexes...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanji ON entries(kanji_element)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reading ON entries(reading_element)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_base_form ON entries(base_form)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_common ON entries(is_common)")

    conn.commit()

    # Stats
    cursor.execute("SELECT COUNT(*) FROM entries")
    count = cursor.fetchone()[0]
    print(f"Database ready: {count} entries in {db_path}")
    print(f"File size: {Path(db_path).stat().st_size / 1024 / 1024:.1f} MB")

    conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.json> <output.db>")
        sys.exit(1)

    build_database(sys.argv[1], sys.argv[2])
