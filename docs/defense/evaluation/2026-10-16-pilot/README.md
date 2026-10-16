# Pilot thực nghiệm Clarion — 16/10/2026

Mở [báo cáo HTML offline](report.html), [kết quả JSON](summary.json), [từng output](rows.jsonl), [CSV](results.csv) và [văn bản chuẩn hóa dùng chấm](normalized.csv). [Manifest](manifest.jsonl) cùng [checksum các artifact](checksums.json) giúp đối chiếu lại. Không có điểm NLP được suy diễn từ test phần mềm.

## Kết quả đã đo

Run `20261016T145301Z-b6f6da53e5`, inference tại commit `cd8feba` (working tree clean lúc khởi chạy), report bổ sung normalized CSV tại `ae87c7e`, sau đó thêm coverage đầy đủ bằng renderer đã sửa sau review. Python 3.14.7, Whisper 20250625, Torch 2.14.0, thiết bị STT **CPU**, CUDA không khả dụng. Model hash và Ollama digest có trong `run.json`. Không tải model trong lần chấm vì tiny/base đã có cache đúng hash.

| Model | Thành công | CER | Whitespace-WER | RTF | Model load |
|---|---:|---:|---:|---:|---:|
| tiny | 20/20 | 903/2007 = 44,99% | 376/582 = 64,60% | 0,160 | 0,348 giây |
| base | 20/20 | 424/2007 = 21,13% | 217/582 = 37,29% | 0,125 | 0,606 giây |

Cùng 239,04 giây audio, cùng chuẩn hóa NFC/casefold/dấu câu/khoảng trắng, giữ dấu tiếng Việt và chữ số. CER bỏ khoảng trắng, WER dùng đơn vị tách bằng khoảng trắng. Tỷ lệ corpus tính bằng tổng lỗi/tổng đơn vị chuẩn. RTF đo decode + transcription sau nạp model; không có warm-up riêng. Một lượt, thứ tự tiny rồi base, không đảo thứ tự/cân bằng cache/nhiệt độ: **không kết luận base luôn nhanh hơn tiny**. Các lượt NLP chạy sau ASR; không chạy regression song song với thời gian đo ASR.

Base có CER thấp hơn tiny khoảng 53% tương đối trên pilot này. Có thể dùng kết quả để giải thích lựa chọn base cho demo tiếng Việt; chưa đủ bằng chứng tuyên bố hệ thống chính xác cao trong họp thực.

NLP: 6 văn bản synthetic × 2 variant MMR = 12 output; 11 `ok`, 1 `partial` do action-items heuristic fallback (`vi-no_tasks`, MMR bật). Cả 6 lượt MMR bật đều thực sự lọc nội dung, lambda=0,65, ratio=0,55. Cùng `llama3:latest`, summary dùng context CPU 2048, temperature 0,2, top_p 0,9, num_predict 1024; action extraction giữ cấu hình SDK/prompt hiện có, không đặt seed. Ollama có thể offload GPU độc lập với Torch; không suy luận thiết bị LLM từ nhãn CPU của STT.

Model còn tạo task ở tình huống hủy việc hoặc không giao việc. Đây là failure case cần phân tích, không che bằng số test pass. Nhãn đều chưa được người dùng duyệt, phiếu chưa hoàn tất: **cả hai variant `not_evaluated`, không công bố F1 hoặc lợi ích chất lượng từ MMR**. Toàn run ghi `partial` (51/52 lượt pipeline đầy đủ), không gắn nhãn thành công 100% cho AI.

## Nguồn và tái lập

20 dòng đầu, không chọn lại theo kết quả, của `google/fleurs`, config `vi_vn`, split `test`. Google FLEURS: https://huggingface.co/datasets/google/fleurs. Giấy phép [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Các audio/transcription gốc thuộc dataset; nhóm chuẩn hóa văn bản để tính metric và tạo output model phái sinh. Dataset Viewer `/rows` bị giới hạn quét, nên dùng shard Parquet test chính thức, SHA-256 ghi trong manifest; không lưu query ký tạm thời. Đây là tiếng đọc, không đo diarization, đa người nói, tiếng ồn hay khả năng tổng quát toàn bộ tiếng Việt.

Snapshot Git chỉ chứa evidence dạng text và report; audio đã đóng băng nằm ở `.evaluation-runs/20261016T145301Z-b6f6da53e5/inputs/` local. Cache audio/manifest có ở `.evaluation-data/fleurs-vi/`. File Parquet tải khoảng 691 MB chỉ phục vụ trích mẫu, không đưa vào Git. Muốn tái lập trên máy mới: xem [hướng dẫn CLI](../../../../evaluation/README.md), chuẩn bị lại và đối chiếu checksum. Không sửa manifest của run đã chốt; duyệt nhãn ở manifest nguồn rồi chạy mới.

## Gợi ý trình bày trước hội đồng

1. Phân biệt regression (đúng hành vi phần mềm) với CER/WER (chất lượng ASR).
2. Trình bày hai model trên cùng dữ liệu, kèm một ví dụ nhận sai thực tế và dữ liệu/commit/hash để kiểm tra.
3. Mở cặp MMR bật/tắt, chỉ ra thông tin giữ/mất; không dùng compression ratio thay cho chất lượng tóm tắt.
4. Dành 30–45 phút duyệt nhãn và chấm thủ công các output trước khi thêm tính năng mới. Một người chấm vẫn có thiên lệch; cần nêu giới hạn này.
5. Sau bảo vệ, ưu tiên dữ liệu hội họp thật có đồng ý sử dụng và kiểm tra phủ định/đổi assignee, rồi mới cân nhắc đổi model hoặc thêm dashboard.

## Kiểm tra phần mềm

Backend: 376 test pass, gồm các model integration test và 50 test evaluation. Frontend: 125 pass, lint/build pass; npm audit không có vulnerability, pip check không có dependency hỏng. Một cảnh báo deprecation từ Starlette/AnyIO. Reviewer độc lập và tích hợp được ghi ở tài liệu bàn giao cuối; số test không phải độ chính xác AI.
