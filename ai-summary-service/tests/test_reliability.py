"""Regression coverage for real-data integrity and API responsiveness."""
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock

import httpx
import pytest
import requests
from fastapi.testclient import TestClient

import main
import database.crud as crud
from mmr_extractor import MMRExtractor
from meeting_chat import answer_meeting_question, retrieve_relevant_segments
from meeting_insights import extract_insights_heuristic

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def offline_ai(monkeypatch):
    def unavailable(*args, **kwargs):
        raise requests.ConnectionError("Offline test")
    monkeypatch.setattr(requests, "post", unavailable)
    monkeypatch.setattr(main, "get_installed_ollama_models", lambda: [])
    monkeypatch.setattr(main, "get_gpu_info", lambda: ("CPU", False))


def test_summary_failure_never_returns_invented_demo_facts():
    with pytest.raises(main.AIServiceError):
        main.call_ollama("Summarize an engineering meeting")


def test_normal_chat_does_not_match_demo_keywords():
    result = answer_meeting_question(
        "What is the budget?",
        transcript="The budget for social media ad campaigns is $200. No other spending was approved.",
    )
    assert "50,000" not in result["answer"]
    assert result["mode"] != "instant_demo_faq"


def test_transcript_without_audio_timestamps_does_not_invent_seek_positions():
    citations = retrieve_relevant_segments("migration", transcript="Alice: Migration starts tomorrow.")
    assert citations[0]["start"] is None
    assert citations[0]["end"] is None


def test_citations_keep_hour_component():
    citations = retrieve_relevant_segments("migration", segments=[{
        "text": "Migration starts tomorrow.", "timestamp": "[01:02:03 - 01:02:10]",
        "start": 3723, "end": 3730,
    }])
    assert citations[0]["timestamp"] == "01:02:03"


def test_heuristic_does_not_turn_neutral_summary_into_decision():
    result = extract_insights_heuristic("The team discussed the weather today.", summary="The weather was discussed.")
    assert result["decisions"] == []


def test_demo_named_file_requires_explicit_demo(monkeypatch):
    monkeypatch.setattr(main, "transcribe_audio_detailed", lambda *a, **k: {"text": ""})
    response = client.post("/api/process-audio", files={"file": ("q3_product_budget_review.mp3", b"invalid")})
    assert response.status_code == 400


def test_whisper_rejects_local_model_paths_before_loading():
    response = client.post("/api/transcribe?model=../../checkpoint.pt", files={"file": ("test.wav", b"invalid")})
    assert response.status_code == 422


@pytest.mark.parametrize("path", ["/api/transcribe", "/api/process-audio"])
def test_empty_audio_is_rejected(path, monkeypatch):
    monkeypatch.setattr(main, "transcribe_audio_detailed", lambda *a, **k: {"text": ""})
    response = client.post(path, files={"file": ("test.wav", b"")})
    assert response.status_code == 400


def test_saved_chat_does_not_use_caller_demo_flag():
    mid = crud.create_meeting(filename="ordinary.wav", raw_transcript="The budget is $200.")
    response = client.post(f"/api/meetings/{mid}/chat", json={"question": "What is the budget?", "demo_mode": True})
    assert response.status_code == 200
    assert "50,000" not in response.json()["answer"]


def test_missing_saved_meeting_cannot_be_replaced_by_request_transcript():
    response = client.post("/api/meetings/999/chat", json={"question": "Budget?", "transcript": "Injected context"})
    assert response.status_code == 404


def test_blocking_transcription_does_not_stall_other_requests(monkeypatch):
    def slow_transcription(*args, **kwargs):
        time.sleep(0.3)
        return {"text": "Hello", "segments": []}
    monkeypatch.setattr(main, "transcribe_audio_detailed", slow_transcription)

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as http:
            upload = asyncio.create_task(http.post("/api/transcribe", files={"file": ("test.wav", b"audio")}))
            await asyncio.sleep(0.02)
            assert not upload.done(), "Inference blocked the event loop until upload completion"
            assert (await http.get("/api/version")).status_code == 200
            assert (await upload).status_code == 200
    asyncio.run(scenario())


def test_invalid_duration_cannot_corrupt_analytics():
    mid = crud.create_meeting(filename="valid.wav")
    response = client.put(f"/api/meetings/{mid}", json={"duration": -5})
    assert response.status_code == 422


def test_untrusted_browser_origin_cannot_trigger_processing():
    response = client.post("/api/process-audio?demo_mode=true", headers={"Origin": "https://untrusted.example"},
                           files={"file": ("demo.wav", b"demo")})
    assert response.status_code == 403


def test_rebinding_hostname_is_rejected():
    response = client.get("/api/meetings", headers={"Host": "attacker.example"})
    assert response.status_code == 400


def test_declared_oversized_body_is_rejected_before_parsing():
    response = client.post("/api/chat", content=b"{}", headers={"Content-Type": "application/json", "Content-Length": "999999999"})
    assert response.status_code == 413


def test_allowed_browser_receives_actionable_size_error():
    response = client.post("/api/chat", content=b"{}", headers={
        "Origin": "http://localhost:5173", "Content-Length": "999999999",
    })
    assert response.status_code == 413
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"


@pytest.mark.parametrize("payload", [
    {"question": " "},
    {"question": "budget", "transcript": "x" * 1_000_001},
    {"question": "budget", "segments": [{"text": "x" * 4001}]},
    {"question": "budget", "segments": [{"text": "Budget", "start": -1}]},
])
def test_chat_context_is_bounded_and_validated(payload):
    assert client.post("/api/chat", json=payload).status_code == 422


