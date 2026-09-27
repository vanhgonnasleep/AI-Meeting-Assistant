# 🎙️ AI Meeting Assistant

> **Khóa học:** Emerging Topics in Information Technology  
> **Loại dự án:** Final Project — AI Engineering  
> **Mô hình:** Multi-Agent Local AI System  
> **Nhóm:** 4 thành viên

---

## 📌 Tóm tắt dự án

**AI Meeting Assistant** là hệ thống tự động hóa ghi chép cuộc họp chạy hoàn toàn cục bộ (100% offline, không gửi dữ liệu lên cloud). Người dùng tải lên file âm thanh/video của cuộc họp, hệ thống sẽ tự động:

1. **Chuyển giọng nói thành văn bản** (Whisper STT)
2. **Lọc nội dung dư thừa** bằng thuật toán MMR (Maximal Marginal Relevance)
3. **Tóm tắt điều hành** theo kiến trúc Map-Reduce với Llama 3 cục bộ
4. **Trích xuất task & người phụ trách** (Action Items) tự động
5. **Lưu lịch sử cuộc họp** vào cơ sở dữ liệu SQLite

---

## 🏗️ Kiến trúc Hệ thống

```
Audio/Video File
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│              MULTI-AGENT PIPELINE (FastAPI)              │
│                                                          │
│  Agent 1 (Whisper STT)    →  Raw Transcript              │
│        │                                                 │
│  [MMR Algorithm Filter]   →  Condensed Transcript (~60%) │
│        │                                                 │
│  Agent 2 (Llama 3         →  Executive Summary           │
│           Map-Reduce)                                    │
│        │                                                 │
│  Agent 3 (Action Items)   →  [{task, assignee}]          │
│        │                                                 │
│  Agent 4 (SQLite CRUD)    →  Persistent Storage          │
└─────────────────────────────────────────────────────────┘
      │
      ▼
React Vite Frontend (Port 5173)
```

### Phân công thành viên

| Thành viên | Agent | Module | Vai trò |
|:---|:---|:---|:---|
| Thành viên 1 | Agent 1 | `agent1_transcribe.py` | Whisper STT — chuyển audio → text |
| **Thành viên 2 (Lead)** | Agent 2 + MMR | `main.py`, `mmr_extractor.py`, `meeting-assistant-ui/` | Orchestrator, Llama 3 Map-Reduce, Thuật toán MMR, React UI |
| Thành viên 3 | Agent 3 | `agent3_action_items.py` | Llama 3 Action Items extraction |
| Thành viên 4 | Agent 4 | `database/` | SQLite schema, CRUD, Meeting history |

---

## 🧮 Thành phần AI / Thuật toán (Rubric 20%)

### 1. Maximal Marginal Relevance (MMR) — `mmr_extractor.py`

Thuật toán trích xuất câu quan trọng từ transcript, cân bằng giữa **độ liên quan** và **tính đa dạng** (chống trùng lặp).

**Công thức:**
```
MMR(s) = argmax [ λ·Sim1(s, Q) - (1-λ)·max Sim2(s, sⱼ) ]
                                           sⱼ∈S
```
- **Q**: Vector centroid đại diện toàn bộ nội dung cuộc họp (TF-IDF)
- **Sim1**: Cosine Similarity — đo mức độ liên quan với chủ đề chính
- **Sim2**: Cosine Similarity — đo độ trùng lặp với các câu đã chọn
- **λ = 0.65**: Cân bằng giữa relevance (65%) và diversity (35%)

**Kết quả:** Nén transcript ~35–45%, loại bỏ filler words và câu trùng ý trước khi đưa vào Llama 3.

### 2. Map-Reduce Summarization — `main.py`

Xử lý cuộc họp dài (> 800 từ) bằng kỹ thuật sliding window:
- **Map**: Tóm tắt độc lập từng đoạn (chunk) 800 từ, overlap 120 từ
- **Reduce**: Tổng hợp các partial summaries thành Executive Summary thống nhất

### 3. Adaptive Hardware Resolution — `main.py`

- Tự động chọn mô hình Whisper (`tiny` trên CPU / `base` trên GPU)
- Tự động chọn Llama 3 model phù hợp với phần cứng hiện có
- Context window: 4096 tokens (GPU) / 2048 tokens (CPU)

---

## 🛠️ Cài đặt & Khởi động

### Yêu cầu

