# Gói A — Bộ thực nghiệm phục vụ bảo vệ Clarion

Trạng thái: người dùng đã duyệt; bộ thực nghiệm đã triển khai. Xem docs/defense/evaluation/2026-10-16-pilot/README.md để đọc số liệu thực và giới hạn.

## Mục tiêu đã thống nhất

Người dùng ưu tiên bảo vệ đồ án, hội đồng chấm nặng chất lượng AI và số liệu thực nghiệm, thời gian còn dưới một tuần. Hiện chưa có audio thật có nhãn và chưa thể rủ thêm người thu âm. Người dùng đã chọn Gói A: bộ đánh giá và báo cáo tái lập được. Gói B bổ sung màn hình so sánh trong ứng dụng được để sau.

Audit nền đã hoàn tất: tám lỗi được sửa, 326 test backend và 125 test frontend pass. Báo cáo chi tiết: [post-OAuth audit](../../POST_OAUTH_AUDIT_2026-10-16.md). Những số này chứng minh hành vi phần mềm, không phải độ chính xác AI.

## Phạm vi và phương án

Xây một công cụ thực nghiệm dòng lệnh, dùng lại pipeline hiện có, tạo báo cáo HTML độc lập, Markdown, CSV và JSON. Báo cáo lưu đầu vào, cấu hình, kết quả thô và lỗi của từng mẫu để có thể kiểm tra lại. Bộ benchmark tốc độ hiện tại tiếp tục dùng được.

Phương án được khuyến nghị là hoàn tất công cụ và có số liệu thật trước khi thêm dashboard. Màn hình Experiments chưa nằm trong đợt này. Việc thay model lớn, thay engine diarization, hàng đợi phân tán và tính năng cộng tác không thuộc Gói A.

## Dữ liệu và giới hạn kết luận

