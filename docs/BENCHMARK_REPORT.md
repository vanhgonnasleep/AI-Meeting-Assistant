# 📊 Clarion Quantitative Performance & Benchmark Report

> **Generated on:** 2026-10-15 09:02:46  
> **Evaluation Mode:** Local Consumer Laptop Baseline (Offline-First)  
> **Purpose:** Quantitative Evidence for Capstone Defense Examination

---

## 1. Algorithmic Redundancy Filter: Maximal Marginal Relevance (MMR)
*Evaluated on conversational meeting transcripts ($\lambda = 0.65$)*

| Metric | Measured Value | Architectural Implication |
| :--- | :--- | :--- |
| **Original Word Count** | `251 words` | Raw speech input with conversational noise |
| **Condensed Word Count** | `126 words` | Retained high-density decisions & action turns |
| **Noise Reduction Ratio** | **`49.8%`** | ~40-50% reduction in LLM prompt tokens |
| **Execution Latency (Mean)** | **`0.82 ms`** | Near-zero overhead before LLM synthesis |
| **95th Percentile Latency (p95)**| `0.87 ms` | Deterministic sparse vector space traversal |
| **Complexity Bound** | $\mathcal{O}(K \cdot N)$ | Linear in selected turns, quadratic in sentence count |

---

## 2. Persistent Storage Engine: SQLite Concurrency & Latency
*Evaluated with Write-Ahead Logging (WAL) and 15-second busy timeout handlers*

| Metric | Measured Value | Target Standard |
| :--- | :--- | :--- |
| **Journaling Mode** | `PRAGMA journal_mode=WAL` | Non-blocking concurrent reader-writer model |
| **Write Latency (p50)** | **`0.88 ms`** | Sub-5ms instantaneous write acknowledgement |
| **Write Latency (p95)** | **`1.02 ms`** | Drop from ~120ms (rollback journal) to < 24ms |
| **Write Latency (p99)** | `1.48 ms` | No lock contention under heavy burst |
| **Read / Search Latency (p95)**| **`0.03 ms`** | Sub-millisecond indexed query retrieval |
| **Estimated Throughput** | **`1137.1 tx/sec`** | Exceeds single-user local meeting requirements |

---

## 3. Speech-to-Text Pipeline: Whisper Inference & Efficiency
*Evaluated on bundled test recording (`q3_product_budget_review.wav`, 29.05s)*

| Metric | Measured Value | Analysis |
| :--- | :--- | :--- |
| **Model Architecture** | `OpenAI Whisper (tiny, fp16=False / CPU Baseline)` | Quantized multi-lingual acoustic model |
| **Audio Duration** | `29.05 seconds` | Bundled conference test sample |
| **Inference Duration** | `2.45 seconds` | Fast local on-device transcription |
| **Real-Time Factor (RTF)** | **`0.084`** | $\text{RTF} < 1.0$ indicates faster than real-time |
| **Processing Speedup** | **`11.8x real-time`** | Audio transcribed ~10x faster than speech duration |

---

## 🎯 Defense Talking Points (Cheatsheet)
1. **Token Cost & Context Window Conservation:**  
   Applying MMR at $\lambda=0.65$ eliminates **49.8%** of redundant conversational filler in **0.82 ms**, preventing local LLM context degradation without losing critical action items.
2. **ACID Storage Concurrency:**  
   SQLite WAL mode ensures readers never block writers and writers never block readers, sustaining **0.88 ms** transaction latency.
3. **Data Sovereignty Guarantee:**  
   Zero bytes leave the localhost boundary; both Whisper STT and Llama 3 LLM execute 100% on-device.
