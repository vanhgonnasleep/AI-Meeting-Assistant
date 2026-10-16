import json
from pathlib import Path
import subprocess
import sys

from scripts.evaluate_pipeline import main

ROOT = Path(__file__).resolve().parents[2]


def test_help_and_bad_manifest_subprocess(tmp_path):
    result = subprocess.run([sys.executable,'scripts/evaluate_pipeline.py','--help'],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 0 and 'prepare-fleurs' in result.stdout
    invalid = tmp_path/'bad.jsonl'
    invalid.write_text('{}')
    result = subprocess.run([sys.executable,'scripts/evaluate_pipeline.py','run','--manifest',str(invalid)],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 2 and 'Manifest' in result.stderr


def test_offline_missing_cache_fails_without_model_download(tmp_path):
    import os
    environment = dict(os.environ,XDG_CACHE_HOME=str(tmp_path))
    result = subprocess.run([sys.executable,'scripts/evaluate_pipeline.py','preflight','--models','tiny'],env=environment,cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 2
    assert 'missing' in result.stderr and not list(tmp_path.rglob('*.pt'))


def test_injected_subprocess_fixture_writes_reports(tmp_path):
    path = tmp_path/'case.jsonl'
    path.write_text(json.dumps({'case_id':'fixture','kind':'nlp_text','split':'test','transcript':'A fixture, not a measured model run.'}))
    script = '''from scripts.evaluate_pipeline import main
class Adapter:
 def preflight(self,*a,**k): return {'device':'fixture-only'}
 def analyze(self,text,model): return {'summary':text,'action_items':[]}
raise SystemExit(main(['run','--manifest',CASE,'--output',OUTPUT],adapter=Adapter()))
'''.replace('CASE',repr(str(path))).replace('OUTPUT',repr(str(tmp_path/'runs')))
    result = subprocess.run([sys.executable,'-c',script],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode == 0, result.stderr
    run = next((tmp_path/'runs').iterdir())
    assert (run/'report.html').exists() and (run/'results.csv').exists()
    assert json.loads((run/'summary.json').read_text())['nlp']['mmr_off']['status'] == 'not_evaluated'


def test_partial_inference_nonzero(tmp_path):
    path = tmp_path/'case.jsonl'
    path.write_text(json.dumps({'case_id':'fixture','kind':'nlp_text','split':'test','transcript':'Fixture.'}))
    class Adapter:
        def preflight(self,*a,**k): return {}
        def analyze(self,*a): raise RuntimeError('offline')
    assert main(['run','--manifest',str(path),'--output',str(tmp_path/'runs')],adapter=Adapter()) == 1
