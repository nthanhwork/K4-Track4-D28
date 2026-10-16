# DockCheck Sim — phạm vi không có phần cứng

## Ràng buộc đã xác nhận

Nhóm 12 có 4 người, laptop và trình duyệt; không có camera hoặc phần cứng khác. Có 120 phút build. Đề trong `Vin Perception Hackathon.html` cho phép demo trực tiếp bằng mô phỏng. Tài liệu này thay thế phương án webcam trong báo cáo brainstorm trước; chưa có code demo.

## Đề tài chốt

**DockCheck Sim — kiểm tra vị trí robot tại trạm bàn giao khi ảnh quan sát bị nhiễu.**

Một file HTML chứa HTML/CSS/JavaScript thuần, mở offline trên trình duyệt. Không CDN, package, model, dataset tải về, camera hoặc robot thật. Hình ảnh dùng hình học Canvas và màu tự tạo.

Đây là mô phỏng để kiểm thử thuật toán căn chỉnh và xử lý chất lượng quan sát cho robot giao hàng nội bộ. Không khẳng định quy trình này đang được dùng tại Vin Robotics; chưa chứng minh hoạt động trên camera hay robot thật.

## Demo nhìn thấy gì?

- Bên trái: thế giới mô phỏng nhìn từ trên xuống, gồm thân robot hình chữ nhật, hai dấu màu phân biệt đầu–đuôi và vùng dock. Người xem kéo robot hoặc dùng điều khiển vị trí/góc.
- Bên phải: ảnh camera giả lập có phối cảnh; có thể bật rung điểm quan sát và che một dấu màu.
- Bảng quyết định: sai lệch vị trí/hướng; CHƯA ĐẠT, ĐANG XÁC NHẬN, ĐẠT hoặc CHƯA ĐỦ DỮ LIỆU.
- Bảng đo: số lượt báo đạt đúng/nhầm, tỷ lệ không đủ dữ liệu, thời gian chờ xác nhận. Có baseline một frame và chế độ xác nhận ổn định nếu đủ thời gian.

## Luồng dữ liệu bắt buộc

`Trạng thái thế giới → vẽ ảnh camera tổng hợp → đọc pixel tìm hai màu → đổi tọa độ → suy ra thân robot → kiểm tra vùng/hướng → trạng thái`.

Thuật toán nhận thức không được đọc tọa độ/góc thật hoặc cờ che khuất của thế giới. Tọa độ thật chỉ dành cho renderer và bộ đánh giá. Nhận màu dùng vùng màu đơn giản với nền khác biệt; không cần model học máy.

Phối cảnh áp dụng lên các góc của thân và dấu màu khi vẽ ảnh. Hiệu chuẩn ánh xạ ngược bằng bốn điểm chuẩn biết trước; điểm kiểm thử khác điểm hiệu chuẩn. Việc dựng ảnh và đổi tọa độ ngược có thể triệt tiêu sai số trong điều kiện lý tưởng; chỉ coi đây là kiểm tra tính đúng trong mô hình. Phải thử cả nhiễu điểm chuẩn/quan sát và công khai rằng thế giới thật phức tạp hơn.

Nếu chưa kịp dựng phối cảnh, dùng ảnh tổng hợp nhìn thẳng và đánh dấu rõ phạm vi 2D; không trình bày phép đổi tọa độ đồng nhất như đã giải quyết phối cảnh. Nếu chưa kịp đọc pixel, chỉ coi phiên bản đó là bản kiểm thử logic điều kiện docking, chưa hoàn thành phần nhận thức từ ảnh.

## Điều kiện đạt và thời gian

Đánh giá toàn bộ đường bao thân robot trong vùng dock hình chữ nhật đã chừa biên, cùng hướng cho phép. Dấu màu phải nhìn thấy và đủ điều kiện hình học cơ bản.

Chỉ vào ĐẠT sau thời gian ổn định liên tục, ví dụ 0,5 giây là tham số ban đầu. Khi quan sát không hợp lệ hoặc hình học không đạt, hủy ĐẠT ở lượt xử lý đó. Không dùng vị trí thật để bù cho dấu màu bị che.

## Ba tình huống trình diễn

