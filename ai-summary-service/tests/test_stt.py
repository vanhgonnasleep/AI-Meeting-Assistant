import io
import os
import sys
import wave
import struct
import math
import tempfile
from pathlib import Path
import pytest
from fastapi import UploadFile
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
    ensure_ffmpeg
)

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


def test_transcribe_audio_from_bytes():
    """Test transcribing directly from raw audio bytes using tiny model."""
    wav_bytes = generate_test_wav_bytes(duration_sec=0.3)
    transcript = transcribe_audio(wav_bytes, model_name="tiny")
    assert isinstance(transcript, str)


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
    assert "Only .mp3, .wav, .m4a files are supported" in response.json()["detail"]


def test_transcribe_endpoint_file_too_large():
    """Verify POST /api/transcribe rejects oversized audio files."""
    oversized_bytes = b"0" * (51 * 1024 * 1024)
    files = {"file": ("large_audio.wav", oversized_bytes, "audio/wav")}
    response = client.post("/api/transcribe", files=files)
    assert response.status_code == 413
