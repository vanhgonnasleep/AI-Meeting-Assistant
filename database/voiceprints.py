"""Named acoustic centroids shared by enrollment and diarization."""
import json
import math

from .db import get_connection


def normalized_embedding(values):
    if not isinstance(values, (list, tuple)) or not 1 <= len(values) <= 4096:
        raise ValueError('Embedding must contain 1–4096 finite numbers')
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
        raise ValueError('Embedding must contain finite numbers')
    norm = math.hypot(*values)
    if norm < 1e-8 or not math.isfinite(norm):
        raise ValueError('Embedding must have a finite nonzero norm')
    return [v / norm for v in values]


def _upsert_speaker_profile(connection, name, embedding):
    name = name.strip() if isinstance(name, str) else ''
    if not name or len(name) > 128 or any(ord(c) < 32 for c in name):
        raise ValueError('A short speaker name is required')
    vector = normalized_embedding(embedding)
    row = connection.execute('SELECT embedding, sample_count FROM speaker_profiles WHERE name=?', (name,)).fetchone()
    count = 1
    if row:
        previous = json.loads(row['embedding'])
        if len(previous) != len(vector):
            raise ValueError('Profile embedding dimension changed')
        old_count = row['sample_count']
        vector = normalized_embedding([a * old_count + b for a, b in zip(previous, vector)])
        count = old_count + 1
    connection.execute('''INSERT INTO speaker_profiles(name, embedding, sample_count, updated_at)
        VALUES(?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET
        embedding=excluded.embedding, sample_count=excluded.sample_count, updated_at=CURRENT_TIMESTAMP''',
        (name, json.dumps(vector, allow_nan=False), count))


def upsert_speaker_profile(name, embedding):
    connection = get_connection()
    try:
        connection.execute('BEGIN IMMEDIATE')
        _upsert_speaker_profile(connection, name, embedding)
        connection.commit()
    finally:
        connection.close()


def get_speaker_profiles():
    connection = get_connection()
    try:
        profiles = []
        for row in connection.execute('SELECT * FROM speaker_profiles ORDER BY id'):
            try:
                profiles.append({**dict(row), 'embedding': normalized_embedding(json.loads(row['embedding']))})
            except (ValueError, TypeError, json.JSONDecodeError):
                continue
        return profiles
    finally:
        connection.close()


def match_speaker_profile(embedding, threshold=0.82):
    vector = normalized_embedding(embedding)
    best, score = None, threshold
    for profile in get_speaker_profiles():
        if len(profile['embedding']) != len(vector):
            continue
        similarity = sum(a * b for a, b in zip(vector, profile['embedding']))
        if similarity > score:
            best, score = profile['name'], similarity
    return best
