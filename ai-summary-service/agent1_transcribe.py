"""
=====================================================
AGENT 1: SPEECH-TO-TEXT (STT)
Phụ trách: Thành viên 1
Nhiệm vụ: Tích hợp thư viện OpenAI Whisper (hoặc tương đương)
         để chuyển đổi file âm thanh (.mp3, .wav, .m4a) thành text.
=====================================================
"""

import os
from typing import Union
from fastapi import UploadFile

def transcribe_audio(file_input: Union[UploadFile, str, bytes]) -> str:
    """
    Hàm nhận đầu vào là file audio và trả về chuỗi văn bản (raw_transcript).
    
    Args:
        file_input: Có thể là đối tượng UploadFile của FastAPI, 
                    đường dẫn file (str), hoặc bytes âm thanh.
                    
    Returns:
        str: Chuỗi văn bản đã được bóc băng từ âm thanh (transcript).
    """
    # TODO (Thành viên 1): Triển khai model Whisper tại đây
    # Ví dụ:
    # import whisper
    # model = whisper.load_model("base")
    # result = model.transcribe(audio_path)
    # return result["text"]

    raise NotImplementedError("Thành viên 1 đang triển khai Whisper STT.")