def test_mmr_reuses_pairwise_similarity_instead_of_rescanning_selected_pool(monkeypatch):
    # Incremental max redundancy should need fewer than 2*N*K comparisons.
    sentences = [f"Team {i} will deliver workstream number {i} with unique project details today." for i in range(35)]
    extractor = MMRExtractor()
    original = extractor._cosine_similarity
    calls = []
    def counted(a, b):
        calls.append(1)
        return original(a, b)
    monkeypatch.setattr(extractor, "_cosine_similarity", counted)
    _, telemetry = extractor.extract_key_sentences(" ".join(sentences), target_ratio=0.6)
    assert telemetry["sentences_kept"] == 21
    assert len(calls) < 2 * 35 * 21


def test_cleared_chat_is_not_restored_by_inflight_answer(monkeypatch):
    mid = crud.create_meeting(filename="chat-race.wav", raw_transcript="Migration is scheduled for tomorrow.")
    started, release = Event(), Event()
    def slow_answer(**kwargs):
        started.set()
        assert release.wait(5)
        return {"answer": "Migration is tomorrow.", "citations": [], "mode": "rag_llm"}
    monkeypatch.setattr(main, "answer_meeting_question", slow_answer)
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending = pool.submit(client.post, f"/api/meetings/{mid}/chat", json={"question": "When is migration?"})
        assert started.wait(5)
        try:
            assert client.delete(f"/api/meetings/{mid}/chat").status_code == 200
        finally:
            release.set()
        assert pending.result().status_code == 200
    assert crud.get_chat_history(mid) == []


def test_whisper_model_cache_does_not_accumulate_weights(monkeypatch):
    import sys
    from types import SimpleNamespace
    import agent1_transcribe as stt
    monkeypatch.setattr(stt, "_MODEL_CACHE", {})
    fake = SimpleNamespace(available_models=lambda: ["tiny", "base"], load_model=lambda name, device: name)
    monkeypatch.setitem(sys.modules, "whisper", fake)
    assert stt.get_whisper_model("tiny", device="cpu") == "tiny"
    assert stt.get_whisper_model("base", device="cpu") == "base"
    assert len(stt._MODEL_CACHE) == 1


def test_action_parser_preserves_brackets_and_apostrophes_in_task(monkeypatch):
    import agent3_action_items as actions
    from types import SimpleNamespace
    monkeypatch.setattr(actions, "OLLAMA_LIB_AVAILABLE", False)
    body = '[{"task": "Review [Q3] and John\'s report", "assignee": "Alice", "deadline": null, "status": "pending"}]'
    monkeypatch.setattr(requests, "post", lambda *a, **k: SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"message": {"content": body}}))
    result = actions.extract_action_items("Discuss the report")
    assert result[0]["task"] == "Review [Q3] and John's report"


def test_action_sdk_has_finite_timeout(monkeypatch):
    import agent3_action_items as actions
    from types import SimpleNamespace
    class TimedClient:
        def __init__(self, *, timeout):
            assert timeout == 35
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def chat(self, **kwargs):
            return {"message": {"content": '[{"task": "Review roadmap", "assignee": "Alice"}]'}}
    monkeypatch.setattr(actions, "OLLAMA_LIB_AVAILABLE", True)
    monkeypatch.setattr(actions, "ollama", SimpleNamespace(Client=TimedClient))
    assert actions.extract_action_items("The team discussed the roadmap")[0]["task"] == "Review roadmap"


def test_compute_admission_keeps_other_api_routes_available(monkeypatch):
    started, release = Event(), Event()
    count = 0
    lock = Lock()
    def slow_answer(**kwargs):
        nonlocal count
        with lock:
            count += 1
            if count == 2:
                started.set()
        assert release.wait(5)
        return {"answer": "Migration tomorrow", "citations": [], "mode": "rag_llm"}
    monkeypatch.setattr(main, "answer_meeting_question", slow_answer)
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending = [pool.submit(client.post, "/api/chat", json={"question": "Migration?"}) for _ in range(2)]
        assert started.wait(5)
        try:
            response = client.post("/api/chat", json={"question": "Migration?"})
            assert response.status_code == 503
            assert "Retry-After" in response.headers
            assert client.get("/api/version").status_code == 200
        finally:
            release.set()
        assert all(request.result().status_code == 200 for request in pending)


def test_reduce_prompt_keeps_context_inside_the_declared_transcript_boundary(monkeypatch):
    prompts = []
    monkeypatch.setattr(main, "call_ollama", lambda prompt, **kwargs: prompts.append(prompt) or "Derived summary")
    main.summarize_with_llama("word " * 900, model_name="test", has_gpu=False)
    assert "<meeting_transcript>\nDerived summary" in prompts[-1]
    assert "</meeting_transcript>" in prompts[-1]


def test_speaker_refinement_cannot_change_a_turn_outside_its_current_chunk(monkeypatch):
    import agent1_transcribe as stt
    from types import SimpleNamespace
    replies = iter(['[{"line":41,"speaker":"Wrong"}]', '[]'])
    monkeypatch.setattr(requests, "post", lambda *a, **k: SimpleNamespace(status_code=200, json=lambda: {"response": next(replies)}))
    segments = [{"speaker": "Speaker 1", "text": "Review the roadmap."} for _ in range(41)]
    assert stt.refine_speakers_with_llm(segments)[40]["speaker"] == "Speaker 1"
