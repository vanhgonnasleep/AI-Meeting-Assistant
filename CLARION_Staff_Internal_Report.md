# [CONFIDENTIAL - INTERNAL / STAFF ONLY]
# CLARION AI MEETING ASSISTANT (ENTERPRISE V2.0)
## SYSTEM ENGINEERING REPORT & STAFF FEATURE AUDIT MANUAL
### TÀI LIỆU BÁO CÁO TÍNH NĂNG & THẨM ĐỊNH KỸ THUẬT NỘI BỘ DÀNH CHO STAFF

> ⚠️ **LƯU HÀNH NỘI BỘ — DÀNH RIÊNG CHO CÁN BỘ ĐÁNH GIÁ, GIẢNG VIÊN HƯỚNG DẪN & TRỢ GIẢNG (STAFF ONLY)**  
> **Dự án:** Clarion — Local Privacy-First Multi-Agent Meeting Intelligence Platform  
> **Quy trình đánh giá:** Demo trực tiếp trên giao diện ➔ Thuyết minh 13 tính năng theo 4 khối chuyên môn  
> **Trạng thái:** Hoàn thiện 100%, Code-Freeze, 428 Backend Tests + 161 Frontend Tests Passed  
> **Nhóm sinh viên thực hiện:**  
> - **Lương Việt Anh** *(Team Leader • Pipeline Orchestrator • Tính năng 5, 6, 7)*  
> - **Triệu Quang Thiện** *(Speech & Audio AI Engineer • Tính năng 1, 2, 3, 4)*  
> - **Nguyễn Quang Minh** *(NLP Structured Extraction Engineer • Tính năng 8, 9, 10)*  
> - **Đoàn Hoàng Long** *(Persistence & Systems Engineer • Tính năng 11, 12, 13)*  

---

