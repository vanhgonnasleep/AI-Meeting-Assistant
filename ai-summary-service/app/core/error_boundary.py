"""Recover known storage failures inside the browser response middleware."""
import logging
import sqlite3

from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class StorageUnavailableError(RuntimeError):
    """A filesystem operation failed while preparing application storage."""


class StorageErrorMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        started = False

        async def tracked_send(message):
            nonlocal started
            if message['type'] == 'http.response.start':
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracked_send)
        except (sqlite3.Error, StorageUnavailableError):
            # A stream that has already started cannot be replaced with JSON.
            # Its endpoint owns any terminal SSE error event.
            if started:
                raise
            logger.exception('Workspace storage request failed')
            headers = {'Cache-Control': 'no-store'}
            account = scope.get('state', {}).get('account')
            if account:
                headers['X-Clarion-Account'] = account['id']
            response = JSONResponse({
                'code': 'workspace_unavailable',
                'detail': 'Your workspace is temporarily unavailable. Keep this page open and try again shortly.',
            }, status_code=503, headers=headers)
            await response(scope, receive, send)
