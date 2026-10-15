# Clarion performance measurements

Generated: 2026-10-15 09:49:29 +0700
Python: 3.14.7; platform: win32; SQLite: 3.50.4.
These measurements describe this machine and these fixtures only.

## MMR extraction

One synthetic transcript, 50 timed iterations after warmup,
lambda 0.65 and target sentence ratio 0.55.

| Metric | Measured value |
| --- | --- |
| Original words | 251 |
| Condensed words | 126 |
| Word-count reduction | 49.8% |
| Mean latency | 0.78 ms |
| p95 latency | 0.85 ms |

Word reduction does not measure token savings, information retention or summary accuracy.
Selection performs O(K * N) sparse cosine comparisons; K proportional to N is quadratic.

## SQLite WAL

100 sequential committed inserts, followed by 100 reads, on one connection to an isolated
temporary database. WAL and a 15-second busy timeout are configured. Concurrent workload,
lock contention and comparison with rollback journaling were not measured.

| Metric | Measured value |
| --- | --- |
| Write p50 | 1.12 ms |
| Write p95 | 1.79 ms |
| Write p99 | 2.27 ms |
| Read p95 | 0.05 ms |
| Sequential writes per second (100 / total write time) | 780.6 |

## Whisper transcription

Measured in this run.

Recording: q3_product_budget_review.wav. Model: OpenAI Whisper (tiny, fp16=False / CPU).
Inference time excludes model loading and audio decoding. The bundled FFmpeg decoder
prepares mono 16 kHz PCM; Whisper tiny runs on CPU with fp16 disabled.
A missing measurement has no substituted baseline.

| Metric | Value |
| --- | --- |
| Audio duration (seconds) | 29.05 |
| Inference duration (seconds) | 2.89 |
| Real-time factor (inference / audio duration) | 0.1 |
| Processing speed | 10.0x real-time |

This benchmark does not evaluate transcription accuracy, factual grounding, end-to-end
summary quality, network isolation or privacy compliance.
