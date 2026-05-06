#!/usr/bin/env python3
"""
KotobaFlow — Vietnamese Dictionary Builder
Downloads Yomitan Japanese-Vietnamese dictionary from GitHub and builds the SQLite database.
"""

import sys
import json
import sqlite3
import zipfile
import urllib.request
from pathlib import Path
from tempfile import NamedTemporaryFile

YOMITAN_DICT_URL = "https://raw.githubusercontent.com/yomitan-vi/tu-dien-nhat-viet-yomitan/main/tu-dien-nhat-viet-javidic.zip"

def build_vietnamese_table(db_path: str):
    """Download Yomitan zip and add to JMDict SQLite database."""
    db_file = Path(db_path)
    if not db_file.exists():
        print(f"Error: Database not found: {db_path}")
        print("Run scripts/setup.sh first to create the JMDict database.")
        sys.exit(1)

    conn = sqlite3.connect(db_file)
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vi_word ON meanings_vi(word)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vi_base ON meanings_vi(base_form)")
    cursor.execute("DELETE FROM meanings_vi")

    print(f"Downloading Yomitan dictionary from {YOMITAN_DICT_URL}...")
    
    with NamedTemporaryFile(suffix=".zip", delete=False) as temp_zip:
        urllib.request.urlretrieve(YOMITAN_DICT_URL, temp_zip.name)
        
        print("Extracting and parsing JSON banks...")
        count = 0
        with zipfile.ZipFile(temp_zip.name, 'r') as z:
            for filename in z.namelist():
                if filename.startswith("term_bank_") and filename.endswith(".json"):
                    with z.open(filename) as f:
                        term_bank = json.load(f)
                        for entry in term_bank:
                            # Yomichan term format: [term, reading, tags, rules, score, glossary, seq, termTags]
                            if len(entry) >= 6:
                                word = entry[0]
                                reading = entry[1]
                                glossary = entry[5]
                                
                                # glossary can be an array of strings
                                if isinstance(glossary, list):
                                    # Extract strings, sometimes it contains structured nodes
                                    meanings = []
                                    for item in glossary:
                                        if isinstance(item, str):
                                            meanings.append(item)
                                        elif isinstance(item, dict) and "content" in item:
                                            # handle structured content
                                            content = item.get("content", "")
                                            if isinstance(content, str):
                                                meanings.append(content)
                                            elif isinstance(content, list):
                                                meanings.extend([c for c in content if isinstance(c, str)])
                                    
                                    meaning_str = "; ".join(meanings)
                                else:
                                    meaning_str = str(glossary)
                                
                                if meaning_str:
                                    # Use word as both word and base_form for Yomichan data
                                    # Also insert the reading if it's different to aid lookups
                                    cursor.execute(
                                        "INSERT INTO meanings_vi (word, base_form, meaning) VALUES (?, ?, ?)",
                                        (word, word, meaning_str),
                                    )
                                    count += 1
                                    
                                    if reading and reading != word:
                                        cursor.execute(
                                            "INSERT INTO meanings_vi (word, base_form, meaning) VALUES (?, ?, ?)",
                                            (reading, word, meaning_str),
                                        )

    conn.commit()
    print(f"Vietnamese dictionary ready: {count} entries inserted.")
    
    # Cleanup
    Path(temp_zip.name).unlink(missing_ok=True)
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <jmdict.db>")
        sys.exit(1)
        
    build_vietnamese_table(sys.argv[1])
