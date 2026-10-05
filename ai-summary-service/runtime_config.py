"""Validated process-wide media budgets; restart the backend after changes."""
import os


class MediaLimitError(ValueError):
    """Decoded media exceeds the configured processing limits."""


def _integer_setting(name, default, minimum, maximum):
    text = os.environ.get(name, str(default)).strip()
    if not text.isascii() or not text.isdecimal():
        raise ValueError(f'{name} must be an integer between {minimum} and {maximum}.')
    value = int(text)
    if not minimum <= value <= maximum:
        raise ValueError(f'{name} must be an integer between {minimum} and {maximum}.')
    return value


MAX_UPLOAD_MB = _integer_setting('MAX_UPLOAD_MB', 256, 1, 1024)
MAX_AUDIO_DURATION_SECONDS = _integer_setting('MAX_AUDIO_DURATION_SECONDS', 10800, 60, 21600)
AUDIO_CHUNK_SECONDS = _integer_setting('AUDIO_CHUNK_SECONDS', 300, 30, 600)
MAX_FILE_SIZE_BYTES = MAX_UPLOAD_MB * 1024 * 1024
