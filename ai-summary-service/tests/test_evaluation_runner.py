import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.evaluation.adapters import verify_checkpoint
from scripts.evaluation.runner import run_evaluation


class FakeAdapter:
    def preflight(self, models, *, allow_download):
        return {'device': 'cpu', 'models': models, 'SECRET': 'never-save'}

    def transcribe(self, case, model):
        if model == 'base':
            raise RuntimeError('network?token=SECRET')
        return {'text': 'xin chào', 'duration': 2, 'inference_seconds': 1, 'load_seconds': 7, 'device': 'cpu'}

    def analyze(self, transcript, model):
        return {'summary': transcript, 'action_items': [], 'generation': {'source': 'llm'}}


def manifests(tmp_path):
    audio = tmp_path / 'a.wav'
    audio.write_bytes(b'audio')
    cases = [{'case_id': 'a', 'kind': 'asr', 'split': 'test', 'reference_text': 'xin chào',
              'audio_path': str(audio), 'audio_sha256': hashlib.sha256(b'audio').hexdigest()},
             {'case_id': 'n', 'kind': 'nlp_text', 'split': 'test', 'transcript': 'Cuộc họp ngắn.'}]
    path = tmp_path / 'cases.jsonl'
    path.write_text(''.join(json.dumps(c) + '\n' for c in cases))
    return path


def test_runner_variants_failures_and_allowlist(tmp_path):
    path = manifests(tmp_path)
    out = run_evaluation([path], tmp_path/'runs', models=['tiny','base'], llm_model='fake', adapter=FakeAdapter())
    run = json.loads((out/'run.json').read_text(encoding='utf-8'))
    assert run['status'] == 'partial'
    assert len(run['rows']) == 4
    assert run['rows'][0]['timing']['rtf'] == .5
    assert run['rows'][0]['timing']['load_seconds'] == 7
    assert run['rows'][1]['status'] == 'error'
    assert len((out/'rows.jsonl').read_text(encoding='utf-8').splitlines()) == 4
    assert 'SECRET' not in (out/'run.json').read_text(encoding='utf-8')
    nlp = run['rows'][2:]
    assert [r['variant'] for r in nlp] == ['mmr_off', 'mmr_on']
    assert nlp[1]['mmr']['lambda_param'] == .65
    assert nlp[1]['mmr']['target_ratio'] == .55
    assert 'transcript' in nlp[0]['output']
    other = run_evaluation([path], tmp_path/'runs', models=['tiny'], llm_model='fake', adapter=FakeAdapter())
    assert other != out


def test_interruption_retains_completed_rows(tmp_path):
    class Stop(FakeAdapter):
        def analyze(self, *args):
            raise KeyboardInterrupt
    with pytest.raises(KeyboardInterrupt):
        run_evaluation([manifests(tmp_path)], tmp_path/'runs', models=['tiny'], llm_model='fake', adapter=Stop())
    run_path = next((tmp_path/'runs').glob('*/run.json'))
    run = json.loads(run_path.read_text(encoding='utf-8'))
    assert run['status'] == 'interrupted'
    assert len(run['rows']) == 1


def test_changed_input_never_transcribed(tmp_path):
    path = manifests(tmp_path)
    (tmp_path/'a.wav').write_bytes(b'changed')
    run_path = run_evaluation([path], tmp_path/'runs', models=['tiny'], llm_model='fake', adapter=FakeAdapter())
    assert json.loads((run_path/'run.json').read_text(encoding='utf-8'))['rows'][0]['status'] == 'error'


def test_cache_only_verifies_hash_without_loader(tmp_path):
    digest = hashlib.sha256(b'weights').hexdigest()
    fake = SimpleNamespace(_MODELS={'tiny': f'https://official/{digest}/tiny.pt'})
    with pytest.raises(RuntimeError, match='missing'):
        verify_checkpoint('tiny', tmp_path, fake)
    (tmp_path/'tiny.pt').write_bytes(b'bad')
    with pytest.raises(RuntimeError, match='checksum'):
        verify_checkpoint('tiny', tmp_path, fake)
    (tmp_path/'tiny.pt').write_bytes(b'weights')
    assert verify_checkpoint('tiny', tmp_path, fake)['sha256'] == digest


def test_action_metadata_preserves_wrapper(monkeypatch):
    from app.pipeline import action_items as module
    monkeypatch.setattr(module, 'OLLAMA_LIB_AVAILABLE', False)
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'message': {'content': '[{"task":"Write API documentation","assignee":"Minh"}]'}}
    monkeypatch.setattr(module.requests, 'post', lambda *a, **kw: Response())
    detailed = module.extract_action_items_detailed('Minh will write the API documentation.')
    assert detailed['source'] == 'llm'
    assert module.extract_action_items('Minh will write the API documentation.') == detailed['items']
    monkeypatch.setattr(Response, 'json', lambda self: {'message': {'content': 'invalid'}})
    assert module.extract_action_items_detailed('Minh will write the API documentation.')['source'] == 'heuristic'
    def offline(*a, **kw): raise RuntimeError('offline')
    monkeypatch.setattr(module.requests, 'post', offline)
    assert module.extract_action_items_detailed('Minh will write the API documentation.')['reason'] == 'generation_error'


def test_adapter_import_uses_temporary_database_in_fresh_process(tmp_path):
    import os
    import subprocess
    import sys
    owner = tmp_path/'owner.db'
    owner.write_bytes(b'owner untouched')
    environment = dict(os.environ, CLARION_DB_PATH=str(owner), CLARION_DATA_DIR=str(tmp_path/'owner-data'))
    script = ('from scripts.evaluation.adapters import PipelineAdapter; '
              'a=PipelineAdapter(); a._initialize(); import database.db as db; '
              'assert "clarion-evaluation-" in str(db.DB_PATH); a.close()')
    result = subprocess.run([sys.executable, '-c', script], env=environment, cwd=Path(__file__).resolve().parents[2], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert owner.read_bytes() == b'owner untouched'
    assert not (tmp_path/'owner-data').exists()
