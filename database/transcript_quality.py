"""Source-quality policy shared by recognition, storage and AI consumers.

These signals request human review; they are not calibrated accuracy scores.
Original recognition stays in segment JSON, while normal transcript text uses
an explicit placeholder until a person corrects or confirms the passage.
"""
import math
import re

UNCLEAR_SPEECH = '[Unclear speech - review audio]'


def needs_review(segment):
    quality = segment.get('quality') if isinstance(segment, dict) else None
    return isinstance(quality, dict) and quality.get('status') == 'needs_review'


def recognition_reasons(segment):
    words = re.findall(r'\w+', str(segment.get('text') or '').casefold())
    repeated = False
    # Check the text itself: Whisper's compression score belongs to a whole
    # decoding window and cannot identify which individual sentence is wrong.
    for width in range(1, 5):
        for phase in range(width):
            run = 1
            for index in range(phase + width, len(words) - width + 1, width):
                if words[index:index + width] == words[index - width:index]:
                    run += 1
                    if run >= (8 if width == 1 else 5) and run * width >= 12:
                        repeated = True
                        break
                else:
                    run = 1
            if repeated:
                break
        if repeated:
            break
    reasons = ['repetition'] if repeated else []
    score = segment.get('avg_logprob')
    if isinstance(score, (int, float)) and math.isfinite(score) and score < -1.0:
        reasons.append('uncertain_recognition')
    return reasons


def mark_recognition(segment):
    reasons = recognition_reasons(segment)
    if reasons:
        return {**segment, 'quality': {'status': 'needs_review', 'reasons': reasons}}
    return segment


def display_text(segment):
    return UNCLEAR_SPEECH if needs_review(segment) else str(segment.get('text') or '').strip()


def transcript_from_segments(segments, attributed=False):
    lines = []
    for segment in segments:
        text = display_text(segment)
        if not text:
            continue
        prefix = ' '.join(str(value).strip() for value in (
            segment.get('timestamp') or '',
            f"{segment['speaker']}:" if attributed and segment.get('speaker') else '',
        ) if value) if attributed else ''
        lines.append(f'{prefix} {text}'.strip())
    return ('\n' if attributed else ' ').join(lines)


def trusted_transcript(transcript, segments):
    if any(needs_review(segment) for segment in segments or []):
        return ' '.join(str(segment.get('text') or '').strip() for segment in segments
                        if isinstance(segment, dict) and not needs_review(segment))
    return transcript or ''
