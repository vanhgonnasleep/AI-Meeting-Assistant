import os
import wave
import subprocess
import tempfile
from pathlib import Path

# Script for generating realistic 2-speaker meeting audio using Windows SAPI TTS
ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT_DIR / "samples"
PUBLIC_DIR = ROOT_DIR / "meeting-assistant-ui" / "public"

SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

turns = [
    {
        "speaker": "David",
        "voice": "Microsoft David Desktop",
        "text": "Welcome everyone. We need to finalize the marketing budget for Q3 today. I propose an allocation of fifty thousand dollars for targeted social media ad campaigns."
    },
    {
        "speaker": "Zira",
        "voice": "Microsoft Zira Desktop",
        "text": "That budget sounds reasonable and matches our projections. Let's lock it in. Can you prepare the detailed financial report by Friday, John?"
    },
    {
        "speaker": "David",
        "voice": "Microsoft David Desktop",
        "text": "Will do. I will have the complete breakdown ready by Friday afternoon."
    }
]

temp_files = []

for i, turn in enumerate(turns):
    out_wav = os.path.join(tempfile.gettempdir(), f"turn_{i}.wav")
    temp_files.append(out_wav)
    safe_text = turn["text"].replace("'", "''")
    
    ps_cmd = f"""
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('{turn["voice"]}')
$synth.Rate = 0
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile('{out_wav}', $format)
$synth.Speak('{safe_text}')
$synth.Dispose()
"""
    subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True)
    print(f"Generated turn {i+1} ({turn['speaker']}): {out_wav} ({os.path.getsize(out_wav)} bytes)")

# Concatenate turns with 0.6s silence between turns
silence_frames = b'\x00\x00' * int(16000 * 0.6)

combined_frames = bytearray()
sample_rate = 16000
sample_width = 2
channels = 1

for i, wav_path in enumerate(temp_files):
    with wave.open(wav_path, 'rb') as wf:
        sample_rate = wf.getframerate()
        sample_width = wf.getsampwidth()
        channels = wf.getnchannels()
        combined_frames.extend(wf.readframes(wf.getnframes()))
    if i < len(temp_files) - 1:
        combined_frames.extend(silence_frames)

output_targets = [
    SAMPLES_DIR / "sample_meeting_en.wav",
    PUBLIC_DIR / "sample_meeting_en.wav",
    PUBLIC_DIR / "q3_product_budget_review.wav"
]

for out_path in output_targets:
    with wave.open(str(out_path), 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(combined_frames)
    print(f"Saved: {out_path} ({os.path.getsize(out_path)} bytes, duration: {len(combined_frames) / (sample_rate * sample_width * channels):.2f}s)")

# Clean up temp turn files
for f in temp_files:
    try:
        os.remove(f)
    except Exception:
        pass

print("Done! Clean, realistic bilingual meeting demo audio generated successfully.")
