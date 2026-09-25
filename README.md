# AI Meeting Assistant - Project Setup Guide

Dự án này sử dụng kiến trúc tách biệt giữa React (Frontend), FastAPI (Backend) và Llama 3 (Local AI via Ollama). 
Yêu cầu mọi người thực hiện đúng trình tự dưới đây để khởi chạy hệ thống trên máy cá nhân.

## 1. Yêu cầu hệ thống thiết yếu
- Đã cài đặt [Node.js](https://nodejs.org/) (khuyên dùng Node 18+)
- Đã cài đặt [Python 3.10+](https://www.python.org/)
- Đã cài đặt [Ollama](https://ollama.com/) với model `llama3` (hoặc `llama3.2:1b` cho máy không có GPU)

## 2. Trình tự khởi động (Boot Sequence)
Bạn phải mở 3 cửa sổ Terminal độc lập để chạy 3 dịch vụ này song song:

### Terminal 1: Khởi động Lõi AI (Bắt buộc chạy đầu tiên)
```bash
ollama run llama3
```
*(Nếu máy không có GPU rời, xem mục 5 bên dưới để chạy mô hình siêu nhẹ `llama3.2:1b`)*

### Terminal 2: Khởi động Backend FastAPI (Port 8002)
```bash
cd ai-summary-service
# Kích hoạt virtualenv (Windows PowerShell)
.\venv\Scripts\activate
# Chạy server FastAPI
python main.py
# Hoặc: uvicorn main:app --reload --port 8002
```

### Terminal 3: Khởi động Giao diện React (Port 5173)
```bash
cd meeting-assistant-ui
# Cài đặt thư viện (nếu mới clone)
npm install
# Khởi chạy Vite Dev Server
npm run dev
```

Mở trình duyệt truy cập: `http://localhost:5173`

---

## 3. Dành cho máy yếu / không có GPU rời (Low-Spec Setup)
Nếu bạn hoặc đồng đội dùng laptop mỏng nhẹ (chỉ có CPU, không có card đồ họa NVIDIA rời, RAM 8GB - 16GB):

1. **Cách nhanh nhất:** Chạy file script tự động `setup_low_spec.bat` ở thư mục gốc (chỉ cần click đúp).
2. **Cách thủ công:** Mở Terminal và gõ:
   ```bash
   ollama pull llama3.2:1b
   ollama run llama3.2:1b
   ```
   *Mô hình này chỉ nặng ~1.3GB (tải 1 phút), chạy cực nhanh (~25-35 tokens/s) ngay trên CPU thông thường mà không làm nóng máy hay tràn RAM.*

3. **Cơ chế chống treo khi Thuyết trình (Presenter Emergency Safeguard):**
   - Trên thanh điều khiển của UI, bạn có thể chọn Profile: `Auto (Adaptive)`, `Llama 3.2 (1B)` hoặc `Instant Demo`.
   - Nếu trong lúc demo AI suy luận quá lâu hoặc máy bị đơ, nút **"Skip Waiting: Instant Demo Result ⏩"** sẽ xuất hiện cạnh vòng xoay tiến trình để người thuyết trình bấm nhảy cóc ngay sang kết quả mẫu mà không bao giờ bị báo lỗi trước hội đồng.

---

## 4. Kiến trúc Hệ thống & Phân công Nhiệm vụ

| Thành viên | Vai trò | Trọng tâm công việc | Module phụ trách |
| :--- | :--- | :--- | :--- |
| **Thành viên 1** | Agent 1: Speech-to-Text | Tích hợp Whisper bóc băng âm thanh thành text | `agent1_transcribe.py` |
| **Thành viên 2 (Lead)** | Orchestrator & Agent 2 | Pipeline chính, UI React, tóm tắt Llama 3 (Map-Reduce) | `main.py`, `meeting-assistant-ui/` |
| **Thành viên 3** | Agent 3: Action Items | Prompt Llama 3 trích xuất Task & Assignee JSON | `agent3_action_items.py` |
| **Thành viên 4** | Database & Integration | SQLite schema, lưu vết cuộc họp MeetingRecord | `database/` |

---

## 5. Quy trình làm việc nhóm (Git Workflow)
Để đảm bảo tính ổn định của hệ thống, toàn bộ thành viên bắt buộc tuân thủ quy trình sau:
1. **Không Push trực tiếp:** Tuyệt đối không đẩy mã nguồn trực tiếp lên nhánh `main`.
2. **Tạo nhánh tính năng:** Mỗi nhiệm vụ thực hiện trên một nhánh riêng.
   - Cú pháp: `git checkout -b feature/tên-nhiệm-vụ`
   - Ví dụ: `feature/agent1-stt`, `feature/agent3-action-items`, `feature/database-sqlite`.
3. **Báo cáo & Pull Request:**
   - Sau khi hoàn thành và test kỹ tại máy cá nhân, thực hiện push nhánh lên server: `git push origin feature/tên-nhiệm-vụ`.
   - Tạo Pull Request (PR) trên GitHub.
   - Thông báo cho **Orchestrator (Thành viên 2)** để review và merge vào nhánh chính.