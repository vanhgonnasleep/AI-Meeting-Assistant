"""Bounded public FLEURS preparation; never implicitly downloads models."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from .manifest import load_cases, sha256_file

API = 'https://datasets-server.huggingface.co'
PARAMS = {'dataset': 'google/fleurs', 'config': 'vi_vn', 'split': 'test'}
MAX_AUDIO_BYTES = 16 * 1024 * 1024
MAX_PARQUET_BYTES = 800 * 1024 * 1024


def _fetch(url, params):
    import requests
    response = requests.get(url, params=params, timeout=(10, 40))
    response.raise_for_status()
    if len(response.content) > 4 * 1024 * 1024:
        raise ValueError('Oversized dataset metadata')
    return response.json()


def _download(url, target, max_bytes):
    import requests
    # Signed redirect URLs are used in memory only, never written to metadata.
    with requests.get(url, stream=True, timeout=(10, 60)) as response:
        response.raise_for_status()
        if int(response.headers.get('Content-Length', 0)) > max_bytes:
            raise ValueError('Download exceeds size limit')
        size = 0
        with target.open('wb') as out:
            for chunk in response.iter_content(256 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise ValueError('Download exceeds size limit')
                out.write(chunk)


def _atomic_download(url, path, maximum, downloader):
    partial = path.with_suffix(path.suffix + '.part')
    try:
        downloader(url, partial, maximum)
        if not partial.exists() or not 0 < partial.stat().st_size <= maximum:
            raise ValueError('Empty or oversized download')
        partial.replace(path)
    finally:
        partial.unlink(missing_ok=True)


def _parquet_rows(output, limit, fetch, downloader):
    try:
        import pyarrow.parquet as parquet
    except ImportError as exc:
        raise RuntimeError('FLEURS rows API unavailable; install evaluation/requirements.txt for official Parquet fallback') from exc
    metadata = fetch(API + '/parquet', {'dataset': 'google/fleurs'})
    files = sorted((f for f in metadata.get('parquet_files', [])
                    if f.get('config') == 'vi_vn' and f.get('split') == 'test'), key=lambda f: f['filename'])
    if not files or not 0 < files[0]['size'] <= MAX_PARQUET_BYTES:
        raise ValueError('No bounded official Vietnamese test shard')
    source = files[0]
    parsed = urlsplit(source['url'])
    if parsed.scheme != 'https' or parsed.hostname != 'huggingface.co' or parsed.query:
        raise ValueError('Unexpected Parquet source')
    shard = output / 'test-0000.parquet'
    checksum_path = output / 'test-0000.sha256'
    if shard.exists():
        if not checksum_path.exists() or sha256_file(shard) != checksum_path.read_text().strip():
            raise ValueError('Parquet cache checksum mismatch')
    else:
        _atomic_download(source['url'], shard, MAX_PARQUET_BYTES, downloader)
        if shard.stat().st_size != source['size']:
            shard.unlink()
            raise ValueError('Incomplete Parquet shard')
        checksum_path.write_text(sha256_file(shard), encoding='ascii')
    with parquet.ParquetFile(shard) as file:
        batch = next(file.iter_batches(batch_size=limit, columns=['audio', 'transcription']))
        rows = batch.to_pylist()
    if len(rows) < limit:
        raise ValueError('Too few rows in first shard')
    return [{'row_idx': i, 'row': row} for i, row in enumerate(rows)], {
        'parquet_url': source['url'], 'parquet_sha256': sha256_file(shard)}


def prepare_fleurs(output_dir: Path, *, limit: int = 20, fetch_json=None, download=None) -> Path:
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError('Pilot limit must be between 1 and 100')
    output = Path(output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest = output / 'manifest.jsonl'
    if manifest.exists():
        cases = load_cases(manifest)
        if len(cases) != limit:
            raise ValueError('Cached pilot has a different limit; use a new directory')
        for case in cases:
            if sha256_file(Path(case['audio_path'])) != case['audio_sha256']:
                raise ValueError('Audio cache checksum mismatch')
        return manifest
    fetch, downloader = fetch_json or _fetch, download or _download
    extra = {}
    try:
        rows = fetch(API + '/rows', {**PARAMS, 'offset': 0, 'length': limit})['rows']
    except Exception:
        if fetch_json is not None:
            raise
        rows, extra = _parquet_rows(output, limit, fetch, downloader)
    if len(rows) != limit or [r.get('row_idx') for r in rows] != list(range(limit)):
        raise ValueError('Expected the deterministic first test rows')
    cases = []
    for entry in rows:
        index, row = entry['row_idx'], entry['row']
        audio = output / f'fleurs-vi-test-{index:04d}.audio'
        if isinstance(row['audio'], dict) and isinstance(row['audio'].get('bytes'), bytes):
            content = row['audio']['bytes']
            if not 0 < len(content) <= MAX_AUDIO_BYTES:
                raise ValueError('Audio size limit')
            partial = audio.with_suffix('.part')
            partial.write_bytes(content)
            partial.replace(audio)
        else:
            _atomic_download(row['audio'][0]['src'], audio, MAX_AUDIO_BYTES, downloader)
        reference = row['transcription']
        cases.append({'schema_version': 1, 'case_id': f'fleurs-vi-{index:04d}', 'kind': 'asr',
                      'split': 'test', 'audio_path': audio.name, 'audio_sha256': sha256_file(audio),
                      'reference_text': reference, 'reference_approved': False,
                      'provenance': {**PARAMS, 'row_index': index, 'license': 'CC-BY-4.0',
                                     'source_url': 'https://huggingface.co/datasets/google/fleurs',
                                     'reference_sha256': hashlib.sha256(reference.encode()).hexdigest(), **extra}})
    partial_manifest = output / 'manifest.jsonl.part'
    try:
        partial_manifest.write_text(''.join(json.dumps(c, ensure_ascii=False) + '\n' for c in cases), encoding='utf-8')
        load_cases(partial_manifest)
        partial_manifest.replace(manifest)
    finally:
        partial_manifest.unlink(missing_ok=True)
    return manifest
