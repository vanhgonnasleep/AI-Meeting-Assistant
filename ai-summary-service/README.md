# ⚙️ AI Summary & Orchestration Service

> FastAPI microservice powering the **AI Meeting Assistant** pipeline: Whisper Speech-to-Text, Maximal Marginal Relevance (MMR) Redundancy Filter, Llama 3 Map-Reduce Summarizer, and Action Items Extractor.

---

## 🚀 Key Modules

- **`main.py`**: FastAPI orchestrator, CORS configuration, system telemetry (`/api/health`, `/api/version`), hardware benchmarking, and multi-agent pipeline orchestration (`POST /api/process-audio`).
- **`agent1_transcribe.py`**: Speech-to-Text extraction using OpenAI Whisper, automatic FFmpeg path resolution, and conversational timestamp alignment.
- **`mmr_extractor.py`**: Pure-Python sparse vector space implementation of the Maximal Marginal Relevance (MMR) redundancy reduction algorithm with Unicode & multilingual tokenization.
- **`agent3_action_items.py`**: Constrained JSON action item extractor with multi-tier bracket scanning, trailing comma elimination, and quote normalization.

---

## 🛠️ Setup & Execution

### Prerequisites
- Python 3.10+
- Virtual environment (`venv`)
- Local [Ollama](https://ollama.com/) running `llama3` or `llama3.2:1b`

### Launch Instructions
```bash
# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate   # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start API server on Port 8002
python main.py
```

---

## 🧪 Testing

Execute the comprehensive automated test suite (19 tests):
```bash
pytest -v tests/
```
