# KotobaFlow 言葉フロー

> Multimodal AI system for learning Japanese through video — powered by Docker, Next.js, and Faster-Whisper.

## Architecture

```text
┌────────────────────────────────────────────────────────┐
│                      Client/Browser                    │
│ ┌─────────────────┐ ┌────────────────────────────────┐ │
│ │  web-frontend   │ │      Client-side Engine        │ │
│ │  (Next.js)      │ │ - JMDict IndexedDB             │ │
│ │  Port: 3000     │ │ - Rule-based De-inflection     │ │
│ └────────┬────────┘ └────────────────────────────────┘ │
└──────────│─────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│  api-gateway (NGINX Reverse Proxy - Port: 8000)        │
└────┬────────────────────────┬─────────────────────┬────┘
     │                        │                     │
     ▼                        ▼                     ▼
┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐
│ inference-worker │  │ nlp-processor  │  │  media-handler   │
│ (Faster-Whisper) │  │ (SudachiPy)    │  │  (yt-dlp+FFmpeg) │
│ Port: 8001       │  │ Port: 8002     │  │  Port: 8003      │
└──────────────────┘  └───────┬────────┘  └──────────────────┘
                              │
                      ┌───────┴────────┐
                      │  jmdict.db     │
                      │  (SQLite)      │
                      └────────────────┘
```

## Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/your-user/KotobaFlow.git
cd KotobaFlow

# Configure environment
cp .env.example .env
```

### 2. Build and Run (CPU Mode)
By default, the application runs on CPU. This is suitable if you don't have an NVIDIA GPU.

```bash
docker compose up -d --build
```

### 3. Build and Run (GPU Mode - Recommended)
If you have an NVIDIA GPU and `nvidia-container-toolkit` installed, you can leverage hardware acceleration for Faster-Whisper to transcribe videos up to 10x faster.

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

### 4. Access the Application
- **Web App:** Open `http://localhost:3000` in your browser.
- **API Gateway:** `http://localhost:8000` (Routes all API calls to the backend).

## Services

| Service | Port | Description |
|---------|------|-------------|
| `web-frontend` | 3000 | Next.js web application (React, Tailwind CSS, IndexedDB) |
| `api-gateway` | 8000 | NGINX API Gateway routing `/api/` traffic to internal services |
| `inference-worker` | 8001 | Faster-Whisper STT (Speech-to-Text) |
| `nlp-processor` | 8002 | SudachiPy tokenizer + JMDict backend dictionary |
| `media-handler` | 8003 | yt-dlp + FFmpeg audio extraction |

## Development

If you want to run the Next.js frontend locally outside of Docker for development:

```bash
cd services/web-frontend
npm install
npm run dev
```

## Tech Stack

- **Frontend:** Next.js 14 / React 18 / TypeScript / Tailwind CSS
- **Local Database:** IndexedDB (idb) for sub-millisecond dictionary lookups
- **API Gateway:** NGINX
- **STT Engine:** Faster-Whisper (CTranslate2) with GPU acceleration
- **NLP:** SudachiPy + SQLite
- **Media:** yt-dlp + FFmpeg
- **Orchestration:** Docker Compose

## License

MIT
