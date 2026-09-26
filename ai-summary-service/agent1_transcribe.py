"""
=====================================================
AGENT 1: SPEECH-TO-TEXT (STT)
Owner: Member 1
Task: Integrate OpenAI Whisper (or equivalent) to transcribe
      audio files (.mp3, .wav, .m4a, .ogg, .flac) into clean text.
=====================================================
"""

import os
import shutil
import tempfile
from pathlib import Path
from typing import Union, Optional, Dict, Any, List, BinaryIO, Tuple
from fastapi import UploadFile
import torch

# Global model cache to avoid re-loading weights on every inference
_MODEL_CACHE: Dict[str, Any] = {}


def ensure_ffmpeg() -> bool:
    """
    Ensures that ffmpeg is available in the system PATH.
    If ffmpeg is not found, dynamically checks imageio_ffmpeg bundled binary
    and adds its location to os.environ["PATH"].
    """
    if shutil.which("ffmpeg"):
        return True

    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_exe)
        standard_name = os.path.join(ffmpeg_dir, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
        
        # If standard executable name doesn't exist, create an alias/copy
        if not os.path.exists(standard_name) and os.path.exists(ffmpeg_exe):
            try:
                shutil.copy2(ffmpeg_exe, standard_name)
            except Exception:
                pass

        if os.path.exists(standard_name) or os.path.exists(ffmpeg_exe):
            if ffmpeg_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
            return True
    except Exception as e:
        print(f"[Agent 1 STT Warning] Could not configure imageio_ffmpeg: {e}")

    return shutil.which("ffmpeg") is not None


def get_whisper_device() -> str:
    """Detects available acceleration hardware (CUDA GPU vs CPU)."""
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_default_model_name() -> str:
    """
    Retrieves default model name from environment or defaults to 'base'.
    Options: 'tiny', 'base', 'small', 'medium', 'large'
    """
    return os.getenv("WHISPER_MODEL", "base")


def get_whisper_model(model_name: Optional[str] = None, device: Optional[str] = None):
    """
    Loads or retrieves cached Whisper model instance.
    Reuses loaded model in memory across multiple requests.
    """
    import whisper

    ensure_ffmpeg()

    if not model_name:
        model_name = get_default_model_name()
    if not device:
        device = get_whisper_device()

    cache_key = f"{model_name}_{device}"
    if cache_key not in _MODEL_CACHE:
        print(f"[Agent 1 STT] Loading Whisper model '{model_name}' on {device.upper()}...")
        _MODEL_CACHE[cache_key] = whisper.load_model(model_name, device=device)
        print(f"[Agent 1 STT] Whisper model '{model_name}' ready.")

    return _MODEL_CACHE[cache_key]


def get_whisper_model_info() -> Dict[str, Any]:
    """Retrieves operational telemetry for health check and diagnostics."""
    device = get_whisper_device()
    return {
        "engine": "OpenAI Whisper",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "default_model": get_default_model_name(),
        "cached_models": list(_MODEL_CACHE.keys()),
        "ffmpeg_available": ensure_ffmpeg()
    }


def _save_input_to_temp(file_input: Union[UploadFile, str, Path, bytes, BinaryIO]) -> Tuple[str, bool]:
    """
    Resolves any accepted input type to a local filesystem path.
    Returns (filepath, is_temporary) so temporary files can be cleaned up reliably.
    """
    # 1. Existing local file path string or Path object
    if isinstance(file_input, (str, Path)):
        resolved_path = str(file_input)
        if os.path.isfile(resolved_path):
            return resolved_path, False
        raise FileNotFoundError(f"Audio file not found at path: {resolved_path}")

    # 2. FastAPI UploadFile object
    if isinstance(file_input, UploadFile) or hasattr(file_input, "file"):
        ext = ".wav"
        if getattr(file_input, "filename", None):
            suffix = Path(file_input.filename).suffix
            if suffix:
                ext = suffix

        # Reset file pointer to beginning
        try:
            file_input.file.seek(0)
        except Exception:
            pass

        temp_file = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        try:
            shutil.copyfileobj(file_input.file, temp_file)
        finally:
            temp_file.close()

        # Reset pointer again for caller reuse if needed
        try:
            file_input.file.seek(0)
        except Exception:
            pass

        return temp_file.name, True

    # 3. Raw audio bytes
    if isinstance(file_input, (bytes, bytearray)):
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        try:
            temp_file.write(file_input)
        finally:
            temp_file.close()
        return temp_file.name, True

    # 4. Binary stream / file-like object
    if hasattr(file_input, "read"):
        try:
            file_input.seek(0)
        except Exception:
            pass

        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        try:
            shutil.copyfileobj(file_input, temp_file)
        finally:
            temp_file.close()
        return temp_file.name, True

    raise TypeError(f"Unsupported audio input type: {type(file_input)}")


def format_timestamp(seconds: float) -> str:
    """Formats seconds into MM:SS or HH:MM:SS format."""
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def transcribe_audio_detailed(
    file_input: Union[UploadFile, str, Path, bytes, BinaryIO],
    model_name: Optional[str] = None,
    language: Optional[str] = None,
    temperature: float = 0.0,
    **whisper_kwargs
) -> Dict[str, Any]:
    """
    Transcribes audio file and returns detailed transcription metadata.

    Args:
        file_input: FastAPI UploadFile, filepath string, Path, bytes, or file-like stream.
        model_name: Whisper model ('tiny', 'base', 'small', 'medium', 'large').
        language: Language code (e.g. 'vi', 'en') or None for auto-detection.
        temperature: Sampling temperature (0.0 for deterministic output).
        **whisper_kwargs: Additional arguments passed to whisper.transcribe().

    Returns:
        dict: {
            "text": str,
            "language": str,
            "segments": List[dict],
            "duration": float
        }
    """
    ensure_ffmpeg()
    model = get_whisper_model(model_name=model_name)
    device = get_whisper_device()
    use_fp16 = (device == "cuda")

    temp_path, is_temp = _save_input_to_temp(file_input)
    try:
        transcribe_options: Dict[str, Any] = {
            "fp16": use_fp16,
            "temperature": temperature,
            **whisper_kwargs
        }
        if language:
            transcribe_options["language"] = language

        result = model.transcribe(temp_path, **transcribe_options)

        segments = []
        for seg in result.get("segments", []):
            start = seg.get("start", 0.0)
            end = seg.get("end", 0.0)
            text = seg.get("text", "").strip()
            segments.append({
                "id": seg.get("id"),
                "start": start,
                "end": end,
                "timestamp": f"[{format_timestamp(start)} - {format_timestamp(end)}]",
                "text": text
            })

        duration = segments[-1]["end"] if segments else 0.0

        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", ""),
            "duration": duration,
            "segments": segments
        }
    except Exception as e:
        raise RuntimeError(f"Transcription failed: {str(e)}") from e
    finally:
        if is_temp and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                print(f"[Agent 1 STT Warning] Failed to delete temp file {temp_path}: {e}")


def transcribe_audio(
    file_input: Union[UploadFile, str, Path, bytes, BinaryIO],
    model_name: Optional[str] = None,
    language: Optional[str] = None,
    include_timestamps: bool = False,
    **kwargs
) -> str:
    """
    Receives an audio file input and returns transcribed text string (raw_transcript).

    Args:
        file_input: FastAPI UploadFile object, file path string, raw audio bytes, or stream.
        model_name: Optional Whisper model size ('tiny', 'base', 'small', 'medium', 'large').
        language: Optional language code ('vi', 'en', etc.) or None for automatic detection.
        include_timestamps: If True, prefixes each segment with its timestamp [MM:SS - MM:SS].

    Returns:
        str: Transcribed meeting transcript text.
    """
    detailed = transcribe_audio_detailed(
        file_input=file_input,
        model_name=model_name,
        language=language,
        **kwargs
    )

    if include_timestamps and detailed.get("segments"):
        timestamped_lines = [
            f"{seg['timestamp']} {seg['text']}"
            for seg in detailed["segments"]
            if seg.get("text")
        ]
        return "\n".join(timestamped_lines)

    return detailed.get("text", "").strip()
