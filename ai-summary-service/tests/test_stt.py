import io
import os
import sys
import wave
import struct
import math
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

SERVICE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = SERVICE_DIR.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from main import app
from agent1_transcribe import (
    transcribe_audio,
    transcribe_audio_detailed,
    get_whisper_model_info,
    get_whisper_device,
    format_timestamp,
    ensure_ffmpeg,
    extract_segment_embedding,
    cluster_speaker_embeddings,
    format_diarized_transcript,
    diarize_segments
)

try:
    import whisper
    import torch
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

client = TestClient(app)


def generate_test_wav_bytes(duration_sec: float = 0.5, freq: float = 440.0, sample_rate: int = 16000) -> bytes:
    """Generates an in-memory valid PCM WAV file for unit tests."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        total_samples = int(sample_rate * duration_sec)
        for i in range(total_samples):
            val = int(32767.0 * 0.2 * math.sin(2.0 * math.pi * freq * i / sample_rate))
            wf.writeframes(struct.pack('<h', val))
    return buf.getvalue()


def test_ffmpeg_and_telemetry():
    """Verify FFmpeg detection and Whisper model telemetry."""
    assert ensure_ffmpeg() is True
    info = get_whisper_model_info()
    assert info["engine"] == "OpenAI Whisper"
    assert "device" in info
    assert "cuda_available" in info
    assert "default_model" in info
    assert info["ffmpeg_available"] is True


def test_format_timestamp():
    """Verify timestamp formatting."""
    assert format_timestamp(5.2) == "00:05"
    assert format_timestamp(65.0) == "01:05"
    assert format_timestamp(3665.0) == "01:01:05"


@pytest.mark.skipif(not WHISPER_AVAILABLE, reason="OpenAI Whisper / PyTorch not installed")
def test_transcribe_audio_from_bytes():
    """Test transcribing directly from raw audio bytes using tiny model."""
    wav_bytes = generate_test_wav_bytes(duration_sec=0.3)
    transcript = transcribe_audio(wav_bytes, model_name="tiny")
    assert isinstance(transcript, str)


@pytest.mark.skipif(not WHISPER_AVAILABLE, reason="OpenAI Whisper / PyTorch not installed")
def test_transcribe_audio_detailed_from_temp_file():
    """Test detailed transcription metadata structure."""
    wav_bytes = generate_test_wav_bytes(duration_sec=0.3)
    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        temp_wav.write(wav_bytes)
        temp_wav.close()

        result = transcribe_audio_detailed(temp_wav.name, model_name="tiny")
        assert "text" in result
        assert "language" in result
        assert "segments" in result
        assert "duration" in result
    finally:
        if os.path.exists(temp_wav.name):
            os.remove(temp_wav.name)


@pytest.mark.skipif(not WHISPER_AVAILABLE, reason="OpenAI Whisper / PyTorch not installed")
def test_transcribe_endpoint_success():
    """Verify POST /api/transcribe processes audio upload and returns valid JSON."""
    wav_bytes = generate_test_wav_bytes(duration_sec=0.3)
    files = {"file": ("test_meeting.wav", wav_bytes, "audio/wav")}
    response = client.post("/api/transcribe?model=tiny", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["filename"] == "test_meeting.wav"
    assert "transcript" in data
    assert "segments" in data


def test_transcribe_endpoint_invalid_extension():
    """Verify POST /api/transcribe rejects non-audio file types."""
    files = {"file": ("document.pdf", b"%PDF-1.4...", "application/pdf")}
    response = client.post("/api/transcribe", files=files)
    assert response.status_code == 400
    assert "Only .mp3, .wav, .m4a" in response.json()["detail"]


def test_transcribe_endpoint_file_too_large():
    """Verify POST /api/transcribe rejects oversized audio files."""
    oversized_bytes = b"0" * (51 * 1024 * 1024)
    files = {"file": ("large_audio.wav", oversized_bytes, "audio/wav")}
    response = client.post("/api/transcribe", files=files)
    assert response.status_code == 413


@pytest.mark.skipif(not WHISPER_AVAILABLE, reason="OpenAI Whisper / PyTorch not installed")
def test_cluster_speaker_embeddings():
    """Verify acoustic feature clustering assigns distinct speakers accurately."""
    # Synthetic vector: v_spk1 (heavy low freq), v_spk2 (heavy high freq)
    v_spk1 = torch.zeros(163)
    v_spk1[0:40] = 1.0
    v_spk1 = v_spk1 / torch.norm(v_spk1, p=2)

    v_spk2 = torch.zeros(163)
    v_spk2[60:100] = 1.0
    v_spk2 = v_spk2 / torch.norm(v_spk2, p=2)

    v_spk1_alt = v_spk1.clone() + 0.05 * torch.randn(163)
    v_spk1_alt = v_spk1_alt / torch.norm(v_spk1_alt, p=2)

    # Sequence: Speaker 1, Speaker 2, Speaker 1 again
    embeddings = [v_spk1, v_spk2, v_spk1_alt]
    labels = cluster_speaker_embeddings(embeddings, num_speakers=2)
    assert len(labels) == 3
    assert labels[0] == labels[2], "First and third segments should belong to the same speaker"
    assert labels[0] != labels[1], "First and second segments should belong to different speakers"


def test_cluster_speaker_embeddings_edge_cases():
    """Verify clustering edge cases for empty list, single segment, and num_speakers=1."""
    assert cluster_speaker_embeddings([]) == []
    if WHISPER_AVAILABLE:
        v = torch.randn(163)
        assert cluster_speaker_embeddings([v]) == [0]
        # num_speakers=1 must assign ALL segments to speaker 0
        v2 = torch.randn(163)
        v3 = torch.randn(163)
        labels = cluster_speaker_embeddings([v, v2, v3], num_speakers=1)
        assert labels == [0, 0, 0], "num_speakers=1 should merge all segments into one cluster"


def test_format_diarized_transcript():
    """Verify turn formatting and consecutive speaker turn merging."""
    segments = [
        {"start": 0.0, "end": 2.5, "speaker": "Speaker 1", "text": "Hello team."},
        {"start": 2.5, "end": 5.0, "speaker": "Speaker 1", "text": "Let's review the roadmap."},
        {"start": 5.0, "end": 9.0, "speaker": "Speaker 2", "text": "I'll share my screen."}
    ]
    script = format_diarized_transcript(segments, merge_consecutive=True)
    assert "[00:00 - 00:05] Speaker 1: Hello team. Let's review the roadmap." in script
    assert "[00:05 - 00:09] Speaker 2: I'll share my screen." in script


@pytest.mark.skipif(not WHISPER_AVAILABLE, reason="OpenAI Whisper / PyTorch not installed")
def test_transcribe_endpoint_with_diarization():
    """Verify POST /api/transcribe with diarize=true returns speaker annotations."""
    wav_bytes = generate_test_wav_bytes(duration_sec=0.5)
    files = {"file": ("test_meeting_diarize.wav", wav_bytes, "audio/wav")}
    response = client.post("/api/transcribe?model=tiny&diarize=true", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "speakers" in data
    assert "segments" in data
    for seg in data["segments"]:
        assert "speaker" in seg

