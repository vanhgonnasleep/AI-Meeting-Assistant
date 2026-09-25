from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
import time

app = FastAPI()

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# AGENT 2 - SUMMARIZATION (YOUR CORE LOGIC)
# ==========================================
OLLAMA_API_URL = "http://localhost:11434/api/generate"

def summarize_with_llama(transcript: str) -> str:
    system_prompt = """
    You are a Senior Executive Meeting Secretary. Your task is to summarize meeting transcripts accurately.
    
    Strict Rules:
    1. Tone: Objective, professional, third-person perspective.
    2. Structure: Use concise bullet points to highlight key decisions and topics discussed.
    3. Prohibitions: Do NOT hallucinate or add outside information. Do NOT use introductory phrases like "Here is the summary". Output the summary directly.
    """
    
    full_prompt = f"{system_prompt}\n\nMeeting Transcript:\n{transcript}\n\nSummary:"
    
    payload = {
        "model": "llama3",
        "prompt": full_prompt,
        "stream": False # Set to False to get the full response at once
    }
    
    try:
        # Call Local Ollama API
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        return result.get("response", "").strip()
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Ollama is not running. Please run 'ollama run llama3' in a separate terminal.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing Error: {str(e)}")

# ==========================================
# ORCHESTRATION PIPELINE
# ==========================================
@app.post("/api/process-audio")
async def process_audio(file: UploadFile = File(...)):
    if not file.filename.endswith(('.mp3', '.wav', '.m4a')):
        raise HTTPException(status_code=400, detail="Only .mp3, .wav, .m4a files are supported.")
    
    try:
        print(f"Processing audio file: {file.filename}")
        
        # 1. AGENT 1: Speech-to-Text (Mock - Waiting for Teammate 1)
        time.sleep(1) # Simulating processing time
        transcript = (
            "Speaker A: We need to finalize the marketing budget for Q3. "
            "I propose $50,000 for social media ads.\n"
            "Speaker B: That sounds reasonable. Let's lock it in. Can you prepare the financial report by Friday, John?\n"
            "Speaker A: Will do."
        )
        
        # 2. AGENT 2: Summarization (Actual Llama 3 Call)
        print("Agent 2 is summarizing via Llama 3...")
        summary = summarize_with_llama(transcript)
        
        # 3. AGENT 3: Action Items (Mock - Waiting for Teammate 3)
        action_items = [
            {"task": "Prepare Q3 financial report", "assignee": "John (Speaker A)"}
        ]
        
        # 4. Package and Return Data to React UI
        return {
            "status": "success",
            "data": {
                "transcript": transcript,
                "summary": summary,
                "action_items": action_items
            }
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))