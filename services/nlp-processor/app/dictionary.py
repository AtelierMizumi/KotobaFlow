"""
KotobaFlow — Dictionary Lookup
SQLite-based JMDict dictionary for Japanese word lookups.
Supports English and Vietnamese meanings.
"""

import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DictionaryLookup:
    """
    Japanese dictionary backed by JMDict SQLite database.
    Supports English (JMDict) and Vietnamese (JMDict-Vi community data).
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
                self._check_vietnamese_support()
                logger.info(f"JMDict database loaded: {self.db_path}")
            except Exception as e:
                logger.warning(f"Failed to open JMDict database: {e}")
        else:
            logger.warning(
                f"JMDict database not found at {self.db_path}. "
                "Dictionary lookups will return empty results. "
                "Run scripts/setup.sh to download and build the database."
            )

        self.has_vietnamese = False

    def _check_vietnamese_support(self):
        """Check if the Vietnamese meanings table exists."""
        if not self._conn:
            return
        try:
            cursor = self._conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='meanings_vi'"
            )
            self.has_vietnamese = cursor.fetchone() is not None
            if self.has_vietnamese:
                logger.info("Vietnamese dictionary support: enabled")
            else:
                logger.info(
                    "Vietnamese dictionary support: disabled "
                    "(run scripts/build_vi_dict.py to add Vietnamese meanings)"
                )
        except Exception:
            self.has_vietnamese = False

    def lookup(self, word: str, lang: str = "all") -> Optional[dict]:
        """
        Look up a word in the dictionary.
        Searches by exact match on kanji or reading.
        
        Args:
            word: Japanese word to look up
            lang: "en", "vi", or "all" (default)
        
        Returns:
            {
                "word": "天気",
                "readings": ["てんき"],
                "meanings_en": ["weather", "the elements", ...],
                "meanings_vi": ["thời tiết", ...],
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

            # De-inflection Fallbacks (if word ends with common inflections)
            if not result:
                result = self._try_deinflections(word)

            # Add Vietnamese meanings if available
            if result and lang in ("vi", "all") and self.has_vietnamese:
                # Use the matched dictionary word instead of the inflected input
                dict_word = result["word"]
                vi_meanings = self._query_vietnamese(dict_word)
                if not vi_meanings:
                    # Fallback to the original search word just in case
                    vi_meanings = self._query_vietnamese(word)
                result["meanings_vi"] = vi_meanings
            elif result:
                result["meanings_vi"] = []

            return result
        except Exception as e:
            logger.error(f"Dictionary lookup error for '{word}': {e}")
            return None

    def _try_deinflections(self, word: str) -> Optional[dict]:
        """Try common Japanese de-inflections to find the dictionary form."""
        if len(word) < 2:
            return None
            
        # Common suffixes to strip and their replacement to dictionary form
        # This is a basic 10ten-style fallback
        rules = [
            ("ます", "る"), ("ません", "る"), ("ました", "る"), 
            ("ない", "る"), ("なかった", "る"), ("れる", "る"), 
            ("られる", "る"), ("させる", "る"), ("させられる", "る"),
            ("たい", "る"), ("た", "る"), ("て", "る"),
            ("く", "い"), ("かっ", "い"), ("かった", "い"),
            ("な", "だ"), ("に", "だ"), ("で", "だ")
        ]
        
        for suffix, replacement in rules:
            if word.endswith(suffix):
                stem = word[:-len(suffix)]
                # Try replacing suffix with 'ru' or 'i' etc.
                candidate = stem + replacement
                res = self._query_by_kanji(candidate)
                if not res:
                    res = self._query_by_reading(candidate)
                if res:
                    return res
                    
                # Try just the stem for suru verbs (e.g. 勉強します -> 勉強)
                res = self._query_by_kanji(stem)
                if not res:
                    res = self._query_by_reading(stem)
                if res:
                    return res
                    
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

    def _query_vietnamese(self, word: str) -> list[str]:
        """Query Vietnamese meanings from the meanings_vi table."""
        if not self._conn:
            return []

        try:
            cursor = self._conn.execute(
                """
                SELECT meaning FROM meanings_vi
                WHERE word = ? OR base_form = ?
                """,
                (word, word),
            )
            rows = cursor.fetchall()
            return [row["meaning"] for row in rows if row["meaning"]]
        except Exception as e:
            logger.warning(f"Vietnamese lookup error for '{word}': {e}")
            return []

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        """Convert a database row to a dictionary result."""
        glosses = row["sense_glosses_en"] or ""
        pos = row["pos_tags"] or ""

        return {
            "word": row["kanji_element"] or row["reading_element"],
            "readings": [r.strip() for r in (row["reading_element"] or "").split(";") if r.strip()],
            "meanings_en": [m.strip() for m in glosses.split(";") if m.strip()],
            "meanings_vi": [],  # Populated by lookup() if available
            "pos_tags": [p.strip() for p in pos.split(";") if p.strip()],
            "jlpt_level": row["jlpt_level"],
            "common": bool(row["is_common"]),
        }

    def close(self):
        """Close the database connection."""
        if self._conn:
            self._conn.close()
