"""
=====================================================
AGENT 1: SPEECH-TO-TEXT (STT)
Owner: Triệu Quang Thiện (Agent 1)
Task: Integrate OpenAI Whisper (or equivalent) to transcribe
      audio files (.mp3, .wav, .m4a, .ogg, .flac) into clean text.
=====================================================
"""

import os
import shutil
import tempfile
from threading import Lock
from pathlib import Path
from typing import Union, Optional, Dict, Any, List, BinaryIO, Tuple
from fastapi import UploadFile

# Safe import for PyTorch to allow running on lightweight/CPU-only devices
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False

# Global model cache to avoid re-loading weights on every inference
_MODEL_CACHE: Dict[str, Any] = {}
_MODEL_LOAD_LOCK = Lock()


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
    if TORCH_AVAILABLE and torch is not None and torch.cuda.is_available():
        return "cuda"
    return "cpu"


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
    try:
        import whisper
    except ImportError as e:
        raise RuntimeError("OpenAI Whisper package is not installed. Run 'pip install openai-whisper'.") from e

    ensure_ffmpeg()

    if not model_name:
        model_name = get_default_model_name()
    if not device:
        device = get_whisper_device()

    if model_name not in whisper.available_models():
        raise ValueError("Choose a supported Whisper model name; local checkpoint paths are not accepted.")

    cache_key = f"{model_name}_{device}"
    with _MODEL_LOAD_LOCK:
        if cache_key not in _MODEL_CACHE:
            # Keep one resident model, rather than accumulating all requested weights.
            _MODEL_CACHE.clear()
            print(f"[Agent 1 STT] Loading Whisper model '{model_name}' on {device.upper()}...")
            _MODEL_CACHE[cache_key] = whisper.load_model(model_name, device=device)
            print(f"[Agent 1 STT] Whisper model '{model_name}' ready.")
        return _MODEL_CACHE[cache_key]


def get_whisper_model_info() -> Dict[str, Any]:
    """Retrieves operational telemetry for health check and diagnostics."""
    device = get_whisper_device()
    cuda_avail = bool(TORCH_AVAILABLE and torch is not None and torch.cuda.is_available())
    
    try:
        import whisper
        whisper_installed = True
    except ImportError:
        whisper_installed = False

    return {
        "engine": "OpenAI Whisper",
        "device": device,
        "cuda_available": cuda_avail,
        "whisper_installed": whisper_installed,
        "default_model": get_default_model_name(),
        "cached_models": list(_MODEL_CACHE.keys()),
        "ffmpeg_available": ensure_ffmpeg(),
        "speaker_diarization_supported": True
    }


# =====================================================
# SPEAKER DIARIZATION (Acoustic Clustering & Turns)
# =====================================================
import re

_SENTENCE_BOUNDARY_REGEX = re.compile(
    r'(?<=[.?!])\s+(?=[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ0-9"“\'])'
)


