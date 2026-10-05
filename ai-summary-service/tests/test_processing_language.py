"""Language selection must reach recognition and the saved meeting."""
import pytest
from fastapi.testclient import TestClient

import main
from database import crud


@pytest.mark.parametrize("language", [None, "en", "vi"])
@pytest.mark.parametrize("detailed", [True, False])
def test_processing_language_reaches_both_recognition_paths_and_storage(monkeypatch, language, detailed):
    calls = []
    def transcribe(*args, **kwargs):
        calls.append(kwargs)
        if detailed:
            return {"text": "Review the meeting notes.", "language": kwargs.get("language") or "en"}
        return "Review the meeting notes."
    monkeypatch.setattr(main, "get_gpu_info", lambda: ("CPU", False))
    monkeypatch.setattr(main, "resolve_model", lambda *a, **k: "test")
    monkeypatch.setattr(main, "transcribe_audio_detailed", transcribe if detailed else None)
    monkeypatch.setattr(main, "transcribe_audio", transcribe)
    monkeypatch.setattr(main, "summarize_with_llama", lambda *a, **k: "Review the notes.")
    monkeypatch.setattr(main, "extract_action_items", lambda *a, **k: [])
    monkeypatch.setattr(main, "extract_insights", lambda *a, **k: {})
    params = {"enable_mmr": "false"}
    if language:
        params["language"] = language
    response = TestClient(main.app).post("/api/process-audio", params=params,
                                         files={"file": ("meeting.wav", b"test audio")})
    assert response.status_code == 200
    assert len(calls) == 1
    assert calls[0].get("language") == language
    expected = language or ("en" if detailed else None)
    assert response.json()["data"]["language"] == expected
    assert crud.get_meeting(response.json()["meeting_id"]).language == expected


@pytest.mark.parametrize("language", ["invalid", "en&demo_mode=true"])
def test_invalid_processing_language_is_rejected_before_inference(monkeypatch, language):
    monkeypatch.setattr(main, "transcribe_audio_detailed", lambda *a, **k: pytest.fail("Inference should not start"))
    response = TestClient(main.app).post("/api/process-audio", params={"language": language},
                                         files={"file": ("meeting.wav", b"test audio")})
    assert response.status_code == 422
