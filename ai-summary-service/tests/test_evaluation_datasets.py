import hashlib
import json
from pathlib import Path

import pytest

from scripts.evaluation.datasets import prepare_fleurs
from scripts.evaluation.manifest import load_cases


def response(*args, **kwargs):
    return {'rows': [{'row_idx': i, 'row': {'transcription': 'Xin chào Việt Nam',
                      'audio': [{'src': f'https://cdn.example/{i}?secret=expired'}]}}
                     for i in range(2)]}


def download(url, target, max_bytes):
    target.write_bytes(b'RIFF-audio')


def test_prepare_first_rows_and_verified_cache(tmp_path):
    path = prepare_fleurs(tmp_path, limit=2, fetch_json=response, download=download)
    cases = load_cases(path)
    assert [c['provenance']['row_index'] for c in cases] == [0, 1]
    assert cases[0]['audio_sha256'] == hashlib.sha256(b'RIFF-audio').hexdigest()
    assert cases[0]['provenance']['dataset'] == 'google/fleurs'
    assert cases[0]['provenance']['license'] == 'CC-BY-4.0'
    assert 'secret' not in path.read_text()
    prepare_fleurs(tmp_path, limit=2, fetch_json=lambda *a: pytest.fail('cache network'))
    Path(cases[0]['audio_path']).write_bytes(b'corrupt')
    with pytest.raises(ValueError, match='checksum'):
        prepare_fleurs(tmp_path, limit=2, fetch_json=response)


@pytest.mark.parametrize('mode', ['interrupt', 'oversize'])
def test_failed_download_never_publishes_manifest(tmp_path, mode):
    def broken(url, target, max_bytes):
        target.write_bytes(b'x' * (max_bytes + 1) if mode == 'oversize' else b'partial')
        if mode == 'interrupt':
            raise OSError('interrupted')
    with pytest.raises((ValueError, OSError)):
        prepare_fleurs(tmp_path, limit=2, fetch_json=response, download=broken)
    assert not (tmp_path / 'manifest.jsonl').exists()
    assert not list(tmp_path.glob('*.part'))


def test_non_first_rows_rejected(tmp_path):
    def wrong(*a):
        r = response()
        r['rows'][0]['row_idx'] = 6
        return r
    with pytest.raises(ValueError, match='first'):
        prepare_fleurs(tmp_path, limit=2, fetch_json=wrong, download=download)


def test_changed_reference_cache_refused(tmp_path):
    path = prepare_fleurs(tmp_path,limit=2,fetch_json=response,download=download)
    rows = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]
    rows[0]['reference_text'] = 'changed reference'
    path.write_text(''.join(json.dumps(row)+'\n' for row in rows),encoding='utf-8')
    with pytest.raises(ValueError,match='checksum'):
        prepare_fleurs(tmp_path,limit=2,fetch_json=response,download=download)


def test_six_authored_cases_unapproved():
    root = Path(__file__).resolve().parents[2]
    cases = load_cases(root / 'evaluation/fixtures/vi_text_cases.jsonl')
    assert len(cases) == 6
    assert all(not c['reference_approved'] for c in cases)
    assert all(c['provenance']['dataset'] == 'authored-synthetic' for c in cases)
