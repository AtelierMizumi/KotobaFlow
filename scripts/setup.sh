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
    # Get the latest release zip URL
    JMDICT_URL=$(curl -s https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest | grep browser_download_url | grep 'jmdict-eng-.*\.json\.zip' | head -n 1 | cut -d '"' -f 4)
    JMDICT_ZIP="$DATA_DIR/jmdict-eng.json.zip"
    JMDICT_JSON="$DATA_DIR/jmdict-eng-*.json"
    
    if [ -n "$JMDICT_URL" ]; then
        if command -v curl &> /dev/null; then
            curl -L -o "$JMDICT_ZIP" "$JMDICT_URL" 2>/dev/null || echo "  ⚠ Failed to download JMDict."
        elif command -v wget &> /dev/null; then
            wget -q -O "$JMDICT_ZIP" "$JMDICT_URL" || echo "  ⚠ Failed to download JMDict."
        fi
        
        if [ -f "$JMDICT_ZIP" ]; then
            echo "  → Decompressing..."
            unzip -o "$JMDICT_ZIP" -d "$DATA_DIR" >/dev/null
            
            # Find the extracted JSON file
            ACTUAL_JSON=$(ls $DATA_DIR/jmdict-eng-*.json | head -n 1)
            
            if [ -n "$ACTUAL_JSON" ]; then
                echo "  → Building SQLite database..."
                python3 "$SCRIPT_DIR/build_jmdict_db.py" "$ACTUAL_JSON" "$JMDICT_DB"
                
                # Run the Vietnamese dictionary builder
                python3 "$SCRIPT_DIR/build_vi_dict.py" "$JMDICT_DB"
                
                # Cleanup
                rm -f "$ACTUAL_JSON" "$JMDICT_ZIP"
                echo "  ✓ JMDict database ready: $JMDICT_DB"
            fi
        fi
    else
        echo "  ⚠ Could not find JMDict release URL."
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
