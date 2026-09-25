from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
import time
import math

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

def call_ollama(prompt: str) -> str:
    """Hàm phụ trợ để gọi API Llama 3, giúp code không bị lặp lại."""
    payload = {
        "model": "llama3",
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=120)
        response.raise_for_status()
        return response.json().get("response", "").strip()
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Ollama is not running. Please run 'ollama run llama3'.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing Error: {str(e)}")

def summarize_with_llama(transcript: str) -> str:
    system_prompt = """
    You are a Senior Executive Meeting Secretary. Your task is to summarize meeting transcripts accurately.
    Strict Rules:
    1. Tone: Objective, professional, third-person perspective.
    2. Structure: Use concise bullet points to highlight key decisions and topics discussed.
    3. Prohibitions: Do NOT hallucinate. Do NOT use introductory phrases like "Here is the summary". Output directly.
    """
    
    # 1. Đo lường độ dài (Đếm số từ)
    words = transcript.split()
    MAX_WORDS_PER_CHUNK = 1200 # Giới hạn an toàn để AI không bị quên logic
    
    # Kịch bản 1: Cuộc họp ngắn (Dưới 1200 từ) -> Tóm tắt luôn 1 lần
    if len(words) <= MAX_WORDS_PER_CHUNK:
        print("Văn bản ngắn, xử lý trực tiếp...")
        full_prompt = f"{system_prompt}\n\nMeeting Transcript:\n{transcript}\n\nSummary:"
        return call_ollama(full_prompt)
        
    # Kịch bản 2: Cuộc họp dài -> Băm nhỏ (Chunking)
    print(f"Văn bản quá dài ({len(words)} từ). Khởi động tiến trình Map-Reduce...")
    chunks = []
    
    # Cắt văn bản thành các khối nhỏ nguyên vẹn từ
    for i in range(0, len(words), MAX_WORDS_PER_CHUNK):
        chunk_words = words[i:i + MAX_WORDS_PER_CHUNK]
        chunks.append(" ".join(chunk_words))
        
    partial_summaries = []
    
    # MAP: Gọi Llama 3 tóm tắt từng phần một
    for i, chunk in enumerate(chunks):
        print(f"- Đang tóm tắt phần {i+1}/{len(chunks)}...")
        chunk_prompt = f"{system_prompt}\n\nPlease summarize this specific part of the meeting transcript:\n{chunk}\n\nSummary:"
        partial_summary = call_ollama(chunk_prompt)
        partial_summaries.append(partial_summary)
        
    # REDUCE: Gộp các tóm tắt nhỏ lại và tóm tắt chung cuộc
    print("- Đang tổng hợp Executive Summary cuối cùng...")
    combined_text = "\n\n---\n\n".join(partial_summaries)
    
    final_prompt = (
        f"{system_prompt}\n\n"
        f"Here are partial summaries from different segments of a long meeting. "
        f"Please combine them into one coherent, final Executive Summary:\n\n{combined_text}\n\n"
        f"Final Executive Summary:"
    )
    
    return call_ollama(final_prompt)

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