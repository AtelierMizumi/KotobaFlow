"""
KotobaFlow — Dictionary Lookup
SQLite-based JMDict dictionary for Japanese word lookups.
"""

import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DictionaryLookup:
    """
    Japanese dictionary backed by JMDict SQLite database.
    Falls back gracefully if the database is not available.
    """

    def __init__(self, db_path: str = "/app/data/jmdict.db"):
        self.db_path = Path(db_path)
        self.available = False
        self._conn: Optional[sqlite3.Connection] = None

        if self.db_path.exists():
            try:
                self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
                self._conn.row_factory = sqlite3.Row
                self.available = True
                logger.info(f"JMDict database loaded: {self.db_path}")
            except Exception as e:
                logger.warning(f"Failed to open JMDict database: {e}")
        else:
            logger.warning(
                f"JMDict database not found at {self.db_path}. "
                "Dictionary lookups will return empty results. "
                "Run scripts/setup.sh to download and build the database."
            )

    def lookup(self, word: str) -> Optional[dict]:
        """
        Look up a word in the dictionary.
        Searches by exact match on kanji or reading.
        
        Returns:
            {
                "word": "天気",
                "readings": ["てんき"],
                "meanings_en": ["weather", "the elements", ...],
                "pos_tags": ["noun"],
                "jlpt_level": "N5",
                "common": True
            }
        """
        if not self.available:
            return None

        try:
            # Try kanji match first, then reading match
            result = self._query_by_kanji(word)
            if not result:
                result = self._query_by_reading(word)
            return result
        except Exception as e:
            logger.error(f"Dictionary lookup error for '{word}': {e}")
            return None

    def _query_by_kanji(self, kanji: str) -> Optional[dict]:
        """Query by kanji element."""
        if not self._conn:
            return None

        cursor = self._conn.execute(
            """
            SELECT e.id, e.kanji_element, e.reading_element, 
                   e.sense_glosses_en, e.pos_tags, e.jlpt_level, e.is_common
            FROM entries e
            WHERE e.kanji_element = ? OR e.base_form = ?
            LIMIT 1
            """,
            (kanji, kanji),
        )
        row = cursor.fetchone()
        return self._row_to_dict(row) if row else None

    def _query_by_reading(self, reading: str) -> Optional[dict]:
        """Query by reading element (hiragana/katakana)."""
        if not self._conn:
            return None

        cursor = self._conn.execute(
            """
            SELECT e.id, e.kanji_element, e.reading_element, 
                   e.sense_glosses_en, e.pos_tags, e.jlpt_level, e.is_common
            FROM entries e
            WHERE e.reading_element = ?
            LIMIT 1
            """,
            (reading,),
        )
        row = cursor.fetchone()
        return self._row_to_dict(row) if row else None

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        """Convert a database row to a dictionary result."""
        glosses = row["sense_glosses_en"] or ""
        pos = row["pos_tags"] or ""

        return {
            "word": row["kanji_element"] or row["reading_element"],
            "readings": [r.strip() for r in (row["reading_element"] or "").split(";") if r.strip()],
            "meanings_en": [m.strip() for m in glosses.split(";") if m.strip()],
            "pos_tags": [p.strip() for p in pos.split(";") if p.strip()],
            "jlpt_level": row["jlpt_level"],
            "common": bool(row["is_common"]),
        }

    def close(self):
        """Close the database connection."""
        if self._conn:
            self._conn.close()
