"""
KotobaFlow — NLP Processor Service
Japanese text analysis: tokenization, furigana, POS tagging, dictionary lookup.
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from pydantic import BaseModel

from app.tokenizer import JapaneseTokenizer, has_kanji
from app.dictionary import DictionaryLookup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SUDACHI_DICT_TYPE = os.getenv("SUDACHI_DICT_TYPE", "small")
JMDICT_DB_PATH = os.getenv("JMDICT_DB_PATH", "/app/data/jmdict.db")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------
tokenizer: JapaneseTokenizer | None = None
dictionary: DictionaryLookup | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize tokenizer and dictionary on startup."""
    global tokenizer, dictionary
    logger.info("Initializing NLP processor...")
    tokenizer = JapaneseTokenizer(dict_type=SUDACHI_DICT_TYPE)
    dictionary = DictionaryLookup(db_path=JMDICT_DB_PATH)
    logger.info("NLP processor ready.")
    yield
    if dictionary:
        dictionary.close()
    logger.info("NLP processor shut down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="KotobaFlow NLP Processor",
    description="Japanese text analysis with SudachiPy + JMDict",
    version="0.1.0",
    lifespan=lifespan,
)



# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    text: str


class BatchAnalyzeRequest(BaseModel):
    sentences: list[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker."""
    return {
        "status": "healthy",
        "service": "nlp-processor",
        "tokenizer_ready": tokenizer is not None,
        "dictionary_available": dictionary.available if dictionary else False,
    }


@app.post("/api/analyze")
async def analyze_text(request: AnalyzeRequest):
    """
    Analyze a single Japanese sentence.
    Returns tokens with furigana, POS, and dictionary data.
    """
    if not tokenizer:
        raise HTTPException(status_code=503, detail="Tokenizer not initialized")

    result = tokenizer.analyze(request.text)

    # Enrich tokens with dictionary data and word grouping
    if dictionary and dictionary.available:
        merged_tokens = []
        skip_next = False
        
        for i in range(len(result["tokens"])):
            if skip_next:
                skip_next = False
                continue
                
            token = result["tokens"][i]
            
            # Check for word grouping with the next token
            if i + 1 < len(result["tokens"]):
                next_token = result["tokens"][i+1]
                compound_surface = token["surface"] + next_token["surface"]
                
                # Only attempt grouping if the compound has kanji or if they are both kana but long enough
                if has_kanji(compound_surface) or len(compound_surface) > 2:
                    dict_entry = dictionary.lookup(compound_surface)
                    if dict_entry:
                        # Group them!
                        token["surface"] = compound_surface
                        token["base_form"] = compound_surface
                        token["reading"] = token["reading"] + next_token["reading"]
                        token["reading_katakana"] = token["reading_katakana"] + next_token["reading_katakana"]
                        token["furigana_html"] = token["furigana_html"] + next_token["furigana_html"]
                        token["has_kanji"] = True
                        token["dictionary"] = dict_entry
                        merged_tokens.append(token)
                        skip_next = True
                        continue

            if token["has_kanji"] or len(token["surface"]) > 1:
                dict_entry = dictionary.lookup(token["base_form"])
                if not dict_entry:
                    dict_entry = dictionary.lookup(token["surface"])
                if dict_entry:
                    token["dictionary"] = dict_entry
                    
            merged_tokens.append(token)
            
        result["tokens"] = merged_tokens

    return result


@app.post("/api/batch-analyze")
async def batch_analyze(request: BatchAnalyzeRequest):
    """
    Analyze multiple sentences at once.
    Used by inference-worker to enrich all segments in one call.
    """
    if not tokenizer:
        raise HTTPException(status_code=503, detail="Tokenizer not initialized")

    results = []
    for sentence in request.sentences:
        analysis = tokenizer.analyze(sentence)

        # Enrich with dictionary and word grouping
        if dictionary and dictionary.available:
            merged_tokens = []
            skip_next = False
            
            for i in range(len(analysis["tokens"])):
                if skip_next:
                    skip_next = False
                    continue
                    
                token = analysis["tokens"][i]
                
                if i + 1 < len(analysis["tokens"]):
                    next_token = analysis["tokens"][i+1]
                    compound_surface = token["surface"] + next_token["surface"]
                    
                    if has_kanji(compound_surface) or len(compound_surface) > 2:
                        dict_entry = dictionary.lookup(compound_surface)
                        if dict_entry:
                            token["surface"] = compound_surface
                            token["base_form"] = compound_surface
                            token["reading"] = token["reading"] + next_token["reading"]
                            token["reading_katakana"] = token["reading_katakana"] + next_token["reading_katakana"]
                            token["furigana_html"] = token["furigana_html"] + next_token["furigana_html"]
                            token["has_kanji"] = True
                            token["dictionary"] = dict_entry
                            merged_tokens.append(token)
                            skip_next = True
                            continue

                if token["has_kanji"] or len(token["surface"]) > 1:
                    dict_entry = dictionary.lookup(token["base_form"])
                    if not dict_entry:
                        dict_entry = dictionary.lookup(token["surface"])
                    if dict_entry:
                        token["dictionary"] = dict_entry
                        
                merged_tokens.append(token)
                
            analysis["tokens"] = merged_tokens

        results.append(analysis)

    return {"results": results}


@app.get("/api/lookup/{word}")
async def lookup_word(word: str):
    """
    Look up a word in the JMDict dictionary.
    Also runs tokenization to provide reading and POS.
    """
    if not tokenizer:
        raise HTTPException(status_code=503, detail="Tokenizer not initialized")

    # Tokenize to get reading
    tokens = tokenizer.tokenize(word)

    response = {
        "word": word,
        "tokenization": [t.to_dict() for t in tokens],
    }

    # Dictionary lookup
    if dictionary and dictionary.available:
        dict_entry = dictionary.lookup(word)
        if not dict_entry and tokens:
            # Try base form
            dict_entry = dictionary.lookup(tokens[0].base_form)
        response["dictionary"] = dict_entry

    return response


@app.get("/api/jmdict-export")
async def export_jmdict():
    """
    Export the entire JMDict database as JSON for client-side IndexedDB.

    The frontend calls this ONCE on first load, stores in IndexedDB,
    and then all subsequent dictionary lookups are instant and offline
    (10ten Japanese Reader architecture).

    Returns:
        { "entries": [...], "count": N, "version": "..." }
    """
    if not dictionary or not dictionary.available:
        raise HTTPException(
            status_code=503,
            detail="Dictionary not available. Run scripts/setup.sh first."
        )

    import sqlite3
    import json
    from fastapi.responses import StreamingResponse

    db_path = str(dictionary.db_path)

    def generate():
        """Stream JSON entries to avoid loading everything into RAM."""
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        yield '{"entries":['

        cursor = conn.execute(
            """
            SELECT kanji_element, reading_element, base_form,
                   sense_glosses_en, pos_tags, jlpt_level, is_common
            FROM entries
            ORDER BY rowid
            """
        )

        first = True
        for row in cursor:
            kanji = row["kanji_element"] or ""
            readings_raw = row["reading_element"] or ""
            glosses = row["sense_glosses_en"] or ""
            pos = row["pos_tags"] or ""

            # Try to get Vietnamese meanings
            vi_cursor = conn.execute(
                "SELECT meaning FROM meanings_vi WHERE word = ? OR base_form = ? LIMIT 5",
                (kanji or readings_raw.split(";")[0], row["base_form"] or ""),
            ) if _vi_table_exists(conn) else None
            vi_meanings = [r[0] for r in vi_cursor] if vi_cursor else []

            entry = {
                "kanji": [k.strip() for k in kanji.split(";") if k.strip()] if kanji else [],
                "readings": [r.strip() for r in readings_raw.split(";") if r.strip()],
                "base_form": row["base_form"] or readings_raw.split(";")[0],
                "meanings_en": [m.strip() for m in glosses.split(";") if m.strip()][:6],
                "meanings_vi": vi_meanings,
                "pos_tags": [p.strip() for p in pos.split(";") if p.strip()],
                "jlpt_level": row["jlpt_level"],
                "common": bool(row["is_common"]),
            }

            if not first:
                yield ","
            yield json.dumps(entry, ensure_ascii=False)
            first = False

        # Get count
        count_row = conn.execute("SELECT COUNT(*) FROM entries").fetchone()
        count = count_row[0] if count_row else 0
        conn.close()

        yield f'],"count":{count}}}'

    return StreamingResponse(
        generate(),
        media_type="application/json",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache 24h
            "Content-Disposition": "inline",
        },
    )


def _vi_table_exists(conn: "sqlite3.Connection") -> bool:
    """Check if the Vietnamese meanings table exists."""
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='meanings_vi'"
        ).fetchone()
        return row is not None
    except Exception:
        return False
