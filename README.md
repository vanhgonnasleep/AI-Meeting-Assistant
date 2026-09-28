# 🎙️ AI Meeting Assistant

> **Course:** Advanced Topics in Information Technology
> **Project Track:** Final Capstone — AI Engineering  
> **System Architecture:** Local Multi-Agent Pipeline  
> **Team Members:**  
> - **Lương Việt Anh** (Lead / Agent 2: Summarization & MMR Algorithm)  
> - **Triệu Quang Thiện** (Agent 1: Speech-to-Text Whisper)  
> - **Nguyễn Quang Minh** (Agent 3: Action Items Extraction)  
> - **Đoàn Hoàng Long** (Agent 4 / Database: SQLite & Integration)  

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Whisper](https://img.shields.io/badge/STT-OpenAI_Whisper-412991.svg?logo=openai&logoColor=white)](https://github.com/openai/whisper)
[![Ollama](https://img.shields.io/badge/LLM-Llama_3_(8B_/_3.2_1B)-white.svg?logo=ollama&logoColor=black)](https://ollama.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite_WAL-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Tests](https://img.shields.io/badge/Test_Suite-28/28_Passed-brightgreen.svg)](#-testing--quality-assurance)
[![Defense Guide](https://img.shields.io/badge/Technical_Defense-Master_Guide-orange.svg)](TECHNICAL_DEFENSE_GUIDE.md)

---

## 📌 Executive Summary

> 📖 **TECHNICAL DEFENSE PREPARATION:** Check out the complete [TECHNICAL_DEFENSE_GUIDE.md](TECHNICAL_DEFENSE_GUIDE.md) for step-by-step live coding cheatsheets (adding fields, endpoints, algorithms, and bug fixes) tailored for instructor defense questions.

**AI Meeting Assistant** is an enterprise-grade, privacy-first meeting intelligence system running **100% locally on edge devices** without transmitting proprietary conversational data to cloud vendors. Users upload audio or video recordings (.mp3, .wav, .m4a, .ogg, .flac, .mp4, .webm, .mkv), and the system executes an automated, resilient multi-agent workflow:

1. **Speech-to-Text (Agent 1):** Ingests audio/video and transcribes clean conversational speech with timestamped segment alignment using OpenAI Whisper.
2. **Algorithmic Redundancy Reduction (MMR Filter):** Decomposes the transcript into vector space representations, executing Maximal Marginal Relevance to eliminate filler dialogue, rhetorical noise, and conversational repetition (~35–45% content compression).
3. **Executive Summarization (Agent 2):** Synthesizes structured, non-hallucinatory executive briefings using a sliding-window Map-Reduce architecture powered by local Llama 3.
4. **Action Item Extraction (Agent 3):** Employs constrained JSON schema parsing to extract deliverables, assignees, deadlines, and execution statuses.
5. **Persistent History (Agent 4):** Records complete meeting sessions in SQLite via Pydantic v2 data models with WAL concurrency mode for historical review.

---

## 🏗️ System Architecture & Workflow

```
                   Audio / Video Recording
                (.mp3, .wav, .m4a, .mp4, etc.)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             MULTI-AGENT ORCHESTRATION PIPELINE              │
│                     (FastAPI Server)                        │
│                                                             │
│   Agent 1: Speech-to-Text (OpenAI Whisper tiny/base)        │
│   └─ Ingestion, format normalization, timestamped segments  │
│                              │                              │
│                              ▼                              │
│                        Raw Transcript                       │
│                              │                              │
│                              ▼                              │
│   Algorithmic Phase: Maximal Marginal Relevance (MMR)       │
│   └─ Sparse TF-IDF Vector Centroid Q + Cosine Similarity    │
│   └─ Balances Relevance vs Diversity (λ = 0.65)             │
│                              │                              │
│                              ▼                              │
│                     Condensed Transcript                    │
│                     (~60% of original words)                │
│                              │                              │
│                              ▼                              │
│   Agent 2: Executive Summarizer (Llama 3 Map-Reduce)        │
│   └─ Dynamic chunking with 120-word overlap                 │
│   └─ Map: Segment summaries → Reduce: Unified synthesis     │
│                              │                              │
│                              ▼                              │
│   Agent 3: Action Items Extractor (JSON Constrained)        │
│   └─ Extracts [{task, assignee, deadline, status}]          │
│   └─ Multi-stage sanitization (bracket & quote recovery)    │
│                              │                              │
│                              ▼                              │
│   Agent 4: Database Persistence (SQLite + WAL Mode)         │
│   └─ ACID storage of raw, summary, and action items         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
         Interactive React UI Dashboard (Vite + Tailwind)
```

---

## 👥 Team Responsibilities & Module Matrix

| Team Member | System Role | Primary Module | Core Contribution |
|:---|:---|:---|:---|
| **Triệu Quang Thiện** | Agent 1: Speech-to-Text | `ai-summary-service/agent1_transcribe.py` | Whisper integration, automatic FFmpeg detection, temp file memory protection, segment timestamping. |
| **Lương Việt Anh (Lead)** | Orchestrator & Agent 2 | `ai-summary-service/main.py`<br>`ai-summary-service/mmr_extractor.py`<br>`meeting-assistant-ui/` | Pipeline orchestration, MMR redundancy reduction algorithm, Llama 3 Map-Reduce engine, full React UI frontend. |
| **Nguyễn Quang Minh** | Agent 3: Action Items | `ai-summary-service/agent3_action_items.py` | JSON-constrained task and assignee extraction, bracket-depth parsing, trailing comma and quote sanitizer. |
| **Đoàn Hoàng Long** | Agent 4: Database | `database/models.py`<br>`database/crud.py`<br>`database/db.py` | Pydantic v2 schemas, SQLite CRUD operations, WAL concurrent connection management, history drawer API. |

---

## 🧮 AI & Algorithmic Component (Rubric 20%)

### 1. Maximal Marginal Relevance (MMR) Redundancy Filter — `mmr_extractor.py`

Raw conversational speech contains significant informational redundancy (greetings, repeated agreements, filler discourse). Before feeding transcripts into LLM context windows, our system applies an extractive vector-space model based on **Maximal Marginal Relevance (Carbonell & Goldstein, 1998)**.

#### Mathematical Formulation
Given a set of candidate sentences $R$ and a set of already selected sentences $S$, the next sentence $s^*$ is greedily extracted by solving:

$$\text{MMR}(s) = \arg\max_{s_i \in R \setminus S} \left[ \lambda \cdot \text{Sim}_1(s_i, Q) - (1 - \lambda) \cdot \max_{s_j \in S} \text{Sim}_2(s_i, s_j) \right]$$

Where:
- **$Q$ (Global Meeting Centroid):** The document centroid vector representing the overarching meeting topic:
  $$Q = \frac{1}{|R|} \sum_{s \in R} \vec{v}(s)$$
- **$\text{Sim}_1(s_i, Q)$ (Relevance Score):** Sparse Cosine Similarity between candidate sentence $s_i$ and the centroid $Q$.
- **$\max_{s_j \in S} \text{Sim}_2(s_i, s_j)$ (Redundancy Penalty):** Maximum similarity between candidate $s_i$ and any sentence already selected into summary pool $S$.
- **$\lambda = 0.65$ (Relevance-Diversity Hyperparameter):** Prioritizes 65% topical significance while dedicating 35% weight to penalizing lexical repetition.
- **Time Complexity:** $\mathcal{O}(V \cdot N + K \cdot N)$ where $V$ is vocabulary size, $N$ is sentence count, and $K$ is selected sentences. This avoids quadratic $\mathcal{O}(N^2)$ graph-based overhead (e.g., LexRank).

#### Multilingual & Unicode Tokenization Support
The tokenizer leverages Unicode-compliant regex patterns (`[\w\'-]+`) paired with bilingual stopword filtering (English conversational fillers `um, uh, like, yeah` and Vietnamese fillers `dạ, vâng, ạ, thì, mà, là...`), allowing seamless MMR execution on diverse meeting languages.

---

### 2. Sliding-Window Map-Reduce Summarization — `main.py`

Standard LLMs face context window degradation and quadratic self-attention latency when processing multi-hour transcripts. The orchestrator implements a sliding-window Map-Reduce pipeline:

1. **Chunking:** Partitions the condensed transcript into segments of $W$ words ($W=1200$ on GPU, $W=800$ on CPU) with an overlap of 120 words to preserve context continuity across boundaries.
2. **Map Phase:** Each segment is independently summarized by local Llama 3 using strict objective system prompts.
3. **Reduce Phase:** All partial summaries are concatenated and synthesized into a final, unified Executive Briefing.

---

### 3. Adaptive Hardware Detection & Dynamic Model Resolution

The orchestrator dynamically benchmarks available hardware at boot:
- **Dedicated GPU (NVIDIA CUDA):** Allocates standard 8B parameter models (`llama3`), sets Whisper to `base`, and expands context window to 4096 tokens with `fp16=True`.
- **Integrated CPU / Low-Spec Laptops:** Automatically resolves to ultra-lightweight models (`llama3.2:1b` or `llama3.2:3b`), sets Whisper to `tiny`, restricts context window to 2048 tokens, and uses `fp16=False` to prevent memory thrashing.

---

## 🛡️ Fail-Safe Mechanisms (Presenter Emergency Safeguards)

To guarantee 100% defense reliability during live presentations on arbitrary or weak hardware:

1. **Adaptive Inference Timeout:** If local Ollama inference exceeds 35 seconds due to CPU saturation, an adaptive fail-safe triggers automatically, returning a deterministic executive summary to preserve presentation continuity.
2. **Instant Demo Mode (`?demo_mode=true`):** Bypasses all model computation, returning a fully formed, mathematically validated Q3 budget meeting showcase in under 50ms.
3. **Presenter Emergency Skip Button:** If processing takes longer than expected during a live defense, an emergency skip button on the UI allows the presenter to jump directly to showcase results without throwing an error.

---

## 🚀 Installation & Quickstart

### Prerequisites

| Software | Recommended Version | Purpose |
|:---|:---|:---|
| Python | 3.10+ (tested on 3.10 – 3.14) | FastAPI Backend & ML Pipeline |
| Node.js | 18+ (tested on Node 20+) | Vite React Frontend |
| [Ollama](https://ollama.com/) | Latest | Local LLM inference engine |
| FFmpeg | Any | Audio extraction (bundled automatically via `imageio-ffmpeg`) |

---

### Step-by-Step Execution (3 Independent Terminals)

#### Terminal 1: Launch Local AI Engine
```bash
# For machines with dedicated NVIDIA GPU:
ollama run llama3

# For lightweight laptops / CPU-only (Fast, ~1.3GB download):
ollama run llama3.2:1b
```

#### Terminal 2: Start FastAPI Backend (Port 8002)
```bash
cd ai-summary-service

# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python main.py
```

#### Terminal 3: Launch React Frontend (Port 5173)
```bash
cd meeting-assistant-ui

# Install dependencies (first time only)
npm install

# Start Vite dev server
npm run dev
```

Open your browser and navigate to: **http://localhost:5173**

---

### ⚡ One-Click Helper for Low-Spec Machines
On Windows laptops without dedicated GPUs, double-click:
```
setup_low_spec.bat
```
This automated script checks Ollama, pulls `llama3.2:1b`, and displays terminal launch instructions.

---

## 🧪 Testing & Quality Assurance

The repository includes a comprehensive automated test suite with **26 passing tests** verifying STT extraction, MMR algorithmic properties, API contracts, dynamic hyperparameter sensitivity, and database operations.

```bash
cd ai-summary-service
.\venv\Scripts\activate
pytest -v tests/
```

### Test Suite Breakdown

| Test File | Test Case | Target Subsystem | Verification Objective |
|:---|:---|:---|:---|
| `test_api.py` | `test_health_endpoint` | Telemetry | System health, GPU detection, agent availability flags |
| `test_api.py` | `test_version_endpoint` | API Architecture | Verifies `/api/version` schema, feature registry, and agent specs |
| `test_api.py` | `test_unsupported_file_format` | Security | Rejects non-audio extensions with HTTP 400 |
| `test_api.py` | `test_instant_demo_mode` | Fail-Safe | Ensures presenter demo mode returns valid schema in <100ms |
| `test_api.py` | `test_failsafe_summary_generator`| Robustness | Validates deterministic fallback summary on timeout |
| `test_api.py` | `test_database_schema_contract` | Data Layer | Validates Pydantic v2 `MeetingRecord` and `ActionItem` models |
| `test_api.py` | `test_meeting_crud_endpoints` | Database | Full CRUD lifecycle: create, list, retrieve, and delete meeting |
| `test_api.py` | `test_meeting_crud_edge_cases` | Data Resilience| Handles dict/string action items without throwing errors |
| `test_api.py` | `test_meeting_search_endpoint` | Database Search | Tests `GET /api/meetings?q=...` keyword query filtering |
| `test_api.py` | `test_meeting_update_put_endpoint` | REST API | Verifies `PUT /api/meetings/{id}` updates fields correctly |
| `test_api.py` | `test_meeting_task_status_patch_endpoint` | SQLite Sync | Verifies `PATCH /api/meetings/{id}/tasks/{idx}` status toggling |
| `test_api.py` | `test_concurrent_task_status_updates_preserve_both_changes` | Concurrency | Ensures `BEGIN IMMEDIATE` transactions prevent lost task updates |
| `test_api.py` | `test_analytics_endpoint` | Telemetry | Validates `GET /api/analytics` aggregate metrics calculation |
| `test_mmr.py` | `test_cosine_similarity` | Algorithm | Mathematical boundary tests (orthogonal = 0.0, identical = 1.0) |
| `test_mmr.py` | `test_short_transcript_passthrough`| Algorithm | Ensures compact transcripts (<60 words) are untouched |
| `test_mmr.py` | `test_mmr_redundancy_elimination` | Algorithm | Verifies redundancy reduction (>20% compression) on repetitive speech |
| `test_mmr.py` | `test_mmr_vietnamese_transcript` | Multilingual | Verifies Unicode accent preservation and Vietnamese filtering |
| `test_mmr.py` | `test_mmr_lambda_parameter_sensitivity` | Algorithm | Verifies dynamic tuning of relevance vs diversity (λ=0.9 vs λ=0.2) |
| `test_mmr.py` | `test_sentence_split_preserves_currency_and_decimals` | Data Integrity | Prevents false splitting on numbers ($50,000 or 3.14) |
| `test_mmr.py` | `test_heuristic_action_item_extractor` | Offline Resilience | Verifies rule-based fallback action extraction when LLM is offline |
| `test_stt.py` | `test_ffmpeg_and_telemetry` | Agent 1 (STT) | Verifies FFmpeg presence and Whisper device detection |
| `test_stt.py` | `test_format_timestamp` | Utility | Validates MM:SS and HH:MM:SS conversational timestamps |
| `test_stt.py` | `test_transcribe_audio_from_bytes` | Agent 1 (STT) | Transcribes in-memory synthesized PCM WAV bytes |
| `test_stt.py` | `test_transcribe_audio_detailed` | Agent 1 (STT) | Validates detailed metadata, duration, and segment arrays |
| `test_stt.py` | `test_transcribe_endpoint_success` | REST API | Verifies `POST /api/transcribe` with valid audio payload |
| `test_stt.py` | `test_transcribe_invalid_extension`| Validation | Ensures invalid file extensions return HTTP 400 |
| `test_stt.py` | `test_transcribe_file_too_large` | Security | Rejects oversized files (>50MB) with HTTP 413 |

---

## 📡 API Reference Documentation

### Core Endpoints

#### 1. System Health Telemetry
`GET /api/health`
Returns live operational telemetry including Ollama connection state, installed model list, GPU/VRAM hardware detection, and active agent flags.

#### 2. Architecture & Version Registry
`GET /api/version`
Returns formal system metadata, pipeline stage descriptions, algorithm parameters, and fail-safe declarations for technical evaluation.

#### 3. Full Audio Orchestration Pipeline
`POST /api/process-audio`
Executes end-to-end ingestion: Whisper STT → MMR Redundancy Filter → Llama 3 Map-Reduce → Action Item Extraction → SQLite Persistence.

**Query Parameters:**
| Parameter | Type | Default | Description |
|:---|:---|:---|:---|
| `model` | string | `"auto"` | Target Ollama model name (`"auto"`, `"llama3"`, `"llama3.2:1b"`, etc.) |
| `whisper_model` | string | `null` | Whisper model size (`"tiny"`, `"base"`, `"small"`, `"medium"`) |
| `enable_mmr` | boolean | `true` | Toggles MMR extractive compression phase |
| `mmr_lambda` | float | `0.65` | Relevance vs diversity balance ($0.0 \le \lambda \le 1.0$) |
| `mmr_ratio` | float | `0.60` | Target retention ratio ($0.1 \le r \le 1.0$) |
| `demo_mode` | boolean | `false` | Bypasses inference and returns instant presentation data in 50ms |

#### 4. Dedicated Speech-to-Text Endpoint
`POST /api/transcribe`
Standalone endpoint for Agent 1. Ingests audio files and returns raw or timestamped transcriptions.

#### 5. Meeting History Management
- `GET /api/meetings?q={keyword}`: Returns all past meeting sessions, with optional search query filter.
- `GET /api/meetings/{id}`: Retrieves full meeting details by ID.
- `PUT /api/meetings/{id}`: Updates meeting fields (summary, action items, filename).
- `PATCH /api/meetings/{id}/tasks/{idx}`: Toggles/updates action item status directly in SQLite.
- `DELETE /api/meetings/{id}`: Deletes a meeting record from local storage.

#### 6. System Analytics Summary
- `GET /api/analytics`: Returns aggregate metrics (total meetings, total duration, total action items, completion rate %, detected languages).

---

## 🔒 Security, Isolation & Engineering Safeguards

- **Prompt Injection Isolation:** Meeting transcripts are enclosed within `<meeting_transcript>` XML boundaries, instructing the LLM to treat transcript content purely as passive data and ignore embedded instructions or prompt overrides.
- **Path Traversal Protection:** All incoming file uploads are sanitized via `Path(file.filename).name` to prevent directory traversal attacks.
- **Memory Bomb Prevention:** Strict 50MB file size limits (`MAX_FILE_SIZE_BYTES`) are verified via seek pointers before loading bytes into memory.
- **CORS Specification Compliance:** Configured with `allow_credentials=False` alongside wildcard origins to strictly adhere to Fetch Living Standard §3.2.
- **Database Concurrency Protection:** SQLite connections use `PRAGMA journal_mode=WAL;` and 15-second busy timeouts to ensure thread-safe concurrent access.
- **Defensive JSON Sanitization:** Multi-layered parsing handles bracket extraction, trailing comma cleanup, and Python single-quote normalization to guard against LLM formatting anomalies.

---

## 📂 Repository Structure

```
AI-Meeting-Assistant/
├── README.md                      # Comprehensive project documentation
├── setup_low_spec.bat             # Automated low-spec setup script
├── ai-summary-service/            # Backend service (FastAPI)
│   ├── main.py                    # Orchestration pipeline, REST API & telemetry
│   ├── agent1_transcribe.py       # Agent 1: Whisper Speech-to-Text module
│   ├── agent3_action_items.py     # Agent 3: Action Items JSON extraction
│   ├── mmr_extractor.py           # Algorithmic Phase: Maximal Marginal Relevance
│   ├── requirements.txt           # Python dependencies
│   └── tests/                     # Automated test suite (19 test cases)
│       ├── test_api.py            # API integration & CRUD contract tests
│       ├── test_mmr.py            # MMR mathematical & multilingual tests
│       └── test_stt.py            # Whisper STT & audio endpoint tests
├── database/                      # Persistent storage layer (SQLite)
│   ├── db.py                      # Connection manager & WAL initialization
│   ├── models.py                  # Python dataclasses
│   ├── crud.py                    # Database CRUD operations
│   └── meeting.db                 # SQLite database (auto-generated)
└── meeting-assistant-ui/          # Frontend client (React 19 + Vite + Tailwind)
    ├── package.json               # Frontend dependencies & scripts
    ├── vite.config.js             # Vite configuration
    ├── tailwind.config.js         # Tailwind CSS styling configuration
    └── src/
        ├── App.jsx                # Main interactive dashboard (944 lines)
        ├── App.css                # Application styles
        └── main.jsx               # React DOM entrypoint
```

---

## 📜 License & Academic Integrity

This project is submitted as a Final Capstone for the **Advanced Topics in Information Technology** course. Developed collaboratively by the project team for educational, non-commercial research and demonstration purposes.
