# Media limits and long meetings

Uploads default to **256 MiB** (268,435,456 bytes). This is an admission limit, not a promise of fast processing or a measurement of available RAM. File size depends on codec and bitrate; duration, model size, CPU/GPU and diarization determine processing cost.

The backend reads these environment variables on startup:

| Variable | Default | Valid range |
|---|---:|---:|
| `MAX_UPLOAD_MB` | 256 MiB | Integer 1–1024 |
| `MAX_AUDIO_DURATION_SECONDS` | 10800 (3 hours) | Integer 60–21600 |
| `AUDIO_CHUNK_SECONDS` | 300 (5 minutes) | Integer 30–600 |

Restart the backend after changing them. Invalid values fail startup. The UI obtains upload and duration limits from `/api/health`, keeps its last valid limits when health is unavailable, and blocks a selected file if refreshed limits make it too large. The server remains authoritative.

For example, in PowerShell before starting the backend:

```powershell
$env:MAX_UPLOAD_MB = '256'
$env:MAX_AUDIO_DURATION_SECONDS = '10800'
$env:AUDIO_CHUNK_SECONDS = '300'
python main.py
```

For a weak machine, try a cached Whisper `tiny` model, a smaller available Ollama model, diarization off, and `AUDIO_CHUNK_SECONDS=120`. Lowering the upload limit alone does not make a compressed two-hour recording cheaper to infer.

FFmpeg decodes supported media to temporary mono 16 kHz, 16-bit PCM on disk. Decoding is capped at the duration limit plus one second to detect excessive recordings; these fail with HTTP 413 instead of being silently truncated. Decode timeout is 120 seconds. Playlist/reference demuxers are excluded, and network protocols are not accepted. Genuine MP3, WAV, M4A/MP4, OGG, FLAC and Matroska/WebM containers remain supported; raw AAC/AIFF/Wave64 are outside the supported list.

Whisper receives bounded float32 windows with three seconds of context on either side. Segment midpoint ownership avoids duplicating a boundary segment, and times/word times are translated onto the original recording timeline. This can change boundary wording; it is not an accuracy guarantee. Failed chunks do not return partial success. Speaker extraction reuses the PCM file; above 128 embeddings, clustering uses 128 sampled representatives, so rare speakers may merge.

Long-text summaries use bounded map inputs and hierarchical reduction. Noncompressing model output fails explicitly and uses the application's labeled transcript-excerpt fallback; generated context is not silently discarded.

Temporary PCM needs approximately 115.2 MB per hour (345.6 MB for three hours), in addition to the upload, model weights and other working data. Chunking bounds the audio array, not total process RAM or total inference time. There is still no background queue, server cancellation, authenticated multi-user hosting or representative long-meeting accuracy benchmark. Keep a single local backend worker.
