import pytest
from app.pipeline.glossary import GlossaryResolver, resolve_glossary_terms


def test_glossary_exact_and_case_insensitive_matching():
    sample_terms = [
        {"canonical": "Jira", "aliases": ["zi ra", "gi ra"], "category": "Tools"},
        {"canonical": "Kubernetes", "aliases": ["ku bơ nét", "k8s"], "category": "DevOps"},
        {"canonical": "Bubble", "aliases": ["ba bồ"], "category": "NoCode"},
    ]
    resolver = GlossaryResolver(terms=sample_terms)

    # Test exact and case-insensitive replacements
    text = "Hôm nay chúng ta cần tạo task trên zi ra và kiểm tra cụm ku bơ nét."
    normalized, corrections = resolver.resolve_text(text)

    assert "Jira" in normalized
    assert "Kubernetes" in normalized
    assert "zi ra" not in normalized
    assert "ku bơ nét" not in normalized
    assert len(corrections) == 2


def test_glossary_boundary_protection():
    sample_terms = [
        {"canonical": "Jira", "aliases": ["ra"], "category": "Tools"}
    ]
    resolver = GlossaryResolver(terms=sample_terms)

    # Word 'ra' should not match inside words like 'trang' or 'người'
    text = "Chúng ta đi ra ngoài trang web."
    normalized, _ = resolver.resolve_text(text)
    assert "trang" in normalized  # Not mangled
    assert "Jira" in normalized   # 'ra' standalone matched


def test_glossary_segment_resolution():
    sample_terms = [
        {"canonical": "Bubble", "aliases": ["ba bồ"], "category": "Platform"},
        {"canonical": "Tester", "aliases": ["tét xơ"], "category": "Role"},
    ]
    resolver = GlossaryResolver(terms=sample_terms)

    segments = [
        {"id": 0, "start": 0.0, "end": 4.5, "text": "Dự án này làm trên ba bồ rất nhanh."},
        {"id": 1, "start": 4.5, "end": 9.0, "text": "Đội tét xơ đã kiểm thử xong rồi."},
        {"id": 2, "start": 9.0, "end": 12.0, "text": "Không có thuật ngữ nào ở đây."},
    ]

    updated_segments, aggregated = resolver.resolve_segments(segments)

    assert "Bubble" in updated_segments[0]["text"]
    assert "ba bồ" not in updated_segments[0]["text"]
    assert updated_segments[0]["glossary_corrections"][0]["canonical"] == "Bubble"

    assert "Tester" in updated_segments[1]["text"]
    assert updated_segments[1]["glossary_corrections"][0]["canonical"] == "Tester"

    assert "glossary_corrections" not in updated_segments[2]
    assert len(aggregated) == 2


def test_default_glossary_loader():
    text = "Đội phờ ron en và bách en cần họp với pi em về việc đi poi lên xơ vơ."
    normalized, corrections = resolve_glossary_terms(text)

    assert "Frontend" in normalized
    assert "Backend" in normalized
    assert "Project Manager (PM)" in normalized or "PM" in normalized
    assert "Deploy" in normalized
    assert "Server" in normalized
    assert len(corrections) >= 4
