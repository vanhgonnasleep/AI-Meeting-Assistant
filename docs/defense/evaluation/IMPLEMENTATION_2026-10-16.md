# Bàn giao Gói A

Bộ thực nghiệm CLI đã triển khai đủ manifest, chuẩn hóa/metric tiếng Việt, chuẩn bị FLEURS có kiểm checksum, adapter cách ly storage, runner lưu từng bước, báo cáo offline và phiếu chấm thủ công. Xem [kết quả pilot](2026-10-16-pilot/README.md) và [hướng dẫn chạy/chấm](../../../evaluation/README.md). Không thêm dashboard, không đổi prompt hay hành vi trả về của pipeline production.

## Review độc lập và sửa lỗi

Một reviewer độc lập kiểm tra toàn branch (baseline `1eef0ac`, head được review `efa2586`), chạy lại 44 test evaluation, đối chiếu cả 40 metric ASR với raw text và kiểm 9 checksum. Không có Critical; hai Important đã được tái hiện RED rồi sửa GREEN trong commit `cdb3a4e`:

- Run bị ngắt từng có thể tính F1 trên các case đã hoàn tất, bỏ qua case chưa chạy. Renderer hiện suy ra ma trận case × variant từ input đóng băng, hiển thị planned/attempted/completed/failed/unattempted và cấm F1 từ tập con. Có test cho cả variant chưa bắt đầu.
- Preflight từng buộc ASR phải có Ollama và text phải có Whisper cache. Run hiện xác định khả năng cần từ manifest; CLI có `preflight --kind asr` và `--kind nlp_text`. Test xác nhận ASR không gọi Ollama và NLP không kiểm checkpoint.

Executor còn phát hiện Git đổi newline sẽ làm lệch checksum khi checkout; `.gitattributes` giữ nguyên byte của evidence và có regression RED→GREEN. Raw inference gốc không thay đổi; chỉ tái sinh báo cáo để bổ sung coverage. Không yêu cầu reviewer thứ hai; theo Native, xác minh bản sửa bằng test và full suite.

## Quyết định đã thực hiện

1. Dùng PyArrow tùy chọn để đọc Parquet chính thức khi Dataset Viewer `/rows` lỗi. Chi phí: tooling thêm khoảng 28 MB và tải shard 691 MB; nếu wheel không phù hợp phải chuẩn bị lại trên môi trường hỗ trợ. Không thêm dependency runtime ứng dụng.
2. Mở rộng phần thảo luận synthetic nhưng không thêm cam kết để MMR vượt ngưỡng xử lý hiện có. Chi phí nếu nhãn không còn phù hợp: người dùng phải sửa/duyệt lại trước khi chấm; không tự đánh dấu đã duyệt.
3. Tách gate review/tích hợp ra sau task-done theo Native, dù plan gộp ở Task 5. Chi phí nếu sai: chỉ thứ tự ghi sổ; cả review và tích hợp vẫn bắt buộc.
4. Giữ heuristic sau JSON array rỗng theo contract production; metadata ghi đúng fallback. Chi phí: vẫn có thể có false positive trong tình huống không có task; chưa tuyên bố chất lượng NLP.
5. Không suy rộng sang diarization/họp tự nhiên từ pilot tiếng đọc. Chi phí: cần corpus hội họp có đồng ý sử dụng để đo phần đó.
6. Chấp nhận review nguồn/test/artifact mà không chạy inference thật lần hai hay đọc thư viện OAuth. Chi phí: review này chưa loại trừ mọi khác biệt môi trường hoặc lỗi runtime riêng tư; có lần inference thật và kiểm thử storage tạm làm bằng chứng giới hạn.

## Minor để sau

Metadata JSON từ Dataset Viewer kiểm giới hạn 4 MiB **sau khi buffer response**. Nên stream metadata và dừng trong lúc đọc; hiện response bất thường có thể dùng RAM vượt mức đó trước khi bị từ chối. Các payload audio, model và Parquet đã có giới hạn streaming. Đây là minor được reviewer nêu và được ghi rõ, chưa sửa trong vòng fix Important.

## Công việc cần con người

Chưa có gold NLP được người dùng duyệt hoặc phiếu chấm hoàn tất; không có F1 chất lượng AI. Pilot có một fallback và các false positive rõ ở hủy việc/không có task. Trước bảo vệ, ưu tiên duyệt nhãn, chấm và phân tích những lỗi này. Sau bảo vệ mới mở rộng dữ liệu họp thật và cải thiện prompt/model dựa trên tập dev riêng; không tune trên chính test rồi báo như test chưa từng dùng.

Không push remote. Benchmark stash, worktree không liên quan và phiên đăng nhập thật được giữ nguyên; thực nghiệm dùng dữ liệu công khai/synthetic và storage tạm.

Xác minh cuối: **376 backend pass** (50 evaluation), **125 frontend pass**, lint/build pass, npm audit 0, pip check sạch. Một upstream deprecation Starlette/AnyIO. [Ledger thực thi](EXECUTION_LEDGER_2026-10-16.md) lưu RED→GREEN, commit range và các quyết định.
