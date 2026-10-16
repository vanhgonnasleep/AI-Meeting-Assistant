"""Compatibility entry point for ``uvicorn main:app`` and ``python main.py``.

Imports share the actual application module so callers patch its live globals.
"""
import sys
from pathlib import Path
from dotenv import load_dotenv

# Environment variables supplied by the host/Compose take precedence.
load_dotenv(Path(__file__).resolve().parent.parent / '.env', override=False)

from app import main as application

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8002, reload=True)
else:
    sys.modules[__name__] = application
