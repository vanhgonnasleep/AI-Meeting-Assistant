"""Optional real-model regressions: speech must survive, tones must not loop."""
from pathlib import Path
import wave

import pytest

np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")
pytest.importorskip("whisper")

import agent1_transcribe as stt


@pytest.fixture
def cached_tiny(monkeypatch):
    if not (Path.home() / ".cache/whisper/tiny.pt").is_file():
        pytest.skip("Needs locally cached tiny weights; never download for quality tests")
    monkeypatch.setattr(stt, "get_whisper_device", lambda: "cpu")
    # Preserve the runner's RNG while making fallback sampling reproducible.
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(0)
        yield


def test_non_speech_does_not_become_a_long_repetition_loop(tmp_path, cached_tiny):
    # Thirty-second decoding windows can feed hallucinations into the next turn.
    samples = (0.2 * np.sin(2 * np.pi * 440 * np.arange(120 * 16000) / 16000)
               * 32767).astype("<i2")
    source = tmp_path / "tone.wav"
    with wave.open(str(source), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(samples.tobytes())
    result = stt.transcribe_audio_detailed(source, model_name="tiny")
    assert result["duration"] == pytest.approx(120)
    assert len(result["text"].split()) <= 10, "Non-speech produced a long invented transcript"


def test_fallback_keeps_clear_spoken_meeting_content(cached_tiny):
    source = Path(__file__).resolve().parents[2] / "samples/sample_meeting_en.wav"
    result = stt.transcribe_audio_detailed(source, model_name="tiny", language="en")
    text = result["text"].casefold()
    assert result["language"] == "en"
    assert "marketing" in text and "budget" in text
    assert 25 <= len(text.split()) <= 100
    assert result["segments"]
