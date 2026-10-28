"""Agent 4: Glossary and Acronym Resolver for Domain-Specific Speech-to-Text.

Normalizes vertical/industry terminology, foreign loanwords, and acronyms that
Whisper frequently misrecognizes or phonetically transcribes in Vietnamese/English
meetings (e.g. 'zi ra' -> 'Jira', 'ku bơ nét' -> 'Kubernetes', 'pi ô' -> 'PO').
"""
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("clarion.glossary")

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "default_glossary.json"


def load_default_glossary() -> List[Dict[str, Any]]:
    """Loads default domain-specific terms from the local fixtures directory."""
    if FIXTURE_PATH.is_file():
        try:
            with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("terms", [])
        except Exception as exc:
            logger.warning("Failed to parse default_glossary.json: %s", exc)
    return []


class GlossaryResolver:
    """Agent 4 engine compiling term definitions into high-performance boundary-safe patterns."""

    def __init__(self, terms: Optional[List[Dict[str, Any]]] = None):
        self.terms = terms if terms is not None else load_default_glossary()
        self._compiled_rules: List[Tuple[re.Pattern, str, str]] = []
        self._build_rules()

    def _build_rules(self) -> None:
        """Builds sorted regex patterns with word boundaries (longest alias first)."""
        rules = []
        for entry in self.terms:
            canonical = entry.get("canonical", "").strip()
            if not canonical:
                continue
            category = entry.get("category", "General")
            aliases = entry.get("aliases", [])
            for alias in aliases:
                alias_clean = alias.strip()
                if not alias_clean:
                    continue
                # Escape characters and allow flexible intra-word whitespace
                escaped = re.escape(alias_clean)
                pattern_str = r"(?<!\w)" + escaped.replace(r"\ ", r"\s+") + r"(?!\w)"
                try:
                    pattern = re.compile(pattern_str, flags=re.IGNORECASE)
                    rules.append((len(alias_clean), pattern, canonical, category))
                except re.error as err:
                    logger.warning("Invalid regex for alias '%s': %s", alias_clean, err)

        # Sort descending by length so longer phrases match before substrings
        rules.sort(key=lambda r: r[0], reverse=True)
        self._compiled_rules = [(r[1], r[2], r[3]) for r in rules]

    def resolve_text(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Substitutes misrecognized terms in text and tracks corrections.
        
        Returns:
            Tuple[str, List[Dict[str, Any]]]: (normalized_text, corrections_list)
        """
        if not text or not isinstance(text, str):
            return text, []

        corrections: List[Dict[str, Any]] = []
        updated_text = text

        for pattern, canonical, category in self._compiled_rules:
            matches = list(pattern.finditer(updated_text))
            if matches:
                # Do not re-replace if target canonical is identical to matched text
                replaced_count = 0
                for m in reversed(matches):
                    matched_str = m.group(0)
                    if matched_str == canonical:
                        continue
                    start, end = m.span()
                    updated_text = updated_text[:start] + canonical + updated_text[end:]
                    replaced_count += 1
                if replaced_count > 0:
                    corrections.append({
                        "canonical": canonical,
                        "category": category,
                        "count": replaced_count
                    })

        return updated_text, corrections

    def resolve_segments(self, segments: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Resolves terms across an array of Whisper transcript segments.
        Updates segment['text'] in-place and records segment['glossary_corrections'].
        
        Returns:
            Tuple: (updated_segments, aggregated_meeting_corrections)
        """
        if not segments:
            return [], []

        all_corrections_map: Dict[str, Dict[str, Any]] = {}

        for seg in segments:
            orig = seg.get("text", "")
            if not orig:
                continue
            normalized, seg_corrections = self.resolve_text(orig)
            if seg_corrections:
                seg["text"] = normalized
                seg["glossary_corrections"] = seg_corrections
                for c in seg_corrections:
                    canon = c["canonical"]
                    if canon not in all_corrections_map:
                        all_corrections_map[canon] = {
                            "canonical": canon,
                            "category": c["category"],
                            "count": 0
                        }
                    all_corrections_map[canon]["count"] += c["count"]

        return segments, list(all_corrections_map.values())


# Singleton instance for fast execution across pipeline runs
_default_resolver: Optional[GlossaryResolver] = None


def get_glossary_resolver() -> GlossaryResolver:
    global _default_resolver
    if _default_resolver is None:
        _default_resolver = GlossaryResolver()
    return _default_resolver


def resolve_glossary_terms(
    transcript_or_segments: Any
) -> Tuple[Any, List[Dict[str, Any]]]:
    """
    Public pipeline helper: Normalizes either raw string or segment list.
    """
    resolver = get_glossary_resolver()
    if isinstance(transcript_or_segments, list):
        return resolver.resolve_segments(transcript_or_segments)
    elif isinstance(transcript_or_segments, str):
        return resolver.resolve_text(transcript_or_segments)
    return transcript_or_segments, []
