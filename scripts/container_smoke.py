"""Exercise a disposable Compose stack; no model downloads or third-party services.

The verify phase runs after a backend restart and deletes only its own fixture.
--api-only also allows exercising the API against an isolated local test server.
"""
import argparse
import io
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4
import wave


def request(base, path, *, method='GET', payload=None, data=None, headers=None):
    headers = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode()
        headers['Content-Type'] = 'application/json'
    with urlopen(Request(base + path, data=data, headers=headers, method=method), timeout=60) as response:
        return response.headers.get('Content-Type', ''), response.read()


def as_json(base, path, **kwargs):
    content_type, body = request(base, path, **kwargs)
    assert 'application/json' in content_type, (path, content_type)
    return json.loads(body)


def run(base, state_path, verify=False, api_only=False):
    if verify:
        state = json.loads(state_path.read_text())
        record = as_json(base, f"/api/meetings/{state['id']}")['meeting']
        assert record['filename'] == state['filename']
        assert record['raw_transcript'] == 'The certificate renewal starts Monday.'
        assert record['action_items'][0]['deadline_iso'] == '2026-12-31'
        history = as_json(base, f"/api/meetings/{state['id']}/chat")['chat_history']
        assert [m['role'] for m in history] == ['user', 'assistant']
        # This ID belongs to the fixture created by this exact smoke run.
        as_json(base, f"/api/meetings/{state['id']}", method='DELETE')
        print('PASS: SQLite data and completed chat survived restart; smoke fixture removed.')
        return

    if not api_only:
        content_type, body = request(base, '/')
        assert 'text/html' in content_type and b'clarion' in body.lower()
    as_json(base, '/api/health')
    filename = f'container-smoke-{uuid4()}.wav'
    record = as_json(base, '/api/meetings', method='POST', payload={
        'save_key': str(uuid4()), 'filename': filename, 'raw_transcript': 'The migration rehearsal starts Friday.',
        'action_items': [{'task': 'Review the certificate', 'deadline': '2026-12-31', 'deadline_iso': '2026-12-31'}],
    })['meeting']
    meeting_id = record['id']
    page = as_json(base, '/api/meetings?' + urlencode({'q': 'rehearsal', 'compact': 'true'}))
    assert any(m['id'] == meeting_id for m in page['meetings'])
    as_json(base, f'/api/meetings/{meeting_id}', method='PUT', payload={'raw_transcript': 'The certificate renewal starts Monday.'})
    page = as_json(base, '/api/meetings?' + urlencode({'q': 'renewal', 'compact': 'true'}))
    assert any(m['id'] == meeting_id for m in page['meetings'])

    content_type, body = request(base, '/api/chat/stream', method='POST', payload={
        'question': 'When is the certificate renewal?', 'meeting_id': meeting_id,
        'model': 'clarion-smoke-unavailable',
    })
    assert 'text/event-stream' in content_type
    frames = [json.loads(frame.removeprefix('data: ')) for frame in body.decode().strip().split('\n\n')]
    assert any('token' in event for event in frames)
    assert frames[-1]['done'] and frames[-1]['citations'] and not frames[-1].get('error')
    assert 'chat_history' not in frames[-1]

    audio = io.BytesIO()
    with wave.open(audio, 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(b'\0\0' * 1600)
    boundary = 'clarion-' + uuid4().hex
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="silence.wav"\r\n'
                 'Content-Type: audio/wav\r\n\r\n').encode() + audio.getvalue() + f'\r\n--{boundary}--\r\n'.encode()
    content_type, body = request(base, '/api/transcribe-chunk', method='POST', data=multipart,
                                headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    assert 'application/json' in content_type and json.loads(body)['text'] == ''
    state_path.write_text(json.dumps({'id': meeting_id, 'filename': filename}))
    ui_status = '' if api_only else 'static UI, '
    print(f'PASS: {ui_status}API, FTS update triggers, SSE/citations and RAM silence decode. Restart backend and run --verify.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:5173')
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--api-only', action='store_true')
    args = parser.parse_args()
    run(args.base_url.rstrip('/'), args.state, args.verify, args.api_only)