| Phần mềm | Phiên bản | Mục đích |
|:---|:---|:---|
| Python | 3.10+ | Backend FastAPI |
| Node.js | 18+ | React Frontend |
| [Ollama](https://ollama.com/) | Latest | Chạy Llama 3 cục bộ |
| ffmpeg | Any | Xử lý audio (tự cài qua `imageio-ffmpeg`) |

### Khởi động (3 Terminal song song)

**Terminal 1 — Khởi động Llama 3 (AI Engine):**
```bash
# Máy có GPU (≥8GB VRAM):
ollama run llama3

# Máy CPU / RAM ≤ 16GB:
ollama run llama3.2:1b
```

**Terminal 2 — Khởi động Backend (Port 8002):**
```bash
cd ai-summary-service
python -m venv venv            # Lần đầu
venv\Scripts\activate          # Windows
pip install -r requirements.txt  # Lần đầu
python main.py
```

**Terminal 3 — Khởi động Frontend (Port 5173):**
```bash
cd meeting-assistant-ui
npm install    # Lần đầu
npm run dev
```

Truy cập: **http://localhost:5173**

### Script nhanh cho máy yếu

```bash
# Windows — click đúp vào file:
setup_low_spec.bat
```

---

## 🧪 Chạy Test Suite

```bash
cd ai-summary-service
venv\Scripts\activate
pytest -v tests/
# Expected: 16 passed
```

**Các test coverage:**
- `test_api.py` (6 tests): Health check, file validation, demo mode, DB schema, CRUD
- `test_mmr.py` (3 tests): Cosine similarity, short transcript passthrough, redundancy elimination
- `test_stt.py` (7 tests): ffmpeg detection, timestamp format, transcription flows

---

## 🖥️ API Endpoints

| Method | Endpoint | Mô tả |
|:---|:---|:---|
| `GET` | `/api/health` | Trạng thái hệ thống, GPU, Ollama, tất cả agents |
| `GET` | `/api/version` | Phiên bản hệ thống và danh sách tính năng |
| `POST` | `/api/process-audio` | Pipeline chính: STT → MMR → Summary → Actions → DB |
| `POST` | `/api/transcribe` | Chỉ chuyển audio → text (Agent 1 độc lập) |
| `GET` | `/api/meetings` | Lấy toàn bộ lịch sử cuộc họp từ SQLite |
| `GET` | `/api/meetings/{id}` | Chi tiết một cuộc họp |
| `DELETE` | `/api/meetings/{id}` | Xóa một cuộc họp |

### Query Parameters cho `/api/process-audio`

| Tham số | Default | Mô tả |
|:---|:---|:---|
| `model` | `auto` | Model Ollama (`auto`, `llama3`, `llama3.2:1b`, ...) |
| `whisper_model` | `auto` | Whisper size (`tiny`, `base`, `small`, ...) |
| `enable_mmr` | `true` | Bật/tắt MMR redundancy filter |
| `demo_mode` | `false` | Kết quả tức thì, không cần AI (cho demo) |

---

## ⚡ Cơ chế Fail-Safe Demo (Khi thuyết trình)

Hệ thống có **3 lớp bảo vệ** khi demo trên máy yếu hoặc không có GPU:

1. **Adaptive Model Selection**: Tự động chọn `llama3.2:1b` (1.3GB, chạy trên CPU) nếu không có GPU
2. **Processing Timeout + Failsafe**: Nếu Ollama timeout (>35s), trả về kết quả mẫu được soạn sẵn thay vì crash
3. **Instant Demo Mode**: Nút "Skip → Instant Result ⏩" trên UI — trả về kết quả mẫu Q3 Budget Meeting trong 50ms, không cần bất kỳ inference nào

---

## 📁 Cấu trúc Repository

```
AI-Meeting-Assistant/
├── ai-summary-service/          # Backend FastAPI
│   ├── main.py                  # Orchestrator + API endpoints
│   ├── agent1_transcribe.py     # Whisper STT module
│   ├── agent3_action_items.py   # Llama 3 Action Items extractor
│   ├── mmr_extractor.py         # MMR Algorithmic Component
│   ├── requirements.txt
│   └── tests/
│       ├── test_api.py          # 6 integration tests
│       ├── test_mmr.py          # 3 MMR unit tests
│       └── test_stt.py          # 7 STT unit tests
├── database/                    # SQLite Layer
│   ├── models.py                # Pydantic v2 data models
│   ├── crud.py                  # CRUD operations
│   ├── db.py                    # Connection + schema init
│   └── __init__.py
├── meeting-assistant-ui/        # React + Vite Frontend
│   └── src/App.jsx              # Main UI (902 lines)
├── setup_low_spec.bat           # One-click low-spec setup
└── README.md
```

---

## 🔒 Bảo mật & Chất lượng Code

- **Prompt Injection Protection**: Transcript được wrap trong `<meeting_transcript>` tags, hướng dẫn LLM chỉ phân tích nội dung trong thẻ
- **Path Traversal Prevention**: `safe_filename = Path(file.filename).name` tại upload endpoint
- **File Size Validation**: Giới hạn 50MB trước khi đọc vào bộ nhớ
- **CORS**: Configured đúng spec (`allow_credentials=False` với wildcard origins)
- **Error Isolation**: Mỗi agent có `try/except` độc lập — lỗi 1 agent không làm crash cả pipeline