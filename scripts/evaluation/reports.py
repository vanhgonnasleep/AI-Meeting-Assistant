"""Offline, escaped reports and explicit one-to-one human scorecards."""
import csv
from html import escape
import json
from pathlib import Path

from .metrics import aggregate_asr

REVIEW_FIELDS = ['case_id','variant','review_complete','task_matches','covered_fact_ids','unsupported_claims']


def _reviews(path, run):
    if path is None:
        return {}
    valid = {(r['case_id'],r['variant']) for r in run['rows'] if r['kind'] == 'nlp_text'}
    result = {}
    with Path(path).open(encoding='utf-8-sig',newline='') as stream:
        reader = csv.DictReader(stream)
        if set(reader.fieldnames or []) != set(REVIEW_FIELDS):
            raise ValueError('Unexpected review CSV columns')
        for row in reader:
            key = row['case_id'],row['variant']
            if key not in valid or key in result:
                raise ValueError('Unknown or duplicate review row')
            complete = row['review_complete'].strip().lower()
            if complete not in {'true','false',''}:
                raise ValueError('review_complete must be true/false')
            if complete != 'true':
                result[key] = None
                continue
            try:
                matches = json.loads(row['task_matches'])
                facts = json.loads(row['covered_fact_ids'])
                unsupported = int(row['unsupported_claims'])
            except (ValueError,TypeError) as exc:
                raise ValueError('Completed reviews require explicit JSON matches/facts and claim counts') from exc
            if not isinstance(matches,list) or not isinstance(facts,list) or unsupported < 0:
                raise ValueError('Invalid review values')
            result[key] = {'matches': matches, 'facts': facts, 'unsupported': unsupported}
    return result


def _score_row(case, row, review):
    predictions = row.get('output',{}).get('action_items',[])
    tasks, facts = case.get('reference_tasks'), case.get('reference_facts')
    if tasks is None or facts is None:
        return None
    task_map = {t['id']:t for t in tasks}
    fact_ids = {f['id'] for f in facts}
    used_predictions, used_refs = set(), set()
    owner_correct = owner_n = deadline_correct = deadline_n = 0
    for match in review['matches']:
        if not isinstance(match,list) or len(match) != 4:
            raise ValueError('Task matches must be [prediction_index, reference_id, owner_correct, deadline_correct]')
        prediction, reference, owner, deadline = match
        if type(prediction) is not int or not 0 <= prediction < len(predictions) or not isinstance(reference,str) or reference not in task_map:
            raise ValueError('Unknown prediction or reference')
        if prediction in used_predictions or reference in used_refs:
            raise ValueError('Task matches must be one-to-one')
        used_predictions.add(prediction)
        used_refs.add(reference)
        for value in (owner,deadline):
            if value is not None and type(value) is not bool:
                raise ValueError('Correctness labels must be boolean or null')
        expected = task_map[reference]
        if expected.get('assignee'):
            if owner is None:
                raise ValueError('Labeled owner requires explicit correctness judgment')
            owner_n += 1
            owner_correct += owner
        if expected.get('deadline_iso'):
            if deadline is None:
                raise ValueError('Labeled deadline requires explicit correctness judgment')
            deadline_n += 1
            deadline_correct += deadline
    covered = review['facts']
    if any(not isinstance(f,str) or f not in fact_ids for f in covered) or len(set(covered)) != len(covered):
        raise ValueError('Unknown or duplicate reference fact')
    return {'tp':len(used_refs), 'fp':len(predictions)-len(used_predictions), 'fn':len(tasks)-len(used_refs),
            'owner_correct':owner_correct,'owner_denominator':owner_n,
            'deadline_correct':deadline_correct,'deadline_denominator':deadline_n,
            'covered_facts':len(covered),'reference_facts':len(facts),'unsupported_claims':review['unsupported']}


def _nlp_scores(run, reviews):
    cases = {c['case_id']: c for c in run['cases']}
    result = {}
    for variant in sorted({r['variant'] for r in run['rows'] if r['kind'] == 'nlp_text'}):
        rows = [r for r in run['rows'] if r['kind'] == 'nlp_text' and r['variant'] == variant]
        scored = []
        eligible = True
        for row in rows:
            case = cases[row['case_id']]
            review = reviews.get((row['case_id'],variant))
            # Validate submitted complete matching even if labels are not approved yet.
            score = _score_row(case,row,review) if review and row['status'] == 'ok' else None
            if not case.get('reference_approved') or score is None or row['status'] != 'ok':
                eligible = False
            elif score is not None:
                scored.append(score)
        if not eligible or len(scored) != len(rows):
            result[variant] = {'status':'not_evaluated','attempted':len(rows),
                               'reason':'All rows need successful generation, approved references and completed human review.'}
            continue
        totals = {key:sum(s[key] for s in scored) for key in scored[0]}
        tp,fp,fn = (totals[k] for k in ('tp','fp','fn'))
        totals.update(status='evaluated',attempted=len(rows),
                      precision=tp/(tp+fp) if tp+fp else None, recall=tp/(tp+fn) if tp+fn else None,
                      f1=2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,
                      fact_coverage=totals['covered_facts']/totals['reference_facts'] if totals['reference_facts'] else None)
        result[variant] = totals
    return result


def _cell(value):
    text = value if isinstance(value,str) else json.dumps(value, ensure_ascii=False)
    # Keep formula-like model output as text in spreadsheet programs.
    return "'"+text if text.lstrip().startswith(('=','+','-','@')) else text


