"""Decode local media to temporary PCM on disk, with finite resource limits."""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from runtime_config import MediaLimitError

SAMPLE_RATE = 16000
DECODE_TIMEOUT_SECONDS = 120


def ffmpeg_executable():
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    # Use the bundled executable directly; never copy into installed packages.
    try:
        import imageio_ffmpeg
        executable = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.isfile(executable):
            return executable
    except (ImportError, RuntimeError, OSError):
        pass
    raise RuntimeError("FFmpeg is required to decode audio.")


class PreparedAudio:
    """Own a decoded file and read only the requested bounded sample windows."""

    def __init__(self, source_path, max_duration_seconds):
        self.source_path = str(Path(source_path).resolve())
        self.max_duration_seconds = max_duration_seconds
        self._scratch = None

    def __enter__(self):
        self._scratch = tempfile.TemporaryDirectory(prefix="meeting-pcm-")
        self.path = os.path.join(self._scratch.name, "audio.pcm")
        try:
            # Decode one second beyond the cap to distinguish rejection from
            # successful processing. Never report a truncated file as success.
            command = [
                ffmpeg_executable(), "-nostdin", "-hide_banner", "-loglevel", "error",
                "-y", "-protocol_whitelist", "file,pipe",
                # Reject reference/playlist demuxers even when disguised with
                # an allowed extension: decode only the uploaded media itself.
                "-format_whitelist", "mp3,wav,mov,ogg,flac,matroska,webm",
                "-i", self.source_path,
                "-map", "0:a:0", "-vn", "-sn", "-dn", "-threads", "1",
                "-t", str(self.max_duration_seconds + 1), "-ac", "1", "-ar", str(SAMPLE_RATE),
                "-acodec", "pcm_s16le", "-f", "s16le", self.path,
            ]
            with tempfile.TemporaryFile(dir=self._scratch.name) as error_output:
                try:
                    result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                            stderr=error_output, timeout=DECODE_TIMEOUT_SECONDS, check=False)
                except subprocess.TimeoutExpired as exc:
                    raise RuntimeError("Audio decoding exceeded its time limit.") from exc
                if result.returncode:
                    error_output.seek(0)
                    detail = error_output.read(4096).decode("utf-8", errors="replace").strip()
                    raise RuntimeError(f"Invalid audio or decoding failed: {detail}")
            self.sample_count = os.path.getsize(self.path) // 2
            self.duration = self.sample_count / SAMPLE_RATE
            if self.duration > self.max_duration_seconds:
                raise MediaLimitError(f"Audio duration exceeds {self.max_duration_seconds:g} seconds.")
            if not self.sample_count:
                raise RuntimeError("Audio contains no decoded samples.")
            return self
        except BaseException:
            self._scratch.cleanup()
            raise

    def __exit__(self, *args):
        self._scratch.cleanup()

    def read_samples(self, start_sample, end_sample):
        import numpy as np
        start = max(0, min(self.sample_count, int(start_sample)))
        end = max(start, min(self.sample_count, int(end_sample)))
        with open(self.path, "rb") as source:
            source.seek(start * 2)
            data = source.read((end - start) * 2)
        return np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0

    def windows(self, chunk_seconds, overlap_seconds=0):
        """Yield integer sample boundaries: core start/end, padded start/end."""
        chunk = max(1, int(chunk_seconds * SAMPLE_RATE))
        overlap = max(0, int(overlap_seconds * SAMPLE_RATE))
        for core_start in range(0, self.sample_count, chunk):
            core_end = min(core_start + chunk, self.sample_count)
            yield (core_start, core_end, max(0, core_start - overlap),
                   min(self.sample_count, core_end + overlap))
