#!/usr/bin/env python3
"""
Clarion Engineering Benchmark & Evaluation Suite
Author: Clarion Engineering Team (Lead)

Measures quantitative system metrics for defense presentation:
  1. MMR Extractive Redundancy Filter (Compression, Word Reduction, Latency)
  2. Sequential SQLite WAL writes and reads (p50, p95, p99 latency)
  3. Whisper STT Inference Speed & Real-Time Factor (RTF)
  4. Generates formatted Markdown report for defense slides
"""

import sys
import time
import sqlite3
import tempfile
import statistics
from pathlib import Path

# Add paths
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "ai-summary-service"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(REPO_ROOT))

# Sample realistic transcript for algorithmic evaluation
SAMPLE_TRANSCRIPT = """
Good morning everyone, thanks for joining the Clarion architecture and engineering review.
Today we really need to dive deep into our streaming pipeline bottlenecks and figure out how to optimize latency.
Yeah, absolutely. I agree we need to look into this because the current latency is too high.
Um, as you know, under heavy payload bursts, buffering raw audio chunks in memory was causing GC spikes.
Right, exactly. We noticed that memory usage was jumping up to 400 megabytes during 5 concurrent meetings.
So what we did was refactor the chunk handler to stream direct binary frames over WebSocket with backpressure flow control.
That sounds great, I think that is the right direction for the streaming service.
On the storage side, switching SQLite to Write-Ahead Logging and setting the busy timeout to 15 seconds eliminated lock contention.
Yes, we tested multiple background tasks writing simultaneously and we observed zero database is locked errors.
With WAL enabled, our p95 write latency dropped from 120 milliseconds down to under 24 milliseconds across the test suite.
Let's make sure the migration script executes cleanly on legacy database instances without dropping existing tables.
The regression test suite is passing across all 216 test cases in the repository.
I will package the benchmark suite so Alex can test on Intel and Apple Silicon hardware by next Monday.
Agreed. Let's lock this in as our baseline architecture for the upcoming final defense demo.
Sounds good to me, let's wrap up today's meeting and sync again on Friday.
"""


def benchmark_mmr():
    print("[1/3] Benchmarking Maximal Marginal Relevance (MMR) Redundancy Filter...")
    from mmr_extractor import MMRExtractor

    extractor = MMRExtractor(lambda_param=0.65)
    
    # Warmup
    extractor.extract_key_sentences(SAMPLE_TRANSCRIPT, target_ratio=0.55)

    # Multi-iteration timing
    iterations = 50
    latencies = []
    reduction_percents = []
    original_words_count = 0
    filtered_words_count = 0

    for _ in range(iterations):
        t0 = time.perf_counter()
        filtered_text, telemetry = extractor.extract_key_sentences(
            SAMPLE_TRANSCRIPT,
            target_ratio=0.55,
            lambda_param=0.65
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        latencies.append(elapsed_ms)
        reduction_percents.append(telemetry.get("reduction_percent", 0.0))
        original_words_count = telemetry.get("original_words", 0)
        filtered_words_count = telemetry.get("filtered_words", 0)

    avg_latency = statistics.mean(latencies)
    p95_latency = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)
    avg_reduction = statistics.mean(reduction_percents)

    result = {
        "algorithm": "Maximal Marginal Relevance (MMR)",
        "lambda": 0.65,
        "original_words": original_words_count,
        "condensed_words": filtered_words_count,
        "noise_reduction_pct": round(avg_reduction, 1),
        "avg_latency_ms": round(avg_latency, 2),
        "p95_latency_ms": round(p95_latency, 2),
        "iterations": iterations
    }
    print(f"  * Noise Reduction: {result['noise_reduction_pct']}% (from {original_words_count} to {filtered_words_count} words)")
    print(f"  * Execution Latency: {result['avg_latency_ms']} ms (p95: {result['p95_latency_ms']} ms)")
    return result


def benchmark_sqlite_wal():
    print("\n[2/3] Benchmarking sequential SQLite WAL writes and reads...")
    
    # Create isolated temp database
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "bench.db"
        conn = sqlite3.connect(db_path, timeout=15.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=15000;")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bench_meetings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                summary TEXT,
                payload TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bench_created ON bench_meetings(created_at DESC)")
        conn.commit()

        # Measure 100 sequential write transactions
        write_latencies = []
        for i in range(100):
            t0 = time.perf_counter()
            conn.execute(
                "INSERT INTO bench_meetings (title, summary, payload) VALUES (?, ?, ?)",
                (f"Meeting {i}", "Executive summary text content for benchmarking", "JSON payload metadata " * 10)
            )
            conn.commit()
            write_latencies.append((time.perf_counter() - t0) * 1000.0)

        # Measure 100 search / read queries
        read_latencies = []
        for i in range(100):
            t0 = time.perf_counter()
            conn.execute("SELECT * FROM bench_meetings WHERE title LIKE ? ORDER BY created_at DESC LIMIT 10", (f"%{i % 10}%",)).fetchall()
            read_latencies.append((time.perf_counter() - t0) * 1000.0)

        conn.close()

    p50_write = statistics.median(write_latencies)
    p95_write = statistics.quantiles(write_latencies, n=20)[18]
    p99_write = statistics.quantiles(write_latencies, n=100)[98] if len(write_latencies) >= 100 else max(write_latencies)
    avg_read = statistics.mean(read_latencies)
    p95_read = statistics.quantiles(read_latencies, n=20)[18]

    result = {
        "engine": "SQLite 3 (WAL Mode + busy_timeout=15s)",
        "write_p50_ms": round(p50_write, 2),
        "write_p95_ms": round(p95_write, 2),
        "write_p99_ms": round(p99_write, 2),
        "read_avg_ms": round(avg_read, 2),
        "read_p95_ms": round(p95_read, 2),
        "write_tps": round(1000.0 / statistics.mean(write_latencies), 1)
    }
    print(f"  * Write Latency: p50={result['write_p50_ms']} ms | p95={result['write_p95_ms']} ms | p99={result['write_p99_ms']} ms")
    print(f"  * Read Latency: avg={result['read_avg_ms']} ms | p95={result['read_p95_ms']} ms")
    print(f"  * Sequential Write Throughput: {result['write_tps']} tx/sec")
    return result


def benchmark_whisper_rtf():
    print("\n[3/3] Benchmarking Speech-to-Text Pipeline (Whisper / Audio)...")
    sample_wav = REPO_ROOT / "meeting-assistant-ui" / "public" / "q3_product_budget_review.wav"
    
    audio_duration = None
    reason = "Bundled WAV recording is unavailable."
    
    # Check if whisper is loadable
    try:
        import whisper
        has_whisper = True
    except ImportError:
        has_whisper = False
        reason = "Whisper is not installed in the selected Python environment."

    if has_whisper and sample_wav.exists():
        try:
            print("  * Loading Whisper 'tiny' model...")
            t_load_0 = time.perf_counter()
            model = whisper.load_model("tiny", device="cpu")
            t_load = time.perf_counter() - t_load_0

            from audio_preparation import PreparedAudio
            with PreparedAudio(sample_wav, max_duration_seconds=120) as prepared:
                samples = prepared.read_samples(0, prepared.sample_count)
                audio_duration = prepared.duration
            print(f"  * Running transcription on {sample_wav.name} ({audio_duration}s)...")
            t_inf_0 = time.perf_counter()
            res = model.transcribe(samples, fp16=False)
            t_inf = time.perf_counter() - t_inf_0
            
            rtf = t_inf / audio_duration
            speedup = audio_duration / (t_inf or 1.0)
            words = len(res.get("text", "").split())

            result = {
                "status": "measured",
                "model": "OpenAI Whisper (tiny, fp16=False / CPU)",
                "audio_duration_s": audio_duration,
                "inference_time_s": round(t_inf, 2),
                "rtf": round(rtf, 3),
                "processing_speed": f"{round(speedup, 1)}x real-time",
                "words_transcribed": words,
                "model_load_time_s": round(t_load, 2)
            }
            print(f"  * Inference Time: {result['inference_time_s']}s for {audio_duration}s audio")
            print(f"  * Real-Time Factor (RTF): {result['rtf']} ({result['processing_speed']})")
            return result
        except Exception as e:
            reason = f"Whisper inference unavailable: {e}"
            print(f"  [!] Whisper inference skipped: {e}")

    result = {
        "status": "skipped",
        "reason": reason,
        "model": "OpenAI Whisper (tiny, fp16=False)",
        "audio_duration_s": audio_duration,
        "inference_time_s": None,
        "rtf": None,
        "processing_speed": None,
        "words_transcribed": None,
        "model_load_time_s": None,
    }
    print(f"  * Skipped (not measured): {reason}")
    return result


def generate_markdown_report(mmr_res, db_res, stt_res):
    report_path = REPO_ROOT / "docs" / "BENCHMARK_REPORT.md"
    stt_status = "Measured in this run." if stt_res["status"] == "measured" else f"Skipped; not measured: {stt_res['reason']}"
    def measured(key):
        value = stt_res.get(key)
        return "Not measured" if value is None else str(value)
    content = f"""# Clarion performance measurements

Generated: {time.strftime('%Y-%m-%d %H:%M:%S %z')}
Python: {sys.version.split()[0]}; platform: {sys.platform}; SQLite: {sqlite3.sqlite_version}.
These measurements describe this machine and these fixtures only.

## MMR extraction

One synthetic transcript, {mmr_res['iterations']} timed iterations after warmup,
lambda 0.65 and target sentence ratio 0.55.

| Metric | Measured value |
| --- | --- |
| Original words | {mmr_res['original_words']} |
| Condensed words | {mmr_res['condensed_words']} |
| Word-count reduction | {mmr_res['noise_reduction_pct']}% |
| Mean latency | {mmr_res['avg_latency_ms']} ms |
| p95 latency | {mmr_res['p95_latency_ms']} ms |

Word reduction does not measure token savings, information retention or summary accuracy.
Selection performs O(K * N) sparse cosine comparisons; K proportional to N is quadratic.

## SQLite WAL

100 sequential committed inserts, followed by 100 reads, on one connection to an isolated
temporary database. WAL and a 15-second busy timeout are configured. Concurrent workload,
lock contention and comparison with rollback journaling were not measured.

| Metric | Measured value |
| --- | --- |
| Write p50 | {db_res['write_p50_ms']} ms |
| Write p95 | {db_res['write_p95_ms']} ms |
| Write p99 | {db_res['write_p99_ms']} ms |
| Read p95 | {db_res['read_p95_ms']} ms |
| Sequential writes per second (100 / total write time) | {db_res['write_tps']} |

## Whisper transcription

{stt_status}

Recording: q3_product_budget_review.wav. Model: {stt_res['model']}.
Inference time excludes model loading and audio decoding. The bundled FFmpeg decoder
prepares mono 16 kHz PCM; Whisper tiny runs on CPU with fp16 disabled.
A missing measurement has no substituted baseline.

| Metric | Value |
| --- | --- |
| Audio duration (seconds) | {measured('audio_duration_s')} |
| Inference duration (seconds) | {measured('inference_time_s')} |
| Real-time factor (inference / audio duration) | {measured('rtf')} |
| Processing speed | {measured('processing_speed')} |

This benchmark does not evaluate transcription accuracy, factual grounding, end-to-end
summary quality, network isolation or privacy compliance.
"""
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\n[OK] Benchmark report successfully generated: {report_path}")
    return report_path


def main():
    print("=" * 65)
    print("      CLARION SYSTEM BENCHMARK & EVALUATION SUITE")
    print("=" * 65)
    t_start = time.perf_counter()

    mmr_res = benchmark_mmr()
    db_res = benchmark_sqlite_wal()
    stt_res = benchmark_whisper_rtf()

    report_file = generate_markdown_report(mmr_res, db_res, stt_res)

    total_time = round(time.perf_counter() - t_start, 2)
    print("=" * 65)
    print(f"BENCHMARK COMPLETED IN {total_time}s")
    print(f"Summary Report: {report_file}")
    print("=" * 65)


if __name__ == "__main__":
    main()
