"""Sequential experiments with frozen inputs and incremental failure evidence."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

from .adapters import PipelineAdapter
from .manifest import load_cases, sha256_file
from .metrics import edit_counts


def safe_provenance(source):
    result = {}
    for key in ('source_url','license','dataset','config','split','source_revision','row_index','reference_sha256','parquet_url','parquet_sha256'):
        value = source.get(key)
        if isinstance(value, (str, int, float, bool)) or value is None and key in source:
            if key.endswith('url') and isinstance(value, str):
                parts = urlsplit(value)
                value = urlunsplit((parts.scheme, parts.hostname or '', parts.path, '', '')) if parts.scheme else parts.path
            result[key] = value
    return result


def _write_run(path, run):
    temporary = path/'run.json.part'
    temporary.write_text(json.dumps(run, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    temporary.replace(path/'run.json')


def _git_metadata():
    root = Path(__file__).resolve().parents[2]
    try:
        revision = subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True).strip()
        dirty = bool(subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True).strip())
        return {'revision': revision, 'dirty': dirty}
    except (OSError, subprocess.SubprocessError):
        return {'revision': None, 'dirty': None}


def run_evaluation(manifest_paths: list[Path], output_root: Path, *, models: list[str], llm_model: str,
                   allow_download=False, adapter=None) -> Path:
    if not models or len(set(models)) != len(models) or any(m not in {'tiny','base'} for m in models):
        raise ValueError('Choose unique tiny/base ASR models')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}', llm_model):
        raise ValueError('Invalid local model name')
    cases = [case for manifest in manifest_paths for case in load_cases(manifest)]
    if len({c['case_id'] for c in cases}) != len(cases):
        raise ValueError('Duplicate case IDs across manifests')
    root = Path(output_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:10]
    path = root/run_id
    path.mkdir()
    (path/'inputs').mkdir()
    run = {'schema_version': 1, 'run_id': run_id, 'status': 'preflight', 'metadata': {'git': _git_metadata()},
           'config': {'models': models, 'llm_model': llm_model, 'language': 'vi', 'diarize': False,
                      'mmr_lambda': .65, 'mmr_ratio': .55, 'allow_model_download': bool(allow_download)},
           'cases': [], 'rows': []}
    audio_errors = set()
    for original in cases:
        case = dict(original)
        case['provenance'] = safe_provenance(case['provenance'])
        if case['kind'] == 'asr':
            audio = Path(case['audio_path'])
            target = path/'inputs'/f"{case['case_id']}.audio"
            try:
                if not case.get('audio_sha256') or sha256_file(audio) != case['audio_sha256']:
                    raise ValueError('Audio checksum mismatch or missing')
                shutil.copyfile(audio, target)
                if sha256_file(target) != case['audio_sha256']:
                    raise ValueError('Frozen audio checksum mismatch')
            except (OSError, ValueError):
                audio_errors.add(case['case_id'])
            case['audio_path'] = target.relative_to(path).as_posix()
        run['cases'].append(case)
    (path/'manifest.jsonl').write_text(''.join(json.dumps(c, ensure_ascii=False)+'\n' for c in run['cases']), encoding='utf-8')
    run['manifest_sha256'] = sha256_file(path/'manifest.jsonl')
    _write_run(path, run)
    active = adapter or PipelineAdapter()

    def append(row):
        with (path/'rows.jsonl').open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(row, ensure_ascii=False, allow_nan=False)+'\n')
            stream.flush()
        run['rows'].append(row)
        _write_run(path, run)

    try:
        metadata = active.preflight(models, allow_download=allow_download)
        run['metadata'].update({k: metadata[k] for k in ('device','python','platform','packages','models','llm_models','storage','cuda_available','gpu') if k in metadata})
        available = metadata.get('llm_models')
        if available is not None and not any(m['name'] == llm_model for m in available):
            raise RuntimeError('Requested LLM is not installed; no automatic pull')
        run['status'] = 'running'
        _write_run(path, run)
        for model in models:
            for case in run['cases']:
                if case['kind'] != 'asr':
                    continue
                row = {'case_id': case['case_id'], 'kind': 'asr', 'variant': model, 'status': 'error',
                       'provenance': case['provenance'], 'warnings': [], 'scores': {}, 'timing': {}}
                try:
                    if case['case_id'] in audio_errors:
                        raise ValueError('Audio checksum mismatch')
                    result = active.transcribe({**case, 'audio_path': str(path/case['audio_path'])}, model)
                    duration, seconds = result['duration'], result['inference_seconds']
                    row.update(status='ok', output={'text': result['text'], 'segments': result.get('segments', [])},
                               timing={'audio_seconds': duration, 'inference_seconds': seconds,
                                       'load_seconds': result['load_seconds'], 'rtf': seconds/duration if duration > 0 else None},
                               device=result['device'], scores={name: edit_counts(case['reference_text'], result['text'], unit=unit)
                                                              for name, unit in [('wer','words'),('cer','characters')]})
                except Exception as exc:
                    row['error'] = {'type': type(exc).__name__, 'code': 'audio_integrity' if case['case_id'] in audio_errors else 'transcription_failed'}
                append(row)
        from sys import path as module_path
        module_path.insert(0, str(Path(__file__).resolve().parents[2]/'ai-summary-service'))
        from app.pipeline.mmr import MMRExtractor
        for case in run['cases']:
            if case['kind'] != 'nlp_text':
                continue
            for variant in ('mmr_off','mmr_on'):
                row = {'case_id': case['case_id'], 'kind': 'nlp_text', 'variant': variant, 'status': 'error',
                       'provenance': case['provenance'], 'warnings': [], 'timing': {}}
                try:
                    source = case['transcript']
                    telemetry = {'applied': False, 'reason': 'disabled'}
                    if variant == 'mmr_on':
                        source, telemetry = MMRExtractor(lambda_param=.65).extract_key_sentences(source, target_ratio=.55)
                    row['mmr'] = {**telemetry, 'lambda_param': .65, 'target_ratio': .55}
                    result = active.analyze(source, llm_model)
                    row.update(status=result.get('status', 'ok'), output={**result, 'transcript': source},
                               warnings=result.get('warnings', []), timing={'inference_seconds': result.get('inference_seconds')})
                except Exception as exc:
                    row['error'] = {'type': type(exc).__name__, 'code': 'analysis_failed'}
                append(row)
        run['status'] = 'complete' if all(r['status'] == 'ok' for r in run['rows']) else 'partial'
    except KeyboardInterrupt:
        run['status'] = 'interrupted'
        raise
    except Exception as exc:
        run['status'] = 'failed'
        run['error'] = {'type': type(exc).__name__, 'code': 'preflight_or_runner_failed'}
        raise
    finally:
        _write_run(path, run)
        if hasattr(active, 'close'):
            active.close()
    return path
