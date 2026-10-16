from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import database.crud as crud
from database.db import get_connection
import main


def test_filter_and_sort_happen_before_pagination():
    ids = [crud.create_meeting(filename=f'meeting-{i}', raw_transcript='migration', duration=10 * i,
                               action_items=[{'task': 'Ship'}] * i) for i in range(1, 5)]
    with get_connection() as connection:
        connection.execute("INSERT INTO projects(name, name_key) VALUES('Clarion Core Platform', 'clarion core platform')")
        for i, mid in enumerate(ids):
            created = datetime.now(timezone.utc) - timedelta(days=i * 10)
            connection.execute('UPDATE meetings SET created_at=?, project_id=? WHERE id=?', (created.isoformat(), 1 if i < 3 else None, mid))
    client = TestClient(main.app)
    data = client.get('/api/meetings', params={'project': 'Clarion Core Platform', 'sort': 'duration', 'limit': 1, 'offset': 1, 'compact': True}).json()
    assert data['total'] == 3 and data['meetings'][0]['id'] == ids[1]
    assert data['meetings'][0]['project_id'] == 1
    assert client.get('/api/meetings', params={'days': 7}).json()['total'] == 1
    assert client.get('/api/meetings', params={'days': 30, 'project': 'Clarion Core Platform'}).json()['total'] == 3
    assert client.get('/api/meetings', params={'sort': 'tasks'}).json()['meetings'][0]['id'] == ids[-1]
    assert client.get('/api/meetings', params={'sort': 'oldest'}).json()['meetings'][0]['id'] == ids[-1]
    assert client.get('/api/meetings', params={'q': 'migration', 'days': 7, 'project': 'Missing'}).json()['total'] == 0


def test_invalid_library_controls_are_rejected():
    client = TestClient(main.app)
    for params in ({'sort': 'DROP TABLE meetings'}, {'days': 0}, {'days': -1}):
        assert client.get('/api/meetings', params=params).status_code == 422


def test_task_sort_tolerates_malformed_legacy_json():
    mid = crud.create_meeting(filename='legacy')
    with get_connection() as connection:
        connection.execute('UPDATE meetings SET action_items=? WHERE id=?', ('not json', mid))
    response = TestClient(main.app).get('/api/meetings?sort=tasks&compact=true')
    assert response.status_code == 200 and response.json()['meetings'][0]['action_item_count'] == 0
