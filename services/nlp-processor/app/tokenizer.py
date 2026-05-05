"""
KotobaFlow — Japanese Tokenizer
Tokenizes Japanese text using SudachiPy and generates furigana.
"""

import logging
import re
from dataclasses import dataclass

from sudachipy import Dictionary, SplitMode

logger = logging.getLogger(__name__)

# Regex to detect if a string contains kanji
KANJI_PATTERN = re.compile(r'[\u4e00-\u9faf\u3400-\u4dbf]')

# Katakana to Hiragana offset
KATA_TO_HIRA_OFFSET = ord('ぁ') - ord('ァ')


def katakana_to_hiragana(text: str) -> str:
    """Convert Katakana to Hiragana."""
    result = []
    for ch in text:
        code = ord(ch)
        # Katakana range: ァ(0x30A1) to ヶ(0x30F6)
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code + KATA_TO_HIRA_OFFSET))
        else:
            result.append(ch)
    return ''.join(result)


def has_kanji(text: str) -> bool:
    """Check if text contains any kanji characters."""
    return bool(KANJI_PATTERN.search(text))


@dataclass
class TokenInfo:
    """Information about a single token."""
    surface: str           # Original text as it appears
    base_form: str         # Dictionary form
    reading: str           # Hiragana reading
    reading_katakana: str  # Katakana reading
    pos: str               # Part-of-speech (main category)
    pos_detail: str        # Detailed POS info
    has_kanji: bool        # Whether the surface contains kanji
    furigana_html: str     # HTML ruby annotation

    def to_dict(self) -> dict:
        return {
            "surface": self.surface,
            "base_form": self.base_form,
            "reading": self.reading,
            "reading_katakana": self.reading_katakana,
            "pos": self.pos,
            "pos_detail": self.pos_detail,
            "has_kanji": self.has_kanji,
            "furigana_html": self.furigana_html,
        }


class JapaneseTokenizer:
    """Tokenizes Japanese text and generates furigana annotations."""

    def __init__(self, dict_type: str = "small"):
        logger.info(f"Initializing SudachiPy with {dict_type} dictionary...")
        self.dictionary = Dictionary(dict_type=dict_type)
        self.tokenizer = self.dictionary.create()
        logger.info("SudachiPy tokenizer ready.")

    def tokenize(self, text: str) -> list[TokenInfo]:
        """
        Tokenize text using SplitMode.C (longest natural units).
        Returns a list of TokenInfo with furigana and POS.
        """
        morphemes = self.tokenizer.tokenize(text, SplitMode.C)
        tokens = []

        for m in morphemes:
            surface = m.surface()
            reading_kata = m.reading_form()
            reading_hira = katakana_to_hiragana(reading_kata)
            pos_list = m.part_of_speech()
            pos_main = pos_list[0] if pos_list else ""
            pos_detail = ",".join(pos_list[1:]) if len(pos_list) > 1 else ""

            contains_kanji = has_kanji(surface)

            # Generate furigana HTML
            if contains_kanji:
                furigana_html = f"<ruby>{surface}<rt>{reading_hira}</rt></ruby>"
            else:
                furigana_html = surface

            tokens.append(TokenInfo(
                surface=surface,
                base_form=m.dictionary_form(),
                reading=reading_hira,
                reading_katakana=reading_kata,
                pos=pos_main,
                pos_detail=pos_detail,
                has_kanji=contains_kanji,
                furigana_html=furigana_html,
            ))

        return tokens

    def analyze(self, text: str) -> dict:
        """
        Full analysis of a sentence.
        Returns tokens and the full furigana HTML.
        """
        tokens = self.tokenize(text)
        full_furigana = "".join(t.furigana_html for t in tokens)

        return {
            "sentence": text,
            "furigana_html": full_furigana,
            "tokens": [t.to_dict() for t in tokens],
        }
