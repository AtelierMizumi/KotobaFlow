#!/bin/bash
# =============================================================================
# KotobaFlow — Setup Script
# Downloads required data files and models.
# Run this ONCE before starting docker-compose.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
MODELS_DIR="$DATA_DIR/models"

echo "============================================="
echo "  KotobaFlow — Initial Setup"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# 1. Create directories
# ---------------------------------------------------------------------------
echo "[1/3] Creating directories..."
mkdir -p "$DATA_DIR"
mkdir -p "$MODELS_DIR"
mkdir -p "$PROJECT_DIR/media-cache"
echo "  ✓ Directories created"

# ---------------------------------------------------------------------------
# 2. Download JMDict and build SQLite database
# ---------------------------------------------------------------------------
JMDICT_DB="$DATA_DIR/jmdict.db"

if [ -f "$JMDICT_DB" ]; then
    echo "[2/3] JMDict database already exists. Skipping download."
else
    echo "[2/3] Setting up JMDict database..."
    echo "  → Downloading JMDict simplified JSON..."
    
    # Download jmdict-simplified (community-maintained, pre-processed)
    JMDICT_URL="https://github.com/scriptin/jmdict-simplified/releases/latest/download/jmdict-eng-3.5.0.json.gz"
    JMDICT_JSON="$DATA_DIR/jmdict-eng.json"
    
    if command -v curl &> /dev/null; then
        curl -L -o "$DATA_DIR/jmdict-eng.json.gz" "$JMDICT_URL" 2>/dev/null || {
            echo "  ⚠ Failed to download JMDict. You can set it up manually later."
            echo "    The NLP processor will work without it (no dictionary lookups)."
        }
    elif command -v wget &> /dev/null; then
        wget -q -O "$DATA_DIR/jmdict-eng.json.gz" "$JMDICT_URL" || {
            echo "  ⚠ Failed to download JMDict."
        }
    fi
    
    if [ -f "$DATA_DIR/jmdict-eng.json.gz" ]; then
        echo "  → Decompressing..."
        gunzip -f "$DATA_DIR/jmdict-eng.json.gz"
        
        echo "  → Building SQLite database..."
        python3 "$SCRIPT_DIR/build_jmdict_db.py" "$JMDICT_JSON" "$JMDICT_DB"
        
        # Cleanup
        rm -f "$JMDICT_JSON"
        echo "  ✓ JMDict database ready: $JMDICT_DB"
    fi
fi

# ---------------------------------------------------------------------------
# 3. Pre-download Whisper model (optional, Docker will also download on first run)
# ---------------------------------------------------------------------------
echo "[3/3] Whisper model will be downloaded automatically on first container start."
echo "  Model: ${WHISPER_MODEL:-medium}"
echo "  Cache: Docker volume 'whisper-models'"

echo ""
echo "============================================="
echo "  Setup complete! Run:"
echo "  cp .env.example .env"
echo "  docker-compose up --build"
echo "============================================="