1. Kéo robot vào đúng dock: chỉ dẫn thay đổi, sau một khoảng ổn định mới báo ĐẠT. Cho giám khảo tự thử vị trí và góc.
2. Đặt sát biên rồi bật nhiễu: so sánh baseline với xác nhận theo thời gian, báo cả đổi trạng thái và thời gian chờ tăng thêm.
3. Che một dấu màu: hệ thống chuyển CHƯA ĐỦ DỮ LIỆU. Sau đó thử ca sai thật: nhiễu các điểm hiệu chuẩn làm sai lệch phép đổi tọa độ, có thể gây báo đạt nhầm; nếu bộ cấu hình đã thử chưa tạo lỗi, không bịa kết quả mà tăng mức perturbation và ghi rõ điều kiện tạo lỗi.

Ca che khuất được xử lý đúng không thay thế yêu cầu cho thấy một trường hợp hệ thống thực sự làm sai. Không gọi tham số nhiễu tùy chọn là mô hình nhiễu camera đã hiệu chuẩn.

## Trụ cột

- Hình học: tọa độ thế giới, ảnh phối cảnh, ánh xạ ngược và thân robot.
- Biểu diễn: pixel màu → hai điểm có thứ tự → tư thế và đường bao.
- Thời gian: giữ điều kiện ổn định, đo đánh đổi trễ và nhấp nháy.
- Bằng chứng: ground truth của simulator chỉ dùng trong evaluator, tập tình huống và ca lỗi.

## Bằng chứng

Khóa trước các cấu hình rõ đạt, rõ không đạt và sát biên. Quy định nhãn từ hình học thế giới theo điều kiện vật lý đã chọn, không lấy đầu ra nhận thức làm nhãn. Cấu hình có che khuất vẫn có trạng thái vật lý, nhưng đầu ra được phép từ chối do thiếu thông tin.

Báo cùng nhau: báo đạt nhầm trên cấu hình không đạt; báo đạt đúng trên cấu hình đạt; tỷ lệ từ chối; thời gian chờ xác nhận. So sánh hai chế độ trên cùng chuỗi ảnh/nhiễu nếu làm replay. Không để mỗi chế độ gặp nhiễu ngẫu nhiên khác rồi kết luận hơn kém.

Độ trễ được đo trong browser chỉ là thời gian xử lý ảnh tổng hợp, không phải camera đến robot thật. Kết quả chỉ chứng minh các tình huống mô phỏng được chọn. Chưa có kết quả đo thực tế.

## Chia việc và 120 phút

1. Người 1: thế giới, điều khiển robot, renderer ảnh camera.
2. Người 2: tìm hai màu từ pixel, ánh xạ tọa độ, suy đường bao.
3. Người 3: trạng thái thời gian, cấu hình có nhãn, chỉ số.
4. Người 4: tích hợp, giao diện, pitch và video dự phòng.

Thống nhất giao diện dữ liệu nhỏ trước khi chia: ảnh → điểm/valid → tư thế → quyết định. Tích hợp sớm, một người chịu trách nhiệm ghép file.

| Phút | Kết quả cần có |
| --- | --- |
| 0–20 | Vẽ được robot/dock và điều khiển vị trí/góc |
| 20–45 | Camera tổng hợp và nhận hai điểm từ pixel |
| 45–60 | Ảnh → quyết định xuyên suốt, đủ checkpoint |
| 60–80 | Phối cảnh/hiệu chuẩn nếu chưa có, xử lý mất dấu và xác nhận ổn định |
| 80–100 | Nhiễu, bộ cấu hình và số đo |
| 100–120 | Thử tương tác bất ngờ, ca lỗi, khóa phạm vi |

Nếu trễ, cắt trang trí, tự động điều hướng và hiệu ứng trước. Không thêm mô phỏng vật lý 3D, SLAM, VLM, model train hoặc kết nối robot. Sau giờ build dùng 15 phút riêng theo lịch để quay video và tập trình bày.

## Nội dung điền bảng

**Tên đề tài:** DockCheck Sim — Kiểm tra vị trí robot tại trạm bàn giao trong điều kiện quan sát nhiễu.

**Trụ cột:** Hình học; Biểu diễn; Thời gian; Bằng chứng.

**Pitch:** “Chúng em xây môi trường mô phỏng để kiểm thử việc xác nhận robot đã đứng đúng vị trí bàn giao. Hệ thống quan sát ảnh tổng hợp, chỉ xác nhận khi đủ điều kiện, và từ chối khi mất dấu. Demo đo cả báo đạt nhầm lẫn thời gian chờ; các giới hạn khi chuyển sang camera thật được trình bày rõ.”
