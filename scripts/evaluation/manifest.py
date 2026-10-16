"""Small, versioned evaluation inputs; missing labels never become empty gold."""
import hashlib
import json
from pathlib import Path
import re

MAX_TEXT = 20_000
MAX_CASES = 10_000
MAX_MANIFEST_BYTES = 32 * 1024 * 1024
SAFE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')
RESERVED = {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)), *(f'LPT{i}' for i in range(1, 10))}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _identifier(value):
    if not isinstance(value, str) or not SAFE_ID.fullmatch(value) or value.upper() in RESERVED:
        raise ValueError('Case/reference IDs must be safe, non-reserved identifiers.')


def _text(value, name):
    if not isinstance(value, str) or len(value) > MAX_TEXT:
        raise ValueError(f'{name} must be text with at most {MAX_TEXT} characters.')


def load_cases(path: Path) -> list[dict]:
    path = Path(path).resolve()
    if path.stat().st_size > MAX_MANIFEST_BYTES:
        raise ValueError('Manifest exceeds 32 MiB.')
    cases, seen = [], set()
    for line_number, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), start=1):
        if not line.strip():
            continue
        try:
            case = json.loads(line)
            if not isinstance(case, dict) or case.get('schema_version', 1) != 1:
                raise ValueError('Expected a version-1 case object.')
            _identifier(case.get('case_id'))
            if case['case_id'] in seen:
                raise ValueError('duplicate case ID')
            if case.get('kind') not in {'asr', 'nlp_text'} or case.get('split') not in {'dev', 'test'}:
                raise ValueError('Unsupported kind or split.')
            if not isinstance(case.get('reference_approved', False), bool):
                raise ValueError('reference_approved must be a boolean.')
            if case['kind'] == 'asr':
                _text(case.get('reference_text'), 'reference_text')
                audio = case.get('audio_path')
                if not isinstance(audio, str) or not audio.strip():
                    raise ValueError('ASR cases require an audio_path.')
                case['audio_path'] = str((path.parent / audio).resolve())
                checksum = case.get('audio_sha256')
                if checksum is not None and (not isinstance(checksum, str) or not re.fullmatch('[0-9a-f]{64}', checksum)):
                    raise ValueError('Invalid audio checksum.')
            else:
                _text(case.get('transcript'), 'transcript')
                if not case['transcript'].strip():
                    raise ValueError('NLP transcript cannot be empty.')
            for collection in ('reference_tasks', 'reference_facts'):
                entries = case.get(collection)
                if entries is not None:
                    if not isinstance(entries, list) or len(entries) > 500:
                        raise ValueError(f'{collection} must be a bounded list or null.')
                    ids = set()
                    for entry in entries:
                        if not isinstance(entry, dict):
                            raise ValueError('Reference entries must be objects.')
                        _identifier(entry.get('id'))
                        if entry['id'] in ids:
                            raise ValueError('duplicate reference ID')
                        ids.add(entry['id'])
                        _text(entry.get('task' if collection == 'reference_tasks' else 'text'), collection)
                        _text(entry.get('evidence', ''), 'evidence')
                case[collection] = entries
            if not isinstance(case.get('provenance', {}), dict):
                raise ValueError('provenance must be an object.')
            case.setdefault('provenance', {})
            case.setdefault('reference_approved', False)
            case['schema_version'] = 1
            seen.add(case['case_id'])
            cases.append(case)
            if len(cases) > MAX_CASES:
                raise ValueError('Too many manifest cases.')
        except (ValueError, TypeError, KeyError) as exc:
            raise ValueError(f'Manifest line {line_number}: {exc}') from exc
    if not cases:
        raise ValueError('Manifest contains no cases.')
    return cases
