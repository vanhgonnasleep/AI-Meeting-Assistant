"""Existing pipeline calls, with cache verification and temporary storage."""
import importlib.metadata
import os
from pathlib import Path
import platform
import re
import sys
import tempfile
import time
from urllib.parse import urlsplit

from .manifest import sha256_file


def verify_checkpoint(model, cache: Path, whisper_module):
    if model not in {'tiny', 'base'}:
        raise ValueError('Evaluation supports official tiny/base weights only')
    url = whisper_module._MODELS[model]
    expected = url.split('/')[-2]
    if not re.fullmatch('[a-f0-9]{64}', expected):
        raise RuntimeError('Official model digest unavailable')
    path = Path(cache) / f'{model}.pt'
    if not path.is_file():
        raise RuntimeError(f'{model} checkpoint missing; explicit --allow-model-download required')
    if sha256_file(path) != expected:
        raise RuntimeError(f'{model} checkpoint checksum mismatch; explicit preparation required')
    return {'name': model, 'sha256': expected, 'bytes': path.stat().st_size}


class PipelineAdapter:
    def __init__(self):
        self._temporary = None
        self._modules = None
        self._active_model = None
        self._cache = None

    def preflight(self, models, *, allow_download=False):
        import requests
        import whisper
        import torch
        cache = Path(os.environ.get('XDG_CACHE_HOME', str(Path.home()/'.cache'))) / 'whisper'
        self._cache = cache
        weights = []
        for model in models:
            try:
                info = verify_checkpoint(model, cache, whisper)
            except RuntimeError:
                if not allow_download:
                    raise
                # Only named official weights, with a hard download cap and digest check.
                from .datasets import _atomic_download, _download
                if model not in {'tiny', 'base'}:
                    raise ValueError('Only tiny/base may be prepared')
                cache.mkdir(parents=True, exist_ok=True)
                _atomic_download(whisper._MODELS[model], cache/f'{model}.pt', 400*1024*1024, _download)
                info = verify_checkpoint(model, cache, whisper)
            weights.append(info)
        base = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434').rstrip('/')
        parsed = urlsplit(base)
        if parsed.hostname not in {'localhost', '127.0.0.1', '::1'} or parsed.username or parsed.query:
            raise ValueError('Evaluation requires a local Ollama endpoint')
        response = requests.get(base+'/api/tags', timeout=10)
        response.raise_for_status()
        llm_models = [{'name': m['name'], 'digest': m.get('digest')} for m in response.json().get('models', [])]
        return {'device': 'cuda' if torch.cuda.is_available() else 'cpu',
                'python': platform.python_version(), 'platform': platform.platform(),
                'packages': {name: importlib.metadata.version(name) for name in ('openai-whisper','torch','numpy','requests')},
                'models': weights, 'llm_models': llm_models, 'storage': 'temporary-isolated',
                'cuda_available': torch.cuda.is_available(),
                'gpu': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}

    def _initialize(self):
        if self._modules is not None:
            return self._modules
        if 'app.main' in sys.modules or 'database.db' in sys.modules:
            raise RuntimeError('Run evaluator in a fresh process to isolate application storage')
        root = Path(__file__).resolve().parents[2]
        sys.path.insert(0, str(root/'ai-summary-service'))
        self._temporary = tempfile.TemporaryDirectory(prefix='clarion-evaluation-')
        selected = {'CLARION_DB_PATH': str(Path(self._temporary.name)/'evaluation.db'),
                    'CLARION_DATA_DIR': str(Path(self._temporary.name)/'private'), 'CLARION_AUTH_MODE': 'local'}
        previous = {k: os.environ.get(k) for k in selected}
        try:
            os.environ.update(selected)
            from app import main
            from app.pipeline import transcription, action_items
            self._modules = main, transcription, action_items
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
        return self._modules

    def transcribe(self, case, model):
        _, stt, _ = self._initialize()
        load_seconds = 0.0
        if self._active_model != model:
            import whisper
            verify_checkpoint(model, self._cache, whisper)
            started = time.perf_counter()
            stt.get_whisper_model(model_name=model)
            load_seconds = time.perf_counter()-started
            self._active_model = model
        started = time.perf_counter()
        result = stt.transcribe_audio_detailed(case['audio_path'], model_name=model, language='vi', diarize=False)
        return {'text': result['text'], 'duration': result['duration'], 'segments': result.get('segments', []),
                'inference_seconds': time.perf_counter()-started, 'load_seconds': load_seconds,
                'device': stt.get_whisper_device()}

    def analyze(self, transcript, model):
        main, _, actions = self._initialize()
        started = time.perf_counter()
        output, warnings = {}, []
        try:
            output['summary'] = main.summarize_with_llama(transcript, model_name=model, has_gpu=False, language='vi')
            output['summary_source'] = 'llm'
        except main.AIServiceError:
            output['summary'] = None
            output['summary_source'] = 'error'
            warnings.append('summary_generation_failed')
        # The SDK also accepts OLLAMA_HOST; override it with our preflighted local URL.
        previous = os.environ.get('OLLAMA_BASE_URL')
        os.environ['OLLAMA_BASE_URL'] = main.OLLAMA_BASE_URL
        try:
            detail = actions.extract_action_items_detailed(transcript, model_name=model)
        finally:
            if previous is None:
                os.environ.pop('OLLAMA_BASE_URL', None)
            else:
                os.environ['OLLAMA_BASE_URL'] = previous
        output.update(action_items=detail['items'], generation={k: detail[k] for k in ('source','reason','raw_output')})
        if detail['source'] != 'llm':
            warnings.append('action_items_'+detail['source'])
        output['warnings'] = warnings
        output['status'] = 'partial' if warnings else 'ok'
        output['inference_seconds'] = time.perf_counter()-started
        return output

    def close(self):
        if self._temporary:
            self._temporary.cleanup()
