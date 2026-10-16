"""Manual browser QA only: real app/session/storage, local provider adapters.

Run this file explicitly, then Vite with VITE_API_BASE_URL=http://localhost:8882
on localhost:5185. No external provider is contacted. Every database is created
inside a TemporaryDirectory; this fixture is never imported by the application.
"""
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'ai-summary-service'))


def run():
    with TemporaryDirectory(prefix='clarion-browser-auth-') as temporary:
        directory = Path(temporary)
        os.environ.update({
            'CLARION_AUTH_MODE': 'private', 'CLARION_DATA_DIR': str(directory),
            'CLARION_DB_PATH': str(directory / 'legacy.db'),
            'CLARION_PUBLIC_URL': 'http://localhost:8882',
            'CLARION_FRONTEND_URL': 'http://localhost:5185',
            'CORS_ORIGINS': 'http://localhost:5185',
            'GOOGLE_CLIENT_ID': 'browser-qa-only', 'GOOGLE_CLIENT_SECRET': 'browser-qa-only',
            'GITHUB_CLIENT_ID': 'browser-qa-only', 'GITHUB_CLIENT_SECRET': 'browser-qa-only',
        })
        import main
        from app.auth import routes, store
        from database import db, crud
        import uvicorn

        def identity(provider, **kwargs):
            return {'subject': 'qa-' + provider, 'name': 'Alice QA' if provider == 'google' else 'Bob QA',
                    'email': provider + '@example.test'}

        def local_authorization(provider, config, state, verifier):
            return f'{config.public_url}/api/auth/{provider}/callback?' + urlencode({'state': state, 'code': 'browser-fixture'})

        # Substitute only external services; middleware, cookies, callbacks and
        # meeting requests use the production implementations unchanged.
        routes.identify = identity
        routes.authorization_url = local_authorization
        for provider, owner in (('google', 'ALICE'), ('github', 'BOB')):
            session = store.find_session(store.create_session(provider, identity(provider)))
            destination = directory / 'users' / session['id'] / 'meeting.db'
            destination.parent.mkdir(parents=True)
            selection = db.ACTIVE_DB_PATH.set(destination)
            try:
                db.init_db()
                crud.create_meeting(filename=owner + '_ONLY.wav', raw_transcript=owner + ' private planning',
                                    executive_summary=owner + ' private summary', action_items=[{'task': owner + ' follow-up'}])
            finally:
                db.ACTIVE_DB_PATH.reset(selection)
        print('Browser QA: isolated data, mocked identity providers; not an external OAuth verification.')
        uvicorn.run(main.app, host='127.0.0.1', port=8882, access_log=False)


if __name__ == '__main__':
    run()
