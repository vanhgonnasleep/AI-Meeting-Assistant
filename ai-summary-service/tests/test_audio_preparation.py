"""Bounded decoding and inference regressions; never loads model weights."""
import io
import subprocess
import sys
import wave
from types import SimpleNamespace

import pytest

np = pytest.importorskip("numpy")

import agent1_transcribe as stt


def wav_bytes(seconds=0.25):
    data = io.BytesIO()
    with wave.open(data, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(np.zeros(int(seconds * 16000), dtype="<i2").tobytes())
    return data.getvalue()


def install_model(monkeypatch, callback):
    monkeypatch.setattr(stt, "get_whisper_model", lambda **kw: SimpleNamespace(transcribe=callback))


def test_disguised_playlist_cannot_decode_a_sibling_local_file(tmp_path):
    from audio_preparation import PreparedAudio
    (tmp_path / 'private.wav').write_bytes(wav_bytes())
    manifest = tmp_path / 'meeting.wav'
    manifest.write_text("ffconcat version 1.0\nfile private.wav\n", encoding='utf-8')
    with pytest.raises(RuntimeError, match='decoding failed'):
        with PreparedAudio(manifest, 1):
            pytest.fail('A disguised playlist decoded another file')


@pytest.mark.parametrize('extension,codec', [
    ('mp3', 'libmp3lame'), ('m4a', 'aac'), ('ogg', 'libvorbis'),
    ('flac', 'flac'), ('mp4', 'aac'), ('webm', 'libopus'), ('mkv', 'pcm_s16le'),
])
def test_supported_containers_still_decode(tmp_path, extension, codec):
    from audio_preparation import PreparedAudio, ffmpeg_executable
    source = tmp_path / 'source.wav'
    source.write_bytes(wav_bytes())
    encoded = tmp_path / f'meeting.{extension}'
    subprocess.run([ffmpeg_executable(), '-nostdin', '-loglevel', 'error', '-i', str(source),
                    '-c:a', codec, str(encoded)], check=True, timeout=15, capture_output=True)
    with PreparedAudio(encoded, 1) as audio:
        assert 0 < audio.duration <= 1


def test_disguised_hls_playlist_is_rejected(tmp_path):
    from audio_preparation import PreparedAudio
    (tmp_path / 'private.wav').write_bytes(wav_bytes())
    manifest = tmp_path / 'meeting.wav'
    manifest.write_text('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:0.25,\nprivate.wav\n#EXT-X-ENDLIST\n', encoding='utf-8')
    with pytest.raises(RuntimeError, match='decoding failed'):
        with PreparedAudio(manifest, 1):
            pytest.fail('A disguised HLS playlist was accepted')


def test_chunks_use_bounded_arrays_and_global_offsets(monkeypatch):
    monkeypatch.setattr(stt, "AUDIO_CHUNK_SECONDS", 0.1, raising=False)
    monkeypatch.setattr(stt, "CHUNK_OVERLAP_SECONDS", 0.03, raising=False)
    calls = []
    def inference(audio, **options):
        assert isinstance(audio, np.ndarray), "Whisper must not decode the original full file"
        assert audio.dtype == np.float32
        assert len(audio) <= 2560
        calls.append(options)
        local = [(0.02, 0.06), (0.05, 0.09), (0.04, 0.07)][len(calls) - 1]
        return {"language": "en", "text": " word", "segments": [{
            "id": 99, "start": local[0], "end": local[1], "text": "word",
            "avg_logprob": -0.2, "words": [{"start": local[0], "end": local[1], "word": "word"}],
        }]}
    install_model(monkeypatch, inference)
    result = stt.transcribe_audio_detailed(wav_bytes(), language="vi", fp16=False, beam_size=3)
    assert result["duration"] == pytest.approx(0.25)
    assert result["language"] == "vi"
    assert result["text"] == "word word word"
    assert [s["id"] for s in result["segments"]] == [0, 1, 2]
    assert [s["start"] for s in result["segments"]] == pytest.approx([0.02, 0.12, 0.21])
    assert result["segments"][1]["words"][0]["start"] == pytest.approx(0.12)
    assert result["segments"][1]["avg_logprob"] == -0.2
    assert len(calls) == 3 and all(c["beam_size"] == 3 and c["fp16"] is False for c in calls)


def test_overlap_segment_owned_once_by_midpoint(monkeypatch):
    monkeypatch.setattr(stt, "AUDIO_CHUNK_SECONDS", 0.1, raising=False)
    monkeypatch.setattr(stt, "CHUNK_OVERLAP_SECONDS", 0.03, raising=False)
    calls = []
    def inference(audio, **kw):
        calls.append(1)
        # Same segment spanning the boundary appears in both windows.
        start, end = [(0.09, 0.13), (0.02, 0.06)][len(calls) - 1]
        return {"language": "en", "text": "hello", "segments": [{"start": start, "end": end, "text": "hello"}]}
    install_model(monkeypatch, inference)
    result = stt.transcribe_audio_detailed(wav_bytes(0.18))
    assert len(calls) == 2
    assert len(result["segments"]) == 1
    assert result["segments"][0]["start"] == pytest.approx(0.09)


def test_explicit_clips_keep_original_file_timeline(monkeypatch):
    monkeypatch.setattr(stt, "AUDIO_CHUNK_SECONDS", 0.1)
    monkeypatch.setattr(stt, "CHUNK_OVERLAP_SECONDS", 0.03)
    calls = []
    def inference(audio, **options):
        calls.append(1)
        assert options["clip_timestamps"] == pytest.approx([0.05, 0.11])
        return {"language": "en", "text": "Selected", "segments": [
            {"start": 0.05, "end": 0.11, "text": "Selected"}
        ]}
    install_model(monkeypatch, inference)
    result = stt.transcribe_audio_detailed(wav_bytes(), clip_timestamps="0.12,0.18")
    assert result["segments"][0]["start"] == pytest.approx(0.12)
    assert result["segments"][0]["end"] == pytest.approx(0.18)
    assert result["duration"] == pytest.approx(0.25)
    assert result["text"] == "Selected"
    assert len(calls) == 1


def test_short_silent_audio_reports_real_duration(monkeypatch):
    install_model(monkeypatch, lambda *a, **k: {"language": "en", "text": "", "segments": []})
    result = stt.transcribe_audio_detailed(wav_bytes(0.25))
    assert result["duration"] == 0.25
    assert result["segments"] == []


def test_too_long_rejected_before_model_load(monkeypatch, tmp_path):
    monkeypatch.setattr(stt, "MAX_AUDIO_DURATION_SECONDS", 0.1, raising=False)
    scratch = tmp_path / "audio-temp"
    scratch.mkdir()
    monkeypatch.setattr(stt.tempfile, "tempdir", str(scratch))
    monkeypatch.setattr(stt, "get_whisper_model", lambda **kw: pytest.fail("Loaded model before duration validation"))
    with pytest.raises(ValueError, match="duration"):
        stt.transcribe_audio_detailed(wav_bytes(0.25))
    assert list(scratch.iterdir()) == []


@pytest.mark.parametrize("content", [b"not audio", b"", wav_bytes(0)])
def test_invalid_media_never_loads_model_and_cleans_up(monkeypatch, tmp_path, content):
    scratch = tmp_path / "audio-temp"
    scratch.mkdir()
    monkeypatch.setattr(stt.tempfile, "tempdir", str(scratch))
    monkeypatch.setattr(stt, "get_whisper_model", lambda **kw: pytest.fail("Loaded model before valid decode"))
    with pytest.raises(RuntimeError):
        stt.transcribe_audio_detailed(content)
    assert list(scratch.iterdir()) == []


def test_decode_timeout_cleans_up_without_model_load(monkeypatch, tmp_path):
    import audio_preparation
    scratch = tmp_path / "audio-temp"
    scratch.mkdir()
    monkeypatch.setattr(stt.tempfile, "tempdir", str(scratch))
    def timeout(command, **kwargs):
        raise subprocess.TimeoutExpired(command, kwargs["timeout"])
    monkeypatch.setattr(audio_preparation.subprocess, "run", timeout)
    monkeypatch.setattr(stt, "get_whisper_model", lambda **kw: pytest.fail("Model loaded after failed decode"))
    with pytest.raises(RuntimeError, match="time limit"):
        stt.transcribe_audio_detailed(wav_bytes())
    assert list(scratch.iterdir()) == []


def test_ffmpeg_check_does_not_modify_installed_package(monkeypatch, tmp_path):
    binary = tmp_path / "bundled-ffmpeg.exe"
    binary.write_bytes(b"placeholder")
    monkeypatch.setattr(stt.shutil, "which", lambda *a: None)
    monkeypatch.setitem(sys.modules, "imageio_ffmpeg", SimpleNamespace(get_ffmpeg_exe=lambda: str(binary)))
    monkeypatch.setenv("PATH", "test-path")
    assert stt.ensure_ffmpeg() is True
    assert list(tmp_path.glob("*ffmpeg*")) == [binary]
    assert stt.os.environ["PATH"] == "test-path"


def test_chunk_failure_cleans_every_temp_without_partial_success(monkeypatch, tmp_path):
    scratch = tmp_path / "audio-temp"
    scratch.mkdir()
    monkeypatch.setattr(stt.tempfile, "tempdir", str(scratch))
    monkeypatch.setattr(stt, "AUDIO_CHUNK_SECONDS", 0.1, raising=False)
    def fail(audio, **kw):
        raise RuntimeError("inference failed")
    install_model(monkeypatch, fail)
    with pytest.raises(RuntimeError, match="inference failed"):
        stt.transcribe_audio_detailed(wav_bytes())
    assert list(scratch.iterdir()) == []


def test_input_copy_failure_does_not_leak_temp(monkeypatch, tmp_path):
    scratch = tmp_path / "audio-temp"
    scratch.mkdir()
    monkeypatch.setattr(stt.tempfile, "tempdir", str(scratch))
    class BrokenStream:
        def read(self, *args):
            raise OSError("broken stream")
    with pytest.raises(OSError, match="broken stream"):
        stt._save_input_to_temp(BrokenStream())
    assert list(scratch.iterdir()) == []


def test_segment_limit_propagates_as_value_error(monkeypatch):
    monkeypatch.setattr(stt, "MAX_TRANSCRIPT_SEGMENTS", 2, raising=False)
    install_model(monkeypatch, lambda *a, **k: {"text": "hello", "segments": [
        {"start": 0.0, "end": 0.01, "text": "hello"} for _ in range(3)
    ]})
    with pytest.raises(ValueError, match="segment"):
        stt.transcribe_audio_detailed(wav_bytes())


def test_long_clustering_has_bounded_exact_work_and_stable_speakers(monkeypatch):
    torch = pytest.importorskip("torch")
    embeddings = [torch.tensor([1.0, 0.0]) if i % 2 == 0 else torch.tensor([0.0, 1.0]) for i in range(400)]
    calls = []
    original = torch.dot
    def counted(a, b):
        calls.append(1)
        if len(calls) >= 400_000:
            pytest.fail("Unbounded hierarchical clustering work")
        return original(a, b)
    monkeypatch.setattr(torch, "dot", counted)
    labels = stt.cluster_speaker_embeddings(embeddings, num_speakers=2)
    assert labels == [i % 2 for i in range(400)]
    assert len(calls) < 400_000


def test_diarization_reads_bounded_segment_audio(monkeypatch, tmp_path):
    whisper = pytest.importorskip("whisper")
    audio = tmp_path / "speech.wav"
    audio.write_bytes(wav_bytes(2))
    monkeypatch.setattr(stt, "AUDIO_CHUNK_SECONDS", 0.1, raising=False)
    original = whisper.log_mel_spectrogram
    observed = []
    def bounded(samples, *args, **kwargs):
        observed.append(len(samples))
        assert len(samples) <= 1600
        return original(samples, *args, **kwargs)
    monkeypatch.setattr(whisper, "log_mel_spectrogram", bounded)
    monkeypatch.setattr(whisper, "load_audio", lambda *a: pytest.fail("Full source decode during diarization"))
    segments, speakers = stt.diarize_segments([
        {"id": 0, "start": 0.2, "end": 1.8, "text": "Hello team"}
    ], str(audio), use_llm_refinement=False)
    assert observed and len(observed) == 16
    assert speakers == ["Speaker 1"]
    assert segments[0]["start"] == 0.2
