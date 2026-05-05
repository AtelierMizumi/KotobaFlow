"""
KotobaFlow — NLP Processor Service
Japanese text analysis: tokenization, furigana, POS tagging, dictionary lookup.
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.tokenizer import JapaneseTokenizer
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

    # Enrich tokens with dictionary data
    if dictionary and dictionary.available:
        for token in result["tokens"]:
            if token["has_kanji"]:
                dict_entry = dictionary.lookup(token["base_form"])
                if dict_entry:
                    token["dictionary"] = dict_entry

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

        # Enrich with dictionary
        if dictionary and dictionary.available:
            for token in analysis["tokens"]:
                if token["has_kanji"]:
                    dict_entry = dictionary.lookup(token["base_form"])
                    if dict_entry:
                        token["dictionary"] = dict_entry

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
