"""Bound request ingestion and reject browser requests from untrusted origins."""
from starlette.exceptions import HTTPException
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from threading import BoundedSemaphore


class RequestLimitsMiddleware:
    def __init__(self, app, allowed_origins, upload_limit, json_limit=4 * 1024 * 1024):
        self.app = app
        self.allowed_origins = set(allowed_origins)
        self.upload_limit = upload_limit
        self.json_limit = json_limit
        self.compute_slots = BoundedSemaphore(2)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        origin = headers.get("origin")
        if origin and origin not in self.allowed_origins:
            return await JSONResponse({"detail": "Browser origin is not allowed."}, status_code=403)(scope, receive, send)
        limit = self.upload_limit if headers.get("content-type", "").startswith("multipart/form-data") else self.json_limit
        # A saved long-meeting snapshot includes source metadata as well as text.
        # Keep other JSON routes at their existing 4 MiB budget.
        if scope.get("method") == "POST" and scope.get("path") == "/api/meetings":
            limit = 16 * 1024 * 1024
        try:
            declared_size = int(headers.get("content-length", "0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length."}, status_code=400)(scope, receive, send)
        if declared_size < 0 or declared_size > limit:
            return await JSONResponse({"detail": "Request body is too large."}, status_code=413)(scope, receive, send)
        received = 0

        async def bounded_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(413, "Request body is too large.")
            return message

        path = scope.get("path", "")
        needs_compute = scope.get("method") == "POST" and (
            path in {"/api/chat", "/api/process-audio", "/api/transcribe"}
            or (path.startswith("/api/meetings/") and path.endswith(("/chat", "/regenerate-summary")))
        )
        if needs_compute and not self.compute_slots.acquire(blocking=False):
            return await JSONResponse(
                {"detail": "AI processing is busy. Please retry shortly."}, status_code=503,
                headers={"Retry-After": "5"},
            )(scope, receive, send)
        try:
            await self.app(scope, bounded_receive, send)
        finally:
            if needs_compute:
                self.compute_slots.release()