def split_segments_into_sentences(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Subdivides coarse Whisper segments into individual sentence units with interpolated timestamps.
    Prevents dialogue turns between multiple speakers from being lumped into a single segment.
    """
    refined: List[Dict[str, Any]] = []
    seg_id = 0

    for seg in segments:
        text = seg.get("text", "").strip()
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        dur = max(0.1, end - start)

        parts = [p.strip() for p in _SENTENCE_BOUNDARY_REGEX.split(text) if p.strip()]
        if not parts:
            parts = [s.strip() for s in re.split(r'(?<=[.?!])\s+', text) if s.strip()]

        if len(parts) <= 1 or dur < 2.0:
            item = dict(seg)
            item["id"] = seg_id
            seg_id += 1
            refined.append(item)
            continue

        total_chars = sum(max(1, len(p)) for p in parts)
        curr_t = start

        for idx, part in enumerate(parts):
            fraction = len(part) / max(1, total_chars)
            part_dur = dur * fraction
            part_end = curr_t + part_dur if idx < len(parts) - 1 else end

            refined.append({
                "id": seg_id,
                "start": round(curr_t, 2),
                "end": round(part_end, 2),
                "timestamp": f"[{format_timestamp(curr_t)} - {format_timestamp(part_end)}]",
                "text": part
            })
            seg_id += 1
            curr_t = part_end

    return refined


def extract_segment_embedding(
    mel: Any,
    start_sec: float,
    end_sec: float
) -> Any:
    """
    Extracts a normalized multi-scale acoustic feature vector for a segment 
    from Whisper's 80-channel log-mel spectrogram.
    Captures formant profiles, pitch/brightness centroid, and spectral tilt.
    """
    if not TORCH_AVAILABLE or torch is None:
        raise RuntimeError("PyTorch is required for acoustic embedding extraction.")

    # 100 frames per second in Whisper log-mel spectrogram
    f_start = max(0, int(start_sec * 100))
    f_end = min(mel.shape[1], int(end_sec * 100))
    if f_end <= f_start:
        f_end = min(mel.shape[1], f_start + 5)

    mel_slice = mel[:, f_start:f_end]
    if mel_slice.shape[1] == 0:
        return torch.zeros(165, device=mel.device)

    mean_profile = mel_slice.mean(dim=1)
    std_profile = mel_slice.std(dim=1, unbiased=False)

    # Vocal brightness / pitch centroid proxy
    freq_indices = torch.arange(80, dtype=torch.float32, device=mel.device)
    total_energy = mean_profile.abs().sum() + 1e-6
    centroid = (mean_profile * freq_indices).sum() / total_energy

    # 3-band energy distribution: low (0-25), mid (25-55), high (55-80)
    low_band = mel_slice[:25].mean()
    mid_band = mel_slice[25:55].mean()
    high_band = mel_slice[55:].mean()
    spectral_tilt = low_band - high_band

    extra = torch.stack([centroid, low_band, mid_band, high_band, spectral_tilt])
    feat = torch.cat([mean_profile, std_profile, extra])
    norm = torch.norm(feat, p=2)
    if norm > 1e-8:
        feat = feat / norm
    return feat


def cluster_speaker_embeddings(
    embeddings: List[Any],
    num_speakers: Optional[int] = None,
    distance_threshold: float = 0.12
) -> List[int]:
    """
    Agglomerative Hierarchical Clustering with Cosine Distance.
    Clusters segment embeddings into discrete speakers.
    
    Args:
        embeddings: List of normalized acoustic feature tensors.
        num_speakers: Target speaker count. If None, auto-detects via distance_threshold.
        distance_threshold: Maximum cosine distance (1.0 - cosine_sim) to merge clusters.
        
    Returns:
        List of 0-based speaker IDs ordered chronologically by first appearance.
    """
    n = len(embeddings)
    if n == 0:
        return []
    if n == 1:
        return [0]
    # Edge case: caller explicitly wants exactly 1 speaker → all same label
    if num_speakers == 1:
        return [0] * n

    vecs = []
    for e in embeddings:
        norm = torch.norm(e, p=2)
        vecs.append(e / norm if norm > 1e-8 else e)

    clusters = [[i] for i in range(n)]
    centroids = [v.clone() for v in vecs]

    while len(clusters) > 1:
        if num_speakers is not None and len(clusters) <= num_speakers:
            break

        min_dist = float('inf')
        best_pair = (-1, -1)

        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                sim = torch.dot(centroids[i], centroids[j]).item()
                dist = max(0.0, 1.0 - sim)
                if dist < min_dist:
                    min_dist = dist
                    best_pair = (i, j)

        if num_speakers is None and min_dist > distance_threshold:
            break

        i, j = best_pair
        clusters[i].extend(clusters[j])
        all_cluster_vecs = torch.stack([vecs[idx] for idx in clusters[i]])
        merged_centroid = all_cluster_vecs.mean(dim=0)
        norm_c = torch.norm(merged_centroid, p=2)
        centroids[i] = merged_centroid / (norm_c + 1e-8)

        del clusters[j]
        del centroids[j]

    # Order clusters chronologically by their earliest appearance
    clusters.sort(key=lambda cl: min(cl))
    labels = [0] * n
    for speaker_id, cl in enumerate(clusters):
        for idx in cl:
            labels[idx] = speaker_id

    return labels


def refine_speakers_with_llm(
    segments: List[Dict[str, Any]],
    model_name: Optional[str] = None,
    api_url: str = "http://localhost:11434/api/generate",
    timeout_sec: float = 20.0
) -> List[Dict[str, Any]]:
    """
    Leverages local LLM (Llama 3 via Ollama) to disambiguate speaker turns based on
    conversational context, questions vs answers, and self-introductions.
    Corrects misattributed turns and resolves real participant names when spoken.
    """
    if not segments:
        return segments

    try:
        import requests
        import json

        # Process in chunks of up to 40 segments to keep prompt focused and latency low (<3-5s)
        chunk_size = 40
        total = len(segments)
        for offset in range(0, total, chunk_size):
            chunk = segments[offset:offset + chunk_size]
            numbered_lines = "\n".join(
                f"{i + 1}. [{seg.get('speaker', 'Unknown')}]: {seg.get('text', '')}"
                for i, seg in enumerate(chunk)
            )

            prompt = f"""You are an expert dialogue diarization AI.
Given this numbered conversation with initial speaker tags:

{numbered_lines}

Identify who speaks each line based on:
1. Self-introductions (e.g. "My name is Kai" -> "Kai", "My name is Earl" -> "Earl", "Captain Mike Bradley" -> "Captain Mike Bradley").
2. Contextual continuity (a speaker making claims or telling a story remains that speaker until another responds).
3. Question/Answer and reaction turns ("Why did that story give me chills?" is the listener reacting to the story teller).

Return a JSON array of objects mapping line number to speaker name:
[
  {{"line": 1, "speaker": "Kai"}},
  {{"line": 2, "speaker": "Kai"}}
]
Return ONLY the JSON array."""

            model_to_use = model_name if (model_name and model_name != "auto") else "llama3.2:1b"
            res = requests.post(
                api_url,
                json={
                    "model": model_to_use,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False
                },
                timeout=timeout_sec
            )

            if res.status_code == 200:
                raw_resp = res.json().get("response", "").strip()
                parsed = None
                try:
                    parsed = json.loads(raw_resp)
                except Exception:
                    m = re.search(r'\[\s*\{.*?\}\s*\]', raw_resp, re.DOTALL)
                    if m:
                        try:
                            clean_m = re.sub(r',\s*([\]\}])', r'\1', m.group(0))
                            parsed = json.loads(clean_m)
                        except Exception:
                            pass

                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, dict) and "line" in item and "speaker" in item:
                            line_no = int(item["line"]) - 1
                            spk = str(item["speaker"]).strip()
                            global_idx = offset + line_no
                            if 0 <= global_idx < len(segments) and spk and len(spk) <= 30:
                                # Standardize speaker label
                                clean_spk = re.sub(r'^(Speaker\s*\d*[:\s]*|Person\s*\d*[:\s]*)', '', spk, flags=re.IGNORECASE).strip()
                                segments[global_idx]["speaker"] = clean_spk if clean_spk else spk

    except Exception as e:
        print(f"[Agent 1 STT Info] LLM conversational diarization skipped/fallback: {e}")

    return segments


def diarize_segments(
    segments: List[Dict[str, Any]],
    audio_path: str,
    num_speakers: Optional[int] = None,
    distance_threshold: float = 0.12,
    subdivide_sentences: bool = True,
    use_llm_refinement: bool = True,
    llm_model: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Enriches segment metadata with speaker tags ('Speaker 1', 'Speaker 2', etc.).
    First subdivides coarse segments by sentences to avoid merging dialogue turns,
    then clusters acoustic features, and finally refines conversational turns using local LLM.
    
    Args:
        segments: List of Whisper segments.
        audio_path: Local filesystem path to the audio file.
        num_speakers: Optional expected number of speakers.
        distance_threshold: Cosine distance threshold for auto-clustering.
        subdivide_sentences: If True, breaks segments down at sentence boundaries.
        use_llm_refinement: If True, uses local LLM to disambiguate dialogue turns.
        llm_model: Model name for LLM dialogue refinement (defaults to active Ollama model).
        
    Returns:
        Tuple: (enriched_segments, unique_speakers)
    """
    if not segments:
        return [], []

    try:
        import whisper
        ensure_ffmpeg()

        # Step 1: Subdivide coarse segments by sentences so each turn is isolated
        if subdivide_sentences:
            segments = split_segments_into_sentences(segments)

        audio = whisper.load_audio(audio_path)
        mel = whisper.log_mel_spectrogram(audio)

        embeddings = [
            extract_segment_embedding(mel, seg.get("start", 0.0), seg.get("end", 0.0))
            for seg in segments
        ]
        speaker_indices = cluster_speaker_embeddings(
            embeddings,
            num_speakers=num_speakers,
            distance_threshold=distance_threshold
        )

        for seg, idx in zip(segments, speaker_indices):
            seg["speaker"] = f"Speaker {idx + 1}"

        # Step 3: Conversational semantic turn disambiguation via local LLM
        if use_llm_refinement:
            segments = refine_speakers_with_llm(segments, model_name=llm_model)

        unique_speakers = list(dict.fromkeys(seg["speaker"] for seg in segments if seg.get("speaker")))
        return segments, unique_speakers
    except Exception as e:
        print(f"[Agent 1 STT Warning] Diarization fallback triggered: {e}")
        for seg in segments:
            seg["speaker"] = "Speaker 1"
        return segments, ["Speaker 1"]


def format_diarized_transcript(
    segments: List[Dict[str, Any]],
    merge_consecutive: bool = True,
    max_pause_sec: float = 1.8,
    max_turn_words: int = 40
) -> str:
    """
    Formats segmented transcript into a clean speaker-attributed script.
    Prevents runaway turns by respecting conversational pauses (>1.8s) and length limits (<40 words).

    Example:
        [00:00 - 00:05] Speaker 1: Hello everyone, welcome to the meeting.
        [00:05 - 00:12] Speaker 2: Thanks. Today I will present Q3 results.
    """
    if not segments:
        return ""

    if not merge_consecutive:
        lines = [
            f"{seg.get('timestamp', '')} {seg.get('speaker', 'Speaker 1')}: {seg.get('text', '').strip()}"
            for seg in segments
            if seg.get("text", "").strip()
        ]
        return "\n".join(lines)

    turns = []
    current_turn = None

    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        speaker = seg.get("speaker", "Speaker 1")
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))

        # Check conditions to merge with current turn
        is_same_speaker = bool(current_turn and current_turn["speaker"] == speaker)
        pause_gap = (start - current_turn["end"]) if current_turn else 0.0
        current_words = len(current_turn["text"].split()) if current_turn else 0

        # Only merge if: same speaker AND pause is small (<1.8s) AND turn hasn't grown too long (<40 words)
        if is_same_speaker and pause_gap < max_pause_sec and (current_words + len(text.split())) <= max_turn_words:
            current_turn["end"] = end
            current_turn["text"] += " " + text
        else:
            if current_turn:
                turns.append(current_turn)
            current_turn = {
                "speaker": speaker,
                "start": start,
                "end": end,
                "text": text
            }

    if current_turn:
        turns.append(current_turn)

    formatted_lines = [
        f"[{format_timestamp(t['start'])} - {format_timestamp(t['end'])}] {t['speaker']}: {t['text']}"
        for t in turns
    ]
    return "\n".join(formatted_lines)


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
    diarize: bool = False,
    num_speakers: Optional[int] = None,
    distance_threshold: float = 0.12,
    llm_model: Optional[str] = None,
    **whisper_kwargs
) -> Dict[str, Any]:
    """
    Transcribes audio file and returns detailed transcription metadata.

    Args:
        file_input: FastAPI UploadFile, filepath string, Path, bytes, or file-like stream.
        model_name: Whisper model ('tiny', 'base', 'small', 'medium', 'large').
        language: Language code (e.g. 'vi', 'en') or None for auto-detection.
        temperature: Sampling temperature (0.0 for deterministic output).
        diarize: If True, identifies distinct speakers ('Speaker 1', 'Speaker 2', etc.).
        num_speakers: Optional expected number of speakers for diarization.
        distance_threshold: Clustering distance threshold when num_speakers is None.
        llm_model: Optional LLM model name for conversational turn disambiguation.
        **whisper_kwargs: Additional arguments passed to whisper.transcribe().

    Returns:
        dict: {
            "text": str,
            "language": str,
            "segments": List[dict],
            "duration": float,
            "speakers": List[str],
            "diarized_transcript": str
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
        speakers: List[str] = []
        diarized_transcript: str = ""

        if diarize and segments:
            segments, speakers = diarize_segments(
                segments=segments,
                audio_path=temp_path,
                num_speakers=num_speakers,
                distance_threshold=distance_threshold,
                llm_model=llm_model
            )
            diarized_transcript = format_diarized_transcript(segments)

        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", ""),
            "duration": duration,
            "segments": segments,
            "speakers": speakers,
            "diarized_transcript": diarized_transcript
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
    diarize: bool = False,
    num_speakers: Optional[int] = None,
    llm_model: Optional[str] = None,
    **kwargs
) -> str:
    """
    Receives an audio file input and returns transcribed text string (raw_transcript).

    Args:
        file_input: FastAPI UploadFile object, file path string, raw audio bytes, or stream.
        model_name: Optional Whisper model size ('tiny', 'base', 'small', 'medium', 'large').
        language: Optional language code ('vi', 'en', etc.) or None for automatic detection.
        include_timestamps: If True, prefixes each segment with its timestamp [MM:SS - MM:SS].
        diarize: If True, includes speaker labels in formatted output.
        num_speakers: Optional expected number of speakers.
        llm_model: Optional LLM model name for conversational refinement.

    Returns:
        str: Transcribed meeting transcript text.
    """
    detailed = transcribe_audio_detailed(
        file_input=file_input,
        model_name=model_name,
        language=language,
        diarize=diarize,
        num_speakers=num_speakers,
        llm_model=llm_model,
        **kwargs
    )

    if diarize and detailed.get("diarized_transcript"):
        return detailed["diarized_transcript"]

    if include_timestamps and detailed.get("segments"):
        timestamped_lines = [
            f"{seg['timestamp']} {seg['text']}"
            for seg in detailed["segments"]
            if seg.get("text")
        ]
        return "\n".join(timestamped_lines)

    return detailed.get("text", "").strip()