## 📑 MỤC LỤC
1. [Quy trình Đánh giá Demo-First dành cho Staff](#1-quy-trình-đánh-giá-demo-first-dành-cho-staff)
2. [Danh mục 13 Tính năng Cốt lõi & Bảng Phân công 4 Thành viên](#2-danh-mục-13-tính-năng-cốt-lõi--bảng-phân-công-4-thành-viên)
3. [Phân tích Chi tiết Từng Tính năng & Mã nguồn Thực thi](#3-phân-tích-chi-tiết-từng-tính-năng--mã-nguồn-thực-thi)
4. [Bảo chứng Kiểm thử & Lệnh Chạy 1-Click cho Staff](#4-bảo-chứng-kiểm-thử--lệnh-chạy-1-click-cho-staff)
5. [Bộ Câu hỏi Phản biện Kỹ thuật Trọng tâm](#5-bộ-câu-hỏi-phản-biện-kỹ-thuật-trọng-tâm)

---

## 1. QUY TRÌNH ĐÁNH GIÁ DEMO-FIRST DÀNH CHO STAFF

Nhóm áp dụng quy trình đánh giá thực chiến, không trình chiếu slide:
- **Bước 1 (3.5 phút): Chạy Live Demo từ A đến Z** trên trình duyệt `http://localhost:5173`. Nạp file âm thanh mẫu `q3_product_budget_review.mp3`, bấm xử lý tuần tự qua Stepper, show kết quả tóm tắt, đầu việc, chat dẫn nguồn và xuất file in A4.
- **Bước 2 (7.5 phút): Thuyết minh chi tiết 13 tính năng sản phẩm**. Từng thành viên thuyết minh các tính năng thuộc khối phụ trách, giải thích trải nghiệm người dùng và cơ chế code/thuật toán bên dưới.

---

## 2. DANH MỤC 13 TÍNH NĂNG CỐT LÕI & BẢNG PHÂN CÔNG 4 THÀNH VIÊN

| STT | Khối chức năng | Tên tính năng | Trải nghiệm người dùng | Thành viên phụ trách | Module Code thực thi |
|:---:|:---|:---|:---|:---:|:---|
| **1** | **Âm thanh & Nhận dạng** | **Ghi âm & Nạp đa định dạng** | Thu âm microphone hoặc upload file `.mp3`, `.wav`, `.m4a`, `.mp4`. Chuẩn hóa 16kHz Mono trong RAM. | **Quang Thiện** | `app/pipeline/audio_preparation.py` |
| **2** | **Âm thanh & Nhận dạng** | **Nhận dạng tiếng nói đa ngữ (STT)** | Whisper cục bộ nhận dạng tiếng Việt/Anh, sinh mốc thời gian từng giây, chống lặp `condition_on_previous_text=False`. | **Quang Thiện** | `app/pipeline/transcription.py` |
| **3** | **Âm thanh & Nhận dạng** | **Phân cụm người nói (Diarization)** | Phân tách Speaker 1, Speaker 2 dựa trên Mel-spectrogram 80 chiều và giải thuật AHC với khoảng cách Cosine. | **Quang Thiện** | `app/pipeline/transcription.py` |
| **4** | **Âm thanh & Nhận dạng** | **Duyệt lỗi giọng nói (Speech Review)** | Gắn cờ đoạn thoại AI nhận dạng không chắc chắn; click vào là audio player tua đúng giây đó để người dùng sửa. | **Quang Thiện** | `database/transcript_quality.py` |
| **5** | **Thuật toán & Tóm tắt** | **Lọc nén từ thừa (Thuật toán MMR)** | Thuật toán MMR loại bỏ 35–45% từ rác, thán từ; thanh trượt $\lambda = 0.65$ cân bằng ý chính và chống trùng lặp trong **15ms**. | **Việt Anh (Lead)** | `app/pipeline/mmr.py` |
| **6** | **Thuật toán & Tóm tắt** | **Tóm tắt điều hành (Executive Summary)** | Map-Reduce trượt cửa sổ (1200w window, 120w overlap) chống tràn context LLM; bọc thẻ XML chống Prompt Injection. | **Việt Anh (Lead)** | `app/pipeline/summarization.py` |
| **7** | **Thuật toán & Tóm tắt** | **Chế độ xem trước (Public Preview)** | Cho phép trải nghiệm toàn bộ tính năng và dữ liệu mẫu không cần tạo tài khoản; timeout 35s chống treo máy. | **Việt Anh (Lead)** | `features/preview/`<br>`app/main.py` |
| **8** | **NLP & Tương tác** | **Trích xuất Đầu việc (Action Items)** | Tự động bóc tách Task, Người làm (Assignee), Hạn chót bằng lời và ngày ISO `YYYY-MM-DD` qua JSON phòng vệ 3 lớp. | **Quang Minh** | `app/pipeline/action_items.py` |
| **9** | **NLP & Tương tác** | **Bóc tách Quyết định & Rủi ro (Insights)** | Phân loại tự động 3 danh mục: Quyết định đã chốt (Key Decisions), Rủi ro cảnh báo (Risks), Câu hỏi mở (Open Questions). | **Quang Minh** | `app/pipeline/insights.py` |
| **10** | **NLP & Tương tác** | **Hỏi-Đáp có trích dẫn (Cited RAG Chat)** | Chat thông minh trả lời nội dung cuộc họp kèm mốc thời gian dẫn chứng `[00:15]`, nhấp vào là audio player nhảy đúng câu nói. | **Quang Minh** | `app/pipeline/chat.py` |
| **11** | **Quản trị & Dữ liệu** | **Checklist Task & Đồng bộ SQLite WAL** | Tương tác tick chọn hoàn thành task ghi bất đồng bộ tức thì xuống SQLite; Optimistic Revision chống xung đột ghi đè. | **Hoàng Long** | `database/db.py`<br>`database/crud.py` |
| **12** | **Quản trị & Dữ liệu** | **Không gian làm việc & Đa tài khoản** | Chế độ Local Offline 100% không cần mạng, hoặc Private Workspace qua Google/GitHub OAuth cô lập dữ liệu từng người. | **Hoàng Long** | `app/auth/`<br>`database/models.py` |
| **13** | **Quản trị & Dữ liệu** | **Xuất báo cáo đa định dạng** | Xuất tức thì ra file Markdown, JSON cho hệ thống ERP, và bản Print PDF A4 chuẩn doanh nghiệp sẵn sàng in ấn. | **Hoàng Long** | `features/meetings/`<br>`features/workspace/` |

---

## 3. PHÂN TÍCH CHI TIẾT TỪNG TÍNH NĂNG & MÃ NGUỒN THỰC THI

### Khối 1: Âm thanh & Nhận dạng giọng nói (Triệu Quang Thiện)
- **Tính năng 1 (Audio Ingestion):** Tại `app/pipeline/audio_preparation.py`, hàm `prepare_audio()` tiếp nhận audio từ upload hoặc micro, gọi `imageio-ffmpeg` chuyển đổi sang 16kHz đơn kênh trực tiếp trên RAM (`io.BytesIO`), hạn chế tối đa I/O ổ cứng.
- **Tính năng 2 (Whisper STT):** Tại `app/pipeline/transcription.py`, hàm `transcribe_audio_whisper()` nạp mô hình Whisper cục bộ với model cache `_MODEL_CACHE`. Thiết lập `condition_on_previous_text=False` để dập tắt hiện tượng lặp vô tận (repetition loop), tự động kiểm tra `fp16=True` trên CUDA GPU hoặc `fp16=False` trên CPU.
- **Tính năng 3 (Speaker Diarization):** Trích xuất Mel-spectrogram 80 chiều, tính khoảng cách Cosine và áp dụng thuật toán Agglomerative Hierarchical Clustering (AHC) để phân tách lượt nói Speaker 1, Speaker 2.
- **Tính năng 4 (Speech Review):** Tại `database/transcript_quality.py`, hàm `detect_uncertain_passages()` gắn cờ các đoạn thoại có log-probability thấp. Người dùng bấm vào cờ để nghe lại đúng đoạn âm thanh đó và đính chính từ ngữ trực tiếp trên UI.

### Khối 2: Lọc nén Thuật toán & Tóm tắt Điều hành (Lương Việt Anh)
- **Tính năng 5 (Lọc nén MMR):** Tại `app/pipeline/mmr.py`, thuật toán Maximal Marginal Relevance tối ưu hóa:
  $$\text{MMR}(s) = \arg\max_{s_i \in R \setminus S} \left[ \lambda \cdot \text{Sim}_1(s_i, Q) - (1 - \lambda) \cdot \max_{s_j \in S} \text{Sim}_2(s_i, s_j) \right]$$
  Dựng vector thưa TF-IDF với stopwords song ngữ Việt - Anh, tính Centroid $Q$, chọn câu tham lam với $\lambda = 0.65$. Độ phức tạp tuyến tính $\mathcal{O}(V \cdot N + K \cdot N)$, chạy trong 15ms trên CPU, giảm 35-45% từ thừa mà không mất ý.
- **Tính năng 6 (Tóm tắt Map-Reduce):** Tại `app/pipeline/summarization.py`, phân đoạn văn bản thành các cửa sổ 1200 từ (GPU) / 800 từ (CPU) với vùng đệm gối đầu 120 từ để không đứt ngữ cảnh. Bọc transcript trong thẻ `<meeting_transcript>` chống Prompt Injection.
- **Tính năng 7 (Public Preview):** Cho phép trải nghiệm toàn bộ ứng dụng và dữ liệu mẫu ngay lập tức không cần đăng nhập. Chốt an toàn Timeout 35s chống treo hệ thống.

### Khối 3: Bóc tách Thông tin có Cấu trúc & Cited Chat (Nguyễn Quang Minh)
- **Tính năng 8 (Action Items Extraction):** Tại `app/pipeline/action_items.py`, bảo vệ 3 lớp: Gọi Ollama `format='json'`, bộ Defensive Parser đếm độ sâu ngoặc nhọn `{...}` và chuẩn hóa dấu nháy, và động cơ Regex Heuristic Fallback (5ms) dự phòng khi LLM timeout. Trích xuất đầy đủ task, assignee, deadline ISO.
- **Tính năng 9 (Meeting Insights):** Tại `app/pipeline/insights.py`, tự động phân loại 3 mục: Key Decisions, Risks, Open Questions.
- **Tính năng 10 (Cited RAG Chat):** Tại `app/pipeline/chat.py`, tìm kiếm ngữ nghĩa đoạn thoại liên quan, đưa vào context kèm mốc `[start - end]`. Khi AI trả lời, nó kèm theo chỉ số câu dẫn chứng. Nhấp vào trích dẫn là audio player tua đúng mốc thời gian đó.

### Khối 4: Quản trị Dữ liệu, Đồng bộ & Bảo mật (Đoàn Hoàng Long)
- **Tính năng 11 (Task Sync & SQLite WAL):** Tại `database/db.py` và `crud.py`, kích hoạt `PRAGMA journal_mode=WAL` và `busy_timeout=5000` giúp đọc ghi không chặn nhau. Tích chọn hoàn thành task ghi ngay xuống SQLite. Cơ chế `Optimistic Revision Check` kiểm tra `revision_id` trả về `HTTP 409 Conflict` chống ghi đè dữ liệu.
- **Tính năng 12 (Workspace & Đa tài khoản):** Hỗ trợ Single-User Local chạy offline 100%, hoặc Private Workspace qua Google/GitHub OAuth cô lập dữ liệu theo tài khoản. Di trú an toàn qua `PRAGMA table_info` + `ALTER TABLE`.
- **Tính năng 13 (Xuất báo cáo đa định dạng):** Xuất tức thì ra Markdown, JSON và bản in A4 PDF chuẩn hành chính.

---

## 4. BẢO CHỨNG KIỂM THỬ & LỆNH CHẠY 1-CLICK CHO STAFF

Staff có thể chạy kiểm chứng toàn bộ 13 tính năng qua các lệnh tự động:

```bash
# 1. Chạy toàn bộ 428 Backend Tests:
cd ai-summary-service
pytest -v

# 2. Chạy riêng từng module theo phân công:
pytest tests/test_stt.py tests/test_audio_preparation.py -v       # Khối 1 (Thiện)
pytest tests/test_mmr.py -v                     # Khối 2 (Việt Anh)
pytest tests/test_action_items.py tests/test_chat.py -v     # Khối 3 (Minh)
pytest tests/test_api.py tests/test_concurrency.py -v # Khối 4 (Long)

# 3. Chạy toàn bộ 161 Frontend Tests:
cd ../meeting-assistant-ui
npm test
```

---

## 5. BỘ CÂU HỎI PHẢN BIỆN KỸ THUẬT TRỌNG TÂM

1. **Staff hỏi:** *"Tại sao demo chạy mượt mà không bị giật lag trên máy cá nhân?"*  
   ➔ **Trả lời:** *"Dạ, vì hệ thống áp dụng 3 kỹ thuật tối ưu hóa: (1) Chuẩn hóa âm thanh trực tiếp trên RAM, (2) Lọc nén 35-45% từ thừa bằng MMR trước khi đưa vào LLM, và (3) Cơ chế SQLite WAL không khóa cơ sở dữ liệu khi đọc ghi đồng thời."*

2. **Staff hỏi:** *"Nếu người dùng tắt mạng internet hoàn toàn thì hệ thống có chạy được không?"*  
   ➔ **Trả lời:** *"Dạ hoàn toàn được! Cả Whisper và Ollama (Llama 3) đều chạy On-Premise 100%. Hệ thống có chế độ Local Mode không cần xác thực OAuth, đảm bảo hoạt động bình thường trong môi trường mạng nội bộ cô lập (Air-Gapped)."*

---

*Tài liệu thẩm định nội bộ — Nhóm Đồ án Clarion AI Meeting Assistant.*
