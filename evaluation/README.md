# Đánh giá phục vụ bảo vệ

Bộ công cụ chạy riêng với dữ liệu công khai và văn bản giả lập; không dùng thư viện cuộc họp hay `.env` của tài khoản.

Pilot ASR lấy các dòng đầu của `google/fleurs`, cấu hình `vi_vn`, split `test`. Đây là tiếng đọc, **không phải đánh giá hội thoại nhiều người nói hoặc diarization**. Nguồn: https://huggingface.co/datasets/google/fleurs, giấy phép CC-BY-4.0. Giữ nguyên attribution và checksum khi chia sẻ kết quả; nội dung transcript/audio thuộc bộ dữ liệu gốc.

API `/rows` có thể lỗi giới hạn quét; khi đó tải shard Parquet test chính thức (giới hạn 800 MiB) và đọc các dòng đầu. Cài dependency tùy chọn: `python -m pip install -r evaluation/requirements.txt`. Không lưu URL CDN có chữ ký. Cache được kiểm checksum, không tự ghi đè khi hỏng; dùng thư mục mới để chuẩn bị lại.

Sáu tình huống văn bản do dự án tự soạn đều là **synthetic**, reference chưa được người dùng duyệt. Không dùng chúng để công bố accuracy/F1 trước khi duyệt nhãn và ghép cặp thủ công. Bộ nhãn bao gồm task rõ ràng, hủy bỏ, không có task, đổi người phụ trách, ngày cụ thể và trộn Anh–Việt.

## Chạy lại

Từ thư mục gốc, dùng Python của môi trường backend (PowerShell: `ai-summary-service/venv/Scripts/python.exe` thay cho `python` nếu cần):

```powershell
python scripts/evaluate_pipeline.py prepare-fleurs --output .evaluation-data/fleurs-vi --limit 20
python scripts/evaluate_pipeline.py preflight --models tiny base --llm-model llama3:latest
python scripts/evaluate_pipeline.py run --manifest .evaluation-data/fleurs-vi/manifest.jsonl --manifest evaluation/fixtures/vi_text_cases.jsonl --models tiny base --llm-model llama3:latest --output .evaluation-runs
python scripts/evaluate_pipeline.py report .evaluation-runs/<run-id>
```

Preflight kiểm hash checkpoint chính thức. Mặc định không tự tải model; nếu thiếu, chỉ thêm `--allow-model-download` khi chủ động muốn chuẩn bị tiny/base. LLM phải được cài sẵn trong Ollama local; không tự pull. Không cần đăng nhập ứng dụng. Không đọc `.env`; nếu cấu hình Ollama khác, chỉ hỗ trợ endpoint loopback. Whisper dùng CPU/CUDA đúng môi trường thực; thông tin card vật lý không suy ra tốc độ GPU. RTF loại model load/download, bao gồm decode + transcription và có thể có overhead inference lần đầu; không có warm-up riêng. Các tùy chọn Whisper giữ nguyên pipeline, cố định language=vi, diarize=false. Summary gọi cấu hình CPU-context hiện có; Ollama có thể tự offload GPU độc lập với Torch. Seed LLM không cố định nên kết quả sinh có thể khác giữa các lần chạy.

Mỗi run có thư mục mới, manifest/audio đã đóng băng, checksum, cấu hình, phiên bản thư viện, Git revision/dirty, raw output, thời gian, lỗi và `rows.jsonl` ghi từng bước. `run.json` cập nhật atomically; Ctrl+C giữ trạng thái interrupted. Code thoát: 0 complete, 1 partial inference, 2 lỗi đầu vào/preflight. Không coi fallback heuristic là LLM thành công. Đọc `report.html` trực tiếp offline; CSV/JSON/Markdown chứa cùng lần chạy. `npm run benchmark` vẫn giữ nguyên và là benchmark kỹ thuật khác, không thay thế kết quả ASR.

## Duyệt nhãn và chấm NLP

1. Đọc từng transcript cùng `reference_tasks`/`reference_facts`. Sửa lỗi nhãn và chỉ đặt `reference_approved: true` sau khi chủ dữ liệu duyệt. Chạy lại để manifest đã duyệt được đóng băng; không sửa input của run cũ.
2. Mở `review.csv` của run mới. Một dòng cho mỗi case/variant. Chỉ đặt `review_complete=true` sau khi đọc toàn bộ prediction và references; với dòng không có task, vẫn phải xác nhận rõ.
3. `task_matches` là JSON, ví dụ `[[0,"t1",true,false]]`: prediction index bắt đầu 0, ID task tham chiếu, owner đúng?, deadline đúng?. Mỗi prediction và reference dùng tối đa một lần. Dùng null cho tiêu chí không có nhãn; nhãn owner/deadline có giá trị thì cần true/false. Task chưa ghép tạo FP/FN; không dùng fuzzy string hay LLM làm giám khảo.
4. `covered_fact_ids` là JSON như `["f1"]`; `unsupported_claims` là số claim trong summary không có bằng chứng từ transcript, phải nhập 0 nếu không có. Không nhập rỗng để giả định không có lỗi.
5. `python scripts/evaluate_pipeline.py report <run-id> --review-csv <run-id>/review.csv`. Không ghi đè phiếu đã có. Chỉ tổng hợp một variant khi mọi dòng của variant có nhãn được duyệt, sinh thành công và phiếu hoàn tất. Không đủ điều kiện: `not_evaluated`, không có F1.

Owner/deadline accuracy dùng mẫu số là các TP có nhãn tương ứng, không phải tất cả task; đọc cùng recall để thấy task bỏ sót. Fact coverage = số reference facts được bao phủ / tổng reference facts. Unsupported claims là count thủ công. Một người chấm có thiên lệch và chưa đo inter-annotator agreement. Pilot 20 mẫu không đại diện tất cả vùng giọng, tiếng ồn hay audio họp thực.
