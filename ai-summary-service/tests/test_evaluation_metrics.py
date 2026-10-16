import pytest

from scripts.evaluation.metrics import normalize_text, edit_counts, aggregate_asr


def test_vietnamese_normalization_preserves_accents_and_numbers():
    assert normalize_text('  VIỆT, Nam! 2026. ') == 'việt nam 2026'
    assert normalize_text('Vi\u0065\u0323\u0302t') == normalize_text('Việt')
    assert edit_counts('má 12', 'ma 13', unit='characters')['errors'] == 2


@pytest.mark.parametrize('reference,hypothesis,expected', [
    ('a b c', 'a x c d', {'substitutions': 1, 'deletions': 0, 'insertions': 1}),
    ('a b', 'a', {'substitutions': 0, 'deletions': 1, 'insertions': 0}),
    ('a', 'a b', {'substitutions': 0, 'deletions': 0, 'insertions': 1}),
])
def test_known_word_edits(reference, hypothesis, expected):
    result = edit_counts(reference, hypothesis, unit='words')
    assert {key: result[key] for key in expected} == expected
    assert result['errors'] == sum(expected.values())


def test_empty_reference_is_not_scored_as_zero_error():
    result = edit_counts('', 'thêm', unit='words')
    assert result['reference_units'] == 0
    assert result['insertions'] == 1
    assert result['rate'] is None
    assert edit_counts('', '', unit='characters')['rate'] is None


def test_corpus_rates_use_counts_and_keep_failed_coverage():
    rows = [
        {'kind': 'asr', 'status': 'ok', 'scores': {
            'wer': edit_counts('a', '', unit='words'), 'cer': edit_counts('a', '', unit='characters')}},
        {'kind': 'asr', 'status': 'ok', 'scores': {
            'wer': edit_counts('b b b b b b b b b', 'b b b b b b b b b', unit='words'),
            'cer': edit_counts('b b b b b b b b b', 'b b b b b b b b b', unit='characters')}},
        {'kind': 'asr', 'status': 'error', 'error': 'fixture failure'},
        {'kind': 'nlp_text', 'status': 'ok'},
    ]
    result = aggregate_asr(rows)
    assert result['attempted'] == 3 and result['completed'] == 2 and result['failed'] == 1
    assert result['wer']['rate'] == pytest.approx(0.1)
    assert result['cer']['rate'] == pytest.approx(0.1)
    assert aggregate_asr([])['wer']['rate'] is None


def test_metrics_reject_invalid_units_and_types():
    with pytest.raises(ValueError):
        edit_counts('a', 'a', unit='unknown')
    with pytest.raises(ValueError):
        normalize_text(None)
