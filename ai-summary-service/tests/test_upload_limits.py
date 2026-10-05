from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


def upload_of_size(size):
    return SimpleNamespace(filename='meeting.mp3', file=SimpleNamespace(seek=lambda *args: None, tell=lambda: size))


def test_default_upload_accepts_a_one_hour_128kbps_recording():
    # 57.6 MB of audio should no longer be blocked by the former 50 MiB limit.
    assert main.validate_audio_upload(upload_of_size(57_600_000)) == 'meeting.mp3'


def test_exact_upload_boundary_and_actionable_rejection():
    assert main.validate_audio_upload(upload_of_size(256 * 1024 * 1024)) == 'meeting.mp3'
    with pytest.raises(HTTPException) as error:
        main.validate_audio_upload(upload_of_size(256 * 1024 * 1024 + 1))
    assert error.value.status_code == 413
    assert '256' in error.value.detail


def test_health_and_version_publish_the_same_upload_and_audio_limits(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('Test CPU', False))
    monkeypatch.setattr(main, 'get_installed_ollama_models', lambda: [])
    monkeypatch.setattr(main, 'get_whisper_model_info', lambda: {})
    client = TestClient(main.app)
    for path in ('/api/health', '/api/version'):
        result = client.get(path)
        assert result.status_code == 200
        assert result.json()['max_file_size_mb'] == 256
        assert result.json()['max_audio_duration_seconds'] == 10800


@pytest.mark.parametrize('path', ['/api/chat', '/api/meetings/1'])
def test_nonfinite_input_returns_validation_error_instead_of_crashing_json(path):
    client = TestClient(main.app)
    body = '{"question":"Budget?","segments":[{"text":"Budget","start":NaN}]}' if path.endswith('chat') else '{"filename":"test.wav","duration":NaN}'
    request = client.post if path.endswith('chat') else client.put
    response = request(path, content=body, headers={'Content-Type': 'application/json'})
    assert response.status_code == 422
    assert isinstance(response.json()['detail'], list)
