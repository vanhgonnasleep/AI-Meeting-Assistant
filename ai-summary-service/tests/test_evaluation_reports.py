import csv
import json

import pytest

from scripts.evaluation.reports import generate_reports


def sample(tmp_path, approved=False):
    run = {'schema_version': 1, 'run_id': 'test', 'status': 'partial',
           'metadata': {'device': 'cpu'}, 'config': {'models': ['tiny']},
           'cases': [{'case_id': 'n', 'kind': 'nlp_text', 'transcript': '<script>alert(1)</script>',
                      'reference_approved': approved,
                      'reference_tasks': [{'id':'t1','task':'one','assignee':'Lan','deadline_iso':'2026-10-20'}, {'id':'t2','task':'two'}],
                      'reference_facts': [{'id':'f1','text':'fact'}]}],
           'rows': [{'case_id':'a','kind':'asr','variant':'tiny','status':'error','error':{'code':'failed'}, 'provenance':{'license':'CC-BY-4.0'}},
                    {'case_id':'n','kind':'nlp_text','variant':'mmr_off','status':'ok','output':{'summary':'<script>x</script>','action_items':[{'task':'one'},{'task':'spurious'}],'transcript':'raw'}},
                    {'case_id':'n','kind':'nlp_text','variant':'mmr_on','status':'ok','output':{'summary':'condensed','action_items':[],'transcript':'filtered'}}]}
    (tmp_path/'run.json').write_text(json.dumps(run),encoding='utf-8')
    return run


def review(tmp_path, *, matches=None, facts=None, complete='true'):
    path = tmp_path/'human.csv'
    with path.open('w',newline='',encoding='utf-8') as stream:
        fields = ['case_id','variant','review_complete','task_matches','covered_fact_ids','unsupported_claims']
        writer = csv.DictWriter(stream,fieldnames=fields)
        writer.writeheader()
        writer.writerow(dict(case_id='n',variant='mmr_off',review_complete=complete,
                             task_matches=json.dumps(matches if matches is not None else [[0,'t1',True,False]]),
                             covered_fact_ids=json.dumps(facts if facts is not None else ['f1']),unsupported_claims=1))
    return path


def summary(tmp_path):
    return json.loads((tmp_path/'summary.json').read_text(encoding='utf-8'))


def test_offline_report_truthful_and_escaped(tmp_path):
    sample(tmp_path)
    files = generate_reports(tmp_path)
    assert {p.name for p in files} >= {'report.html','report.md','summary.json','results.csv','review.csv'}
    text = (tmp_path/'report.html').read_text(encoding='utf-8')
    assert '<script>' not in text
    assert '&lt;script&gt;' in text
    assert '<script src=' not in text and '<link ' not in text
    assert 'cpu' in text and 'CC-BY-4.0' in text and 'failed' in text
    assert 'mmr_off' in text and 'mmr_on' in text
    assert summary(tmp_path)['nlp']['mmr_off']['status'] == 'not_evaluated'
    assert summary(tmp_path)['asr']['tiny']['failed'] == 1


def test_approved_complete_matching_known_counts(tmp_path):
    sample(tmp_path, approved=True)
    generate_reports(tmp_path, review_csv=review(tmp_path))
    result = summary(tmp_path)['nlp']['mmr_off']
    assert result['tp'] == result['fp'] == result['fn'] == 1
    assert result['precision'] == result['recall'] == result['f1'] == .5
    assert result['owner_correct'] == 1 and result['owner_denominator'] == 1
    assert result['deadline_correct'] == 0 and result['deadline_denominator'] == 1
    assert result['fact_coverage'] == 1
    assert result['unsupported_claims'] == 1


@pytest.mark.parametrize('approved,complete', [(False,'true'), (True,'false')])
def test_incomplete_or_unapproved_never_scores(tmp_path, approved, complete):
    sample(tmp_path,approved)
    generate_reports(tmp_path,review_csv=review(tmp_path,complete=complete))
    assert 'f1' not in summary(tmp_path)['nlp']['mmr_off']


@pytest.mark.parametrize('matches,facts', [([[0,'t1',True,False],[0,'t2',None,None]],[]),
                                         ([[0,'unknown',True,False]],[]),
                                         ([[99,'t1',True,False]],[]),
                                         ([],['unknown']), ([],['f1','f1'])])
def test_duplicate_unknown_matching_rejected(tmp_path,matches,facts):
    sample(tmp_path,True)
    with pytest.raises(ValueError):
        generate_reports(tmp_path,review_csv=review(tmp_path,matches=matches,facts=facts))


def test_filled_template_not_overwritten(tmp_path):
    sample(tmp_path)
    generate_reports(tmp_path)
    (tmp_path/'review.csv').write_text('human work',encoding='utf-8')
    generate_reports(tmp_path)
    assert (tmp_path/'review.csv').read_text() == 'human work'
