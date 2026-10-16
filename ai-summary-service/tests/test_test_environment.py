"""The suite must not depend on an owner's deployment or OAuth settings."""
import os
from pathlib import Path
import subprocess
import sys


def test_collection_isolates_personal_hosts_origins_and_provider_credentials():
    setup_path = Path(__file__).with_name('conftest.py')
    script = '''
import os, runpy, sys
os.environ.update({
    'CLARION_ALLOWED_HOSTS': 'owner.example',
    'CORS_ORIGINS': 'https://owner.example',
    'CLARION_AUTH_MODE': 'private',
    'CLARION_PUBLIC_URL': 'https://owner.example',
    'CLARION_FRONTEND_URL': 'https://owner.example',
    'GOOGLE_CLIENT_ID': 'fixture-owner-client',
    'GOOGLE_CLIENT_SECRET': 'fixture-owner-secret',
    'GITHUB_CLIENT_ID': 'fixture-owner-client',
    'GITHUB_CLIENT_SECRET': 'fixture-owner-secret',
})
setup = runpy.run_path(sys.argv[1])
import main
from fastapi.testclient import TestClient
with TestClient(main.app) as client:
    response = client.get('/api/health', headers={'Origin': 'http://localhost:5173'})
    assert response.status_code == 200, response.text
    session = client.get('/api/auth/session').json()
    assert session['mode'] == 'local'
    assert session['providers'] == {'google': False, 'github': False}
'''
    result = subprocess.run([sys.executable, '-c', script, str(setup_path)],
                            cwd=setup_path.parents[2], env=os.environ.copy(),
                            capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr
