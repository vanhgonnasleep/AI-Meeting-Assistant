from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI(title="Meeting Summary Agent")

# Cho phép giao diện React (cổng 5173) gọi API mà không bị lỗi bảo mật CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranscriptInput(BaseModel):
    raw_text: str

def summarize_with_llama(text: str):
    ollama_url = "http://localhost:11434/api/generate"
    
    # Prompt ép AI đóng vai trợ lý tiếng Anh chuyên nghiệp
    prompt = f"""You are an executive assistant. Your task is to summarize the following meeting transcript.
    Provide a concise, professional summary in 3-4 sentences. Do NOT include action items or side chatter.
    
    Transcript:
    {text}
    
    Summary:"""

    payload = {
        "model": "llama3",
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        return response.json()["response"].strip()
    except Exception as e:
        raise Exception(f"Ollama Error. Hãy chắc chắn bạn đã chạy 'ollama run llama3' ở một terminal khác. Chi tiết: {str(e)}")

@app.post("/api/summarize")
async def generate_summary(data: TranscriptInput):
    if not data.raw_text:
        raise HTTPException(status_code=400, detail="Transcript không được để trống")
    
    try:
        summary_result = summarize_with_llama(data.raw_text)
        return {
            "status": "success",
            "summary": summary_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))