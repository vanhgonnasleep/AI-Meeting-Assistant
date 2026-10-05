"""Opt-in local embeddings with bounded work, cache and honest lexical fallback."""
import hashlib
import math
import re
import time
from collections import OrderedDict, deque
from threading import Lock

import requests

MAX_CHUNKS = 256
MAX_DIMENSIONS = 4096
MAX_CACHE_VALUES = 131072
BATCH_SIZE = 32
DEADLINE_SECONDS = 8
MIN_SIMILARITY = 0.45
_cache = OrderedDict()
_cache_lock = Lock()


def clear_embedding_cache():
    with _cache_lock:
        _cache.clear()


def _key(model, text):
    return model, hashlib.sha256(text.encode('utf-8')).digest()


def _unit_vector(value):
    if not isinstance(value, list) or not 1 <= len(value) <= MAX_DIMENSIONS:
        raise ValueError('Invalid embedding dimensions')
    if any(type(x) not in (int, float) or not math.isfinite(x) for x in value):
        raise ValueError('Invalid embedding values')
    norm = math.hypot(*value)
    if not norm or not math.isfinite(norm):
        raise ValueError('Invalid embedding norm')
    return tuple(x / norm for x in value)


def _embeddings(texts, model):
    keys = [_key(model, text) for text in texts]
    with _cache_lock:
        found = {key: _cache[key] for key in keys if key in _cache}
        for key in found:
            _cache.move_to_end(key)
    missing = list(dict.fromkeys(key for key in keys if key not in found))
    source = dict(zip(keys, texts))
    deadline = time.monotonic() + DEADLINE_SECONDS
    fresh = {}
    for start in range(0, len(missing), BATCH_SIZE):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Embedding time limit reached')
        batch = missing[start:start + BATCH_SIZE]
        result = requests.post('http://localhost:11434/api/embed',
                               json={'model': model, 'input': [source[key] for key in batch], 'truncate': False},
                               timeout=remaining)
        result.raise_for_status()
        vectors = result.json().get('embeddings')
        if not isinstance(vectors, list) or len(vectors) != len(batch):
            raise ValueError('Embedding count mismatch')
        fresh.update((key, _unit_vector(vector)) for key, vector in zip(batch, vectors))
    found.update(fresh)
    if len({len(found[key]) for key in keys}) != 1:
        with _cache_lock:
            for key in list(_cache):
                if key[0] == model:
                    del _cache[key]
        raise ValueError('Embedding dimensions changed')
    # Commit only validated batches, capped by total scalar values, not text count.
    with _cache_lock:
        _cache.update(fresh)
        total = sum(len(vector) for vector in _cache.values())
        while total > MAX_CACHE_VALUES:
            _, vector = _cache.popitem(last=False)
            total -= len(vector)
    return [found[key] for key in keys]


def hybrid_retrieve(query, chunks, lexical, model='embeddinggemma', top_k=4):
    """Fuse source ranks; cosine is similarity, never calibrated confidence."""
    if not chunks:
        return lexical, None
    if len(chunks) > MAX_CHUNKS or any(len(item['text']) > 4000 for item in chunks):
        return lexical, 'Semantic search exceeded its source limit; keyword search was used.'
    quoted = re.findall(r'[“"]([^”"]+)[”"]', query)
    anchor = ' '.join(quoted) if quoted else query
    try:
        vectors = _embeddings([anchor, *(item['text'] for item in chunks)], model)
        semantic = []
        for index, vector in enumerate(vectors[1:]):
            similarity = sum(a * b for a, b in zip(vectors[0], vector))
            if similarity >= MIN_SIMILARITY:
                semantic.append((index, similarity))
        semantic.sort(key=lambda item: item[1], reverse=True)
        # Preserve source order even when custom IDs and complete metadata repeat.
        def identity(item):
            return (item.get('id'), item.get('start'), item.get('end'), item.get('timestamp'),
                    item.get('speaker'), item['text'])
        positions = {}
        for index, item in enumerate(chunks):
            positions.setdefault(identity(item), deque()).append(index)
        ranked = {}
        similarities = dict(semantic)
        for rank, item in enumerate(lexical, 1):
            matches = positions.get(identity(item))
            if matches:
                index = matches.popleft()
                ranked[index] = ranked.get(index, 0) + 1 / (60 + rank)
        for rank, (index, _) in enumerate(semantic[:top_k], 1):
            ranked[index] = ranked.get(index, 0) + 1 / (60 + rank)
        selected = sorted(ranked, key=lambda index: (-ranked[index], index))[:top_k]
        return [dict(chunks[index], retrieval='hybrid', rank_score=round(ranked[index], 6),
                     **({'similarity': round(similarities[index], 4)} if index in similarities else {}))
                for index in selected], None
    except (requests.RequestException, ValueError, TypeError, KeyError, AttributeError, TimeoutError, OverflowError):
        return lexical, 'Semantic search is unavailable or returned invalid embeddings; keyword search was used.'
