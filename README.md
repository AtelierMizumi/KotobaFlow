# KotobaFlow 言葉フロー

> Multimodal AI system for learning Japanese through video — powered by Docker.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  web-frontend   │────▶│ inference-worker │────▶│ nlp-processor  │
│  (Next.js)      │     │ (Faster-Whisper) │     │ (SudachiPy)    │
│  Port: 3000     │     │ Port: 8001       │     │ Port: 8002     │
└────────┬────────┘     └──────────────────┘     └───────┬────────┘
         │                                               │
         │              ┌──────────────────┐             │
         └─────────────▶│  media-handler   │             │
                        │  (yt-dlp+FFmpeg) │     ┌───────┴────────┐
                        │  Port: 8003      │     │  jmdict.db     │
                        └──────────────────┘     │  (SQLite)      │
                                                 └────────────────┘
```

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/your-user/KotobaFlow.git
cd KotobaFlow

# 2. Configure environment
cp .env.example .env

# 3. Run initial setup (downloads JMDict database)
chmod +x scripts/setup.sh
./scripts/setup.sh

# 4. Build and start all services
docker-compose up --build
```

Open http://localhost:3000 to access the web interface.

## Services

| Service | Port | Description |
|---------|------|-------------|
| `web-frontend` | 3000 | Next.js web application |
| `inference-worker` | 8001 | Faster-Whisper STT (Speech-to-Text) |
| `nlp-processor` | 8002 | SudachiPy tokenizer + JMDict dictionary |
| `media-handler` | 8003 | yt-dlp + FFmpeg audio extraction |

## Resource Requirements

- **RAM:** ~2GB (Whisper Medium INT8 uses ~1.5GB)
- **CPU:** 4+ cores recommended
- **Disk:** ~3GB (models + dictionary + cache)
- **Swap:** 2GB recommended on hosts with exactly 2GB RAM

## Development

```bash
# Start individual services for development
docker-compose up media-handler nlp-processor

# Run a service locally (outside Docker)
cd services/nlp-processor
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

## Tech Stack

- **Frontend:** Next.js 14 / React 18 / TypeScript
- **STT Engine:** Faster-Whisper (CTranslate2)
- **NLP:** SudachiPy + JMDict SQLite
- **Media:** yt-dlp + FFmpeg
- **Orchestration:** Docker Compose

## License

MIT
