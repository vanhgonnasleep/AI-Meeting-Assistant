"""
=====================================================
AGENT 3: ACTION ITEMS EXTRACTION
Phụ trách: Thành viên 3
Nhiệm vụ: Thiết kế Prompt chuyên biệt cho Llama 3 để trích xuất 
         danh sách việc cần làm (Task & Assignee) theo chuẩn JSON.
=====================================================
"""

from typing import List, Dict

def extract_action_items(transcript: str) -> List[Dict[str, str]]:
    """
    Hàm nhận đầu vào là văn bản cuộc họp (transcript) và trích xuất danh sách công việc.
    
    Args:
        transcript (str): Toàn bộ văn bản cuộc họp.
        
    Returns:
        List[Dict[str, str]]: Danh sách công việc theo định dạng chuẩn:
            [
                {"task": "Chuẩn bị báo cáo tài chính Q3", "assignee": "John (Speaker A)"},
                ...
            ]
    """
    # TODO (Thành viên 3): Triển khai prompt Llama 3 trích xuất JSON công việc tại đây
    # Gợi ý: Gọi Ollama API với format json và prompt ép Llama 3 trả về đúng schema.

    raise NotImplementedError("Thành viên 3 đang triển khai Agent 3 Action Items.")
