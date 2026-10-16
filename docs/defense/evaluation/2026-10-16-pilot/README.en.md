# Clarion experimental pilot — 16 October 2026

This English companion explains the existing frozen run. It does not change the raw results or retroactively approve reference labels.

Run: `20261016T145301Z-b6f6da53e5`. Inference began at clean commit `cd8feba2b8ba58ae62772e82ea357af5836e2ee3`. Later reporting fixes added normalized text and complete coverage accounting. The original metadata, raw outputs and checksums remain in this directory.

## ASR results

| Model | Completed | CER | Whitespace-WER | RTF | Model load |
| --- | ---: | ---: | ---: | ---: | ---: |
| tiny | 20/20 | 903/2007 = 44.99% | 376/582 = 64.60% | 0.160 | 0.348 s |
| base | 20/20 | 424/2007 = 21.13% | 217/582 = 37.29% | 0.125 | 0.606 s |

Both models used the same first 20 recordings of `google/fleurs`, `vi_vn`, `test`, totaling 239.04 seconds. Normalization applies NFC, case folding, punctuation/whitespace handling and preserves Vietnamese diacritics and digits. CER omits whitespace; WER uses whitespace-delimited units. Corpus rates divide total edit errors by total reference units.

The environment recorded Python 3.14.7, Whisper 20250625 and Torch 2.14.0. ASR ran on CPU with CUDA unavailable. RTF includes decoding and transcription after model loading; there was no separate warm-up. One pass ran tiny before base, without order balancing or cache/thermal controls. The lower observed base RTF does not prove that base is generally faster.

Base had lower error rates on this pilot. This small read-speech sample does not establish performance on real meetings, noise, overlapping speakers, all Vietnamese accents, diarization or speaker identification.

## NLP ablation and unfinished scoring

Six project-authored synthetic transcripts were run with MMR off and on, producing 12 outputs. Eleven were complete; one was partial because action extraction used a heuristic fallback (`vi-no_tasks`, MMR on). All six enabled runs applied MMR, with lambda 0.65 and ratio 0.55.

The model was `llama3:latest`. Summary generation used the existing CPU-context configuration: 2048 context, temperature 0.2, top_p 0.9 and num_predict 1024. The LLM seed was not fixed. Ollama may offload independently of the ASR Torch device, so the ASR CPU label does not establish the LLM device.

The model sometimes produced tasks in cancellation/no-task cases. All reference approvals and human review sheets are unfinished. Both NLP variants are therefore `not_evaluated`: no task F1, owner/deadline accuracy or measured summarization benefit from MMR is reported. The whole run is `partial`, not 100% successful AI inference.

## Evidence and reuse

Open [report.html](report.html) offline and inspect [summary.json](summary.json), [rows.jsonl](rows.jsonl), [normalized.csv](normalized.csv), [manifest.jsonl](manifest.jsonl) and [checksums.json](checksums.json) together. The frozen audio is retained locally outside Git, not in the submitted source archive. Preparing it again requires the evaluation CLI and checksum comparison described in [evaluation/README.md](../../../../evaluation/README.md).

Source dataset: [Google FLEURS](https://huggingface.co/datasets/google/fleurs), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Original recordings/transcripts belong to that dataset; normalized transcripts and model outputs are derived artifacts. The original official Parquet shard and per-recording hashes are recorded in the manifests. The large dataset cache is excluded from Git and source packaging.