def generate_reports(run_dir: Path, *, review_csv: Path | None = None) -> list[Path]:
    root = Path(run_dir).resolve()
    run = json.loads((root/'run.json').read_text(encoding='utf-8'))
    if run.get('schema_version') != 1 or not isinstance(run.get('rows'),list):
        raise ValueError('Expected a version-1 persisted evaluation run')
    reviews = _reviews(review_csv,run)
    asr = {}
    for variant in sorted({r['variant'] for r in run['rows'] if r['kind'] == 'asr'}):
        rows = [r for r in run['rows'] if r['kind'] == 'asr' and r['variant'] == variant]
        totals = aggregate_asr(rows)
        measured = [r for r in rows if r['status']=='ok' and r.get('timing',{}).get('audio_seconds',0)>0]
        duration = sum(r['timing']['audio_seconds'] for r in measured)
        totals['rtf'] = sum(r['timing']['inference_seconds'] for r in measured)/duration if duration else None
        totals['audio_seconds'] = duration
        totals['model_load_seconds'] = sum(r.get('timing',{}).get('load_seconds',0) for r in rows)
        asr[variant] = totals
    summary = {'schema_version':1,'run_id':run['run_id'],'status':run['status'],
               'metadata':run.get('metadata',{}),'config':run.get('config',{}), 'asr':asr,'nlp':_nlp_scores(run,reviews)}
    (root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    with (root/'results.csv').open('w',encoding='utf-8-sig',newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['case_id','kind','variant','status','wer','cer','rtf','output','error'])
        for row in run['rows']:
            writer.writerow([_cell(value) for value in [row['case_id'],row['kind'],row['variant'],row['status'],
                row.get('scores',{}).get('wer',{}).get('rate'),row.get('scores',{}).get('cer',{}).get('rate'),
                row.get('timing',{}).get('rtf'),row.get('output'),row.get('error')]])
    template = root/'review.csv'
    if not template.exists():
        with template.open('w',encoding='utf-8-sig',newline='') as stream:
            writer = csv.DictWriter(stream,fieldnames=REVIEW_FIELDS)
            writer.writeheader()
            for row in run['rows']:
                if row['kind']=='nlp_text':
                    writer.writerow({'case_id':row['case_id'],'variant':row['variant'],'review_complete':'false',
                                     'task_matches':'[]','covered_fact_ids':'[]','unsupported_claims':''})
    limitations = ('Pilot tiếng đọc FLEURS (Google, CC-BY-4.0), không đánh giá diarization hay hội thoại nhiều người. '
                   'CER bỏ khoảng trắng; whitespace-WER tính đơn vị phân cách bằng khoảng trắng, không phải từ vựng tiếng Việt. '
                   'Unicode NFC, casefold, bỏ dấu câu; giữ dấu tiếng Việt và chữ số. '
                   'RTF = tổng thời gian decode + transcription / tổng thời lượng audio; loại thời gian tải và nạp model, '
                   'không có warm-up riêng nên có thể gồm chi phí inference lần đầu. '
                   'Văn bản NLP là synthetic; chưa duyệt nhãn/chấm thủ công thì not_evaluated. '
                   'Chấm một người không đo được độ đồng thuận liên giám khảo; owner/deadline denominator chỉ gồm TP có nhãn tương ứng. '
                   'LLM có tính ngẫu nhiên, không cam kết bit-for-bit. Dòng lỗi luôn giữ trong coverage.')
    header = f'Clarion — Evaluation {run["run_id"]}'
    escaped_summary = escape(json.dumps(summary,ensure_ascii=False,indent=2))
    def rate(value):
        return f'{100*value:.2f}%' if value is not None else '—'
    metric_rows = ''.join(f'<tr><td>{escape(name)}</td><td>{values["completed"]}/{values["attempted"]}</td>'
                          f'<td>{rate(values["cer"]["rate"])}</td><td>{rate(values["wer"]["rate"])}</td>'
                          f'<td>{values["rtf"]:.3f}</td></tr>' if values['rtf'] is not None else
                          f'<tr><td>{escape(name)}</td><td>{values["completed"]}/{values["attempted"]}</td>'
                          f'<td>{rate(values["cer"]["rate"])}</td><td>{rate(values["wer"]["rate"])}</td><td>—</td></tr>'
                          for name,values in asr.items())
    nlp_status = ' · '.join(f'{name}: {value["status"]}' for name,value in summary['nlp'].items())
    cards = []
    markdown = [f'# {header}',limitations,'```json',json.dumps(summary,ensure_ascii=False,indent=2),'```']
    case_map = {c['case_id']:c for c in run.get('cases',[])}
    for row in run['rows']:
        title = f"{row['case_id']} / {row['variant']} — {row['status']}"
        payload = json.dumps({'input':case_map.get(row['case_id']), 'result':row},ensure_ascii=False,indent=2)
        cards.append(f'<details><summary>{escape(title)}</summary><pre>{escape(payload)}</pre></details>')
        markdown.extend([f'## {title}','```json',payload,'```'])
    html = f'''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(header)}</title><style>
body{{font:16px system-ui,sans-serif;background:#eef3f8;color:#162638;margin:0}}main{{max-width:1120px;margin:auto;padding:32px 20px}}
h1{{font-size:30px}}.note,details,.overview{{background:white;border:1px solid #ccd8e4;border-radius:12px;padding:20px;margin:16px 0}}
pre{{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 monospace}}summary{{cursor:pointer;font-weight:650}}.tag{{color:#075b68;font-weight:700}}
table{{border-collapse:collapse;width:100%}}th,td{{padding:12px 8px;text-align:left;border-bottom:1px solid #dce4ed}}.table{{overflow-x:auto}}
</style><main><p class="tag">CLARION · REPRODUCIBLE EVIDENCE</p><h1>{escape(header)}</h1><p class="note">{escape(limitations)}</p>
<section class="overview"><h2>ASR pilot · {escape(str(run.get('metadata',{}).get('device','unknown')))}</h2>
<div class="table"><table><thead><tr><th>Model</th><th>Completed</th><th>CER</th><th>Whitespace-WER</th><th>RTF</th></tr></thead><tbody>{metric_rows}</tbody></table></div>
<p>NLP: {escape(nlp_status or 'not_evaluated')}</p></section><details><summary>Coverage, configuration &amp; provenance</summary><pre>{escaped_summary}</pre></details>
<h2>Raw inputs and outputs · MMR off/on</h2>{''.join(cards)}</main></html>'''
    (root/'report.html').write_text(html,encoding='utf-8')
    (root/'report.md').write_text('\n\n'.join(markdown),encoding='utf-8')
    return [root/name for name in ('report.html','report.md','summary.json','results.csv','review.csv')]
