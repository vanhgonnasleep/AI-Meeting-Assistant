"""Fixed Vietnamese normalization and corpus edit counts, without model dependencies."""
import unicodedata


def normalize_text(text: str) -> str:
    if not isinstance(text, str):
        raise ValueError('Metric input must be text.')
    normalized = unicodedata.normalize('NFC', text).casefold()
    return ' '.join(''.join(' ' if unicodedata.category(char).startswith('P') else char
                            for char in normalized).split())


def edit_counts(reference: str, hypothesis: str, *, unit: str) -> dict:
    ref, hyp = normalize_text(reference), normalize_text(hypothesis)
    if unit == 'words':
        ref, hyp = ref.split(), hyp.split()
    elif unit == 'characters':
        ref, hyp = list(ref.replace(' ', '')), list(hyp.replace(' ', ''))
    else:
        raise ValueError('Metric unit must be words or characters.')
    # Each cell carries (distance, substitutions, deletions, insertions).
    # Stable tie order prefers substitution, then deletion, then insertion.
    previous = [(j, 0, 0, j) for j in range(len(hyp) + 1)]
    for index, ref_unit in enumerate(ref, start=1):
        current = [(index, 0, index, 0)]
        for j, hyp_unit in enumerate(hyp, start=1):
            diagonal, delete, insert = previous[j - 1], previous[j], current[j - 1]
            if ref_unit == hyp_unit:
                current.append(diagonal)
            else:
                current.append(min((
                    (diagonal[0] + 1, diagonal[1] + 1, diagonal[2], diagonal[3]),
                    (delete[0] + 1, delete[1], delete[2] + 1, delete[3]),
                    (insert[0] + 1, insert[1], insert[2], insert[3] + 1),
                ), key=lambda cell: cell[0]))
        previous = current
    errors, substitutions, deletions, insertions = previous[-1]
    return {'errors': errors, 'substitutions': substitutions, 'deletions': deletions,
            'insertions': insertions, 'reference_units': len(ref),
            'rate': errors / len(ref) if ref else None}


def aggregate_asr(rows: list[dict]) -> dict:
    relevant = [row for row in rows if row.get('kind') == 'asr']
    result = {'attempted': len(relevant), 'completed': sum(row.get('status') == 'ok' for row in relevant)}
    result['failed'] = result['attempted'] - result['completed']
    for metric in ('wer', 'cer'):
        totals = dict.fromkeys(('errors', 'substitutions', 'deletions', 'insertions', 'reference_units'), 0)
        scorable = 0
        for row in relevant:
            counts = row.get('scores', {}).get(metric) if row.get('status') == 'ok' else None
            if counts is None:
                continue
            for key in totals:
                totals[key] += counts[key]
            scorable += counts['reference_units'] > 0
        totals['rate'] = totals['errors'] / totals['reference_units'] if totals['reference_units'] else None
        totals['scorable_rows'] = scorable
        result[metric] = totals
    return result