1. **ASR tiếng Việt:** lấy một tập pilot cố định 20 mẫu đầu của split test `vi_vn` từ [Google FLEURS](https://huggingface.co/datasets/google/fleurs). Dataset công khai có audio và transcript, theo CC BY 4.0. Lưu ID mẫu, nguồn, attribution, revision nếu có, SHA-256 audio và transcript chuẩn. Đây là mẫu đọc tiếng Việt; không dùng kết quả này để kết luận về hội thoại nhiều người hoặc chất lượng diarization. Tập pilot nhỏ không đại diện cho toàn bộ tiếng Việt.
2. **Task/tóm tắt/MMR:** sáu tình huống văn bản tiếng Việt do nhóm dự án biên soạn, có việc giao rõ ràng, phủ định/hủy việc, không có việc cần làm, đổi người phụ trách, deadline rõ ngày và nội dung Việt/Anh. Ghi rõ đây là tình huống mô phỏng bằng văn bản, không phải hội thoại tự nhiên. Nhãn tham chiếu ở trạng thái chờ người dùng kiểm tra; công cụ không tự đánh dấu nhãn là đã được con người duyệt.
3. Có thể bổ sung audio một người tự thu sau đó, nhưng phải ghi đúng loại dữ liệu. Không tạo nhiều “người nói” giả rồi báo cáo như một phép đánh giá tách giọng.

Mỗi mẫu có ID, loại dữ liệu, split, nguồn/license, đầu vào, transcript chuẩn hoặc các nhãn phù hợp, trạng thái duyệt nhãn và checksum. Trường không áp dụng phải được phân biệt với nhãn rỗng. Ví dụ, mẫu ASR không có nhãn task không được coi là một cuộc họp không có task.

Tải dữ liệu là một bước riêng, giới hạn dung lượng và có kiểm tra lỗi. Không đưa token, URL ký tạm thời hoặc secret vào manifest/báo cáo. Cache và lượt chạy được lưu trong thư mục bị Git bỏ qua. Không đọc hoặc ghi thư viện cuộc họp của tài khoản thật.

## Hai thí nghiệm chính

**A. Whisper tiny và base trên cùng 20 mẫu tiếng Việt.** Cố định language=vi và các thiết lập giải mã có thể kiểm soát; ghi lại phiên bản pipeline/model, thiết bị thực tế, lỗi từng mẫu và thời gian. Kiểm tra cache trước khi chạy; việc tải trọng số phải là lựa chọn rõ ràng của lệnh chạy, không diễn ra ngầm trong bước chấm điểm.

Chỉ số chính là CER; bổ sung WER với tokenizer khoảng trắng được mô tả rõ, vì đơn vị tách bằng khoảng trắng trong tiếng Việt không luôn tương ứng một từ ngôn ngữ học. Chuẩn hóa Unicode NFC, casefold, khoảng trắng và dấu câu theo một hàm cố định, giữ dấu tiếng Việt và chữ số. Ghi cả văn bản gốc và bản dùng chấm. Tổng hợp theo tổng số lỗi/tổng số đơn vị tham chiếu, không lấy trung bình đơn giản các tỷ lệ của câu dài ngắn khác nhau. Mẫu tham chiếu rỗng không được chia cho 0 hoặc tự chấm thành 100%; vẫn báo số từ/ký tự chèn và trạng thái không áp dụng.

RTF được ghi rõ phạm vi đo: decode + transcription sau khi model đã được nạp, chia cho thời lượng audio. Thời gian nạp/tải model được tách riêng. Mẫu chạy lỗi phải xuất hiện trong báo cáo và mẫu số coverage; không âm thầm loại mẫu khó khỏi kết quả.

**B. MMR tắt/bật trên cùng các tình huống văn bản.** Giữ cùng model LLM và thiết lập sinh; mặc định dùng model Ollama hiện đã có thay vì thêm model mới. Cấu hình MMR ban đầu là lambda=0.65, target_ratio=0.55. Lưu transcript trước/sau lọc, đầu ra task/tóm tắt, thời gian và mọi cảnh báo/fallback. Tỷ lệ giảm từ được gọi đúng là giảm độ dài, không được gọi là độ chính xác hay tỷ lệ loại bỏ nhiễu ngữ nghĩa.

Task và tóm tắt được đánh giá bằng phiếu chấm có nhãn tham chiếu và đoạn bằng chứng. Người dùng đối chiếu task đúng/thừa/thiếu, người phụ trách, deadline; với tóm tắt, đối chiếu ý quan trọng được giữ và ý không có căn cứ. Chỉ tổng hợp precision/recall/F1 hoặc tỷ lệ đúng sau khi có đối chiếu thủ công và nhãn đã duyệt. Nếu chưa chấm, hiển thị “chưa đánh giá”, không suy diễn điểm từ độ giống chuỗi hoặc từ một LLM khác. Báo rõ hiện chỉ có một người gán/chấm nhãn; không tuyên bố độ đồng thuận liên giám khảo.

Không có điều kiện buộc MMR phải thắng. Nếu giảm thời gian nhưng bỏ sót việc cần làm, báo cáo phải thể hiện đánh đổi đó. Không tối ưu tham số dựa trên kết quả test rồi trình bày cùng tập đó như tập kiểm tra chưa từng sử dụng.

## Cấu trúc dự kiến và khả năng tái lập

- `scripts/evaluate_pipeline.py`: các lệnh chuẩn bị dữ liệu, kiểm tra môi trường, chạy thí nghiệm và tạo báo cáo.
- `scripts/evaluation/`: manifest/validation, metrics, adapters dùng pipeline hiện có, runner và renderer báo cáo.
- `evaluation/fixtures/`: các tình huống văn bản và hướng dẫn chấm; nguồn và trạng thái duyệt nhãn được ghi kèm.
- Cache và `.evaluation-runs/<run-id>/`: audio, manifest đã đóng băng, cấu hình, output từng mẫu, lỗi, bảng chấm và báo cáo.
- Test thuật toán/CLI trong bộ test backend dùng dữ liệu nhỏ và adapter giả; việc chạy model thật là bước thực nghiệm riêng có lưu bằng chứng.

Metadata của mỗi lượt gồm commit Git/trạng thái cây làm việc, phiên bản Python/package, model ID/digest nếu lấy được, tham số, seed nếu engine hỗ trợ, checksum dữ liệu, thời gian, thiết bị và phạm vi đo. Không dump toàn bộ biến môi trường. Các đầu ra HTML phải escape transcript/model output; không nhúng nội dung người dùng thành mã chạy. Báo cáo không tải tài nguyên bên ngoài để có thể mở khi mất mạng.

Preflight phải tách khả năng LLM và STT: kiểm tra hiện tại thấy máy có RTX 4060 8 GB VRAM, khoảng 16 GB RAM, Ollama có `llama3:latest`, nhưng Whisper đang chạy CPU và Torch báo CUDA không khả dụng. Việc có GPU vật lý không được ghi thành “Whisper chạy GPU”. Đây là ảnh chụp trạng thái máy, không phải cam kết tốc độ.

## Nghiệm thu

- Các metric có test biết trước kết quả, bao gồm tiếng Việt có dấu, chuỗi rỗng, chèn/xóa/thay thế và tổng hợp trọng số.
- Một manifest cố định chạy được nhiều cấu hình và tạo đủ kết quả từng mẫu; lỗi/thiếu model/thiếu nguồn được báo rõ.
- Có ít nhất một lượt ASR thực chạy trên dữ liệu công khai đã tải thành công; mọi số liệu báo cáo lấy từ artifact thực.
- Có so sánh MMR với output thô và bảng chấm; chưa duyệt/chấm thì không có điểm NLP giả.
- Mở được HTML offline và xuất CSV/JSON/Markdown; báo cáo ghi nguồn dữ liệu, phương pháp, giới hạn và hướng dẫn chạy lại.
- Kiểm tra hồi quy phù hợp và phiên bản code dùng thí nghiệm được ghi nhận. Không thay đổi thư viện tài khoản thật trong quá trình đo.

Ưu tiên hoàn thành một vòng dữ liệu → chạy → đối chiếu → báo cáo trong thời gian còn lại, rồi mới mở rộng số mẫu hoặc giao diện.
