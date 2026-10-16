# Đánh giá phục vụ bảo vệ

Bộ công cụ chạy riêng với dữ liệu công khai và văn bản giả lập; không dùng thư viện cuộc họp hay `.env` của tài khoản.

Pilot ASR lấy các dòng đầu của `google/fleurs`, cấu hình `vi_vn`, split `test`. Đây là tiếng đọc, **không phải đánh giá hội thoại nhiều người nói hoặc diarization**. Nguồn: https://huggingface.co/datasets/google/fleurs, giấy phép CC-BY-4.0. Giữ nguyên attribution và checksum khi chia sẻ kết quả; nội dung transcript/audio thuộc bộ dữ liệu gốc.

API `/rows` có thể lỗi giới hạn quét; khi đó tải shard Parquet test chính thức (giới hạn 800 MiB) và đọc các dòng đầu. Cài dependency tùy chọn: `python -m pip install -r evaluation/requirements.txt`. Không lưu URL CDN có chữ ký. Cache được kiểm checksum, không tự ghi đè khi hỏng; dùng thư mục mới để chuẩn bị lại.

Sáu tình huống văn bản do dự án tự soạn đều là **synthetic**, reference chưa được người dùng duyệt. Không dùng chúng để công bố accuracy/F1 trước khi duyệt nhãn và ghép cặp thủ công. Bộ nhãn bao gồm task rõ ràng, hủy bỏ, không có task, đổi người phụ trách, ngày cụ thể và trộn Anh–Việt.
