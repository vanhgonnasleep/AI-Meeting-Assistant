import json

import pytest

from scripts.evaluation.manifest import load_cases


def write_manifest(tmp_path, cases):
    path = tmp_path / 'cases.jsonl'
    path.write_text('\n'.join(json.dumps(case, ensure_ascii=False) for case in cases), encoding='utf-8')
    return path


def test_missing_nlp_labels_remain_missing_not_zero_task_gold(tmp_path):
    cases = load_cases(write_manifest(tmp_path, [{'case_id': 'text-1', 'kind': 'nlp_text', 'split': 'test',
                                                 'transcript': 'Chúng ta trao đổi tiến độ.'}]))
    assert cases[0]['reference_tasks'] is None
    assert cases[0]['reference_facts'] is None
    assert cases[0]['reference_approved'] is False


def test_audio_paths_resolve_from_manifest_and_public_reference_can_be_empty(tmp_path):
    cases = load_cases(write_manifest(tmp_path, [{'case_id': 'audio-1', 'kind': 'asr', 'split': 'test',
                                                 'audio_path': 'clip.wav', 'reference_text': ''}]))
    assert cases[0]['audio_path'] == str((tmp_path / 'clip.wav').resolve())
    assert cases[0]['reference_text'] == ''


@pytest.mark.parametrize('change', [
    {'case_id': '../escape'}, {'case_id': 'CON'}, {'kind': 'unknown'}, {'split': 'train'},
    {'transcript': 'x' * 20_001}, {'reference_approved': 'yes'},
    {'reference_tasks': 'not a list'}, {'reference_tasks': [{'id': 'same'}, {'id': 'same'}]},
])
def test_invalid_cases_are_rejected(tmp_path, change):
    case = {'case_id': 'text-1', 'kind': 'nlp_text', 'split': 'test', 'transcript': 'Nội dung.'}
    case.update(change)
    with pytest.raises(ValueError):
        load_cases(write_manifest(tmp_path, [case]))


def test_duplicate_ids_and_bad_json_fail_before_running(tmp_path):
    case = {'case_id': 'text-1', 'kind': 'nlp_text', 'split': 'test', 'transcript': 'Nội dung.'}
    with pytest.raises(ValueError, match='duplicate'):
        load_cases(write_manifest(tmp_path, [case, case]))
    path = tmp_path / 'bad.jsonl'
    path.write_text('{broken', encoding='utf-8')
    with pytest.raises(ValueError, match='line 1'):
        load_cases(path)
