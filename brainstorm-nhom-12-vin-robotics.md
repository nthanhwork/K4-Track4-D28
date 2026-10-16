# Brainstorm nhóm 12 — Vin Robotics

## Bối cảnh và nguồn

- Nhóm 12: **Thợ xem trẻ ăn**, 4 thành viên, đơn vị đăng ký **Vin Robotics**, theo ảnh người dùng gửi.
- Nguồn thể lệ: [Vin Perception Hackathon.html](./Vin%20Perception%20Hackathon.html).
- Thời gian: 15 phút chọn hướng, 120 phút build, 15 phút chuẩn bị; 10 phút demo và hỏi đáp. Checkpoint sau 60 phút build.
- Bắt buộc: chạy trực tiếp trên webcam/cảm biến/sim; ít nhất 2 trụ cột; một số đo kiểm chứng được; một ca lỗi có giải thích; dữ liệu do đội tự dựng/đóng vai.
- Rubric: kiến thức 25, demo 25, hữu ích 15, impact 15, bằng chứng 10, trình bày 10. Khi hòa, ưu tiên điểm demo rồi bằng chứng.
- Chưa biết cấu hình máy hoặc phần cứng. Đề xuất dưới đây **giả định có laptop và webcam**, không giả định có robot, GPU, máy in hoặc sim đã cài.
- Đã xem cấu trúc workspace và tìm tài liệu liên quan: thư mục `K4-Track4-D28` chưa có code được theo dõi; không có hệ thống sẵn để tái sử dụng trong phần đã kiểm tra.

Mục tiêu: chọn bài toán robotics nhỏ, có quyết định đầu ra rõ, dựng được sớm và giải thích được bằng kiến thức Track 4. Đây là đề xuất brainstorm, chưa phải sản phẩm đã chạy hay kết quả thử nghiệm.

## Shortlist

Đánh giá khả thi là nhận định thiết kế với giả định trên, không phải xác suất thành công đã đo.

| Ý tưởng | Người dùng và quyết định đầu ra | Demo tối thiểu | Kiến thức thể hiện | Rủi ro chính |
| --- | --- | --- | --- | --- |
| **DockCheck — kiểm tra robot vào vị trí bàn giao** | Kỹ thuật viên biết mô hình robot đã đúng vị trí/hướng để xác nhận bước bàn giao mô phỏng chưa | Di chuyển thẻ robot trên bàn; màn hình chỉ lệch và báo đạt/chưa đạt/chưa đủ dữ liệu | Hình học mặt phẳng, biểu diễn thân robot, trạng thái theo thời gian | Thẻ bị nâng khỏi mặt phẳng làm sai phép chiếu |
| **KitCheck — khay đủ linh kiện trước lắp ráp** | Nhân viên trạm biết slot nào đang thiếu vật trước khi chuyển khay | Đặt/bỏ vật màu trong 3–4 slot, hiện slot thiếu | Biểu diễn slot, thời gian chống nhấp nháy, dữ liệu đánh giá | Cùng màu chưa chắc cùng linh kiện; chỉ chứng minh hiện diện theo quy ước |
| **PickReady — chỉ vị trí có thể gắp trên bàn** | Người vận hành biết vật nằm ở đâu và có trong vùng làm việc không | Webcam phát hiện vật màu, đổi sang tọa độ bàn, đánh dấu ngoài vùng | Hình học, biểu diễn vùng/vật | Vật cao sai giả định phẳng; chưa chứng minh gắp thật |
| **RobotGuard — vùng hoạt động robot có phản ứng dừng trong sim** | Người thử nghiệm xem robot mô phỏng có dừng khi vật đại diện xâm nhập vùng không | Camera quan sát marker trên bàn, trạng thái điều khiển chuyển động trong sim | Hình học vùng, thời gian, xử lý mất quan sát | Nên chọn khi đã có sim/controller; marker không thay nhận diện người tự do |
| **GesturePilot — cử chỉ điều khiển robot mô phỏng** | Người vận hành thử lệnh trái/phải/dừng, chỉ chạy khi giữ cử chỉ hợp lệ | Webcam → cử chỉ → chuyển động trong sim | Mốc khớp, trạng thái thời gian, từ chối khi mất quan sát | Phụ thuộc model/sim; tránh thành màn hình nhận cử chỉ đơn thuần |
| **VisionHealth — robot phát hiện đầu vào thị giác xuống cấp** | Người thử nghiệm biết ảnh mờ, bị che hoặc quá cũ để tạm khóa quyết định mô phỏng | Làm rung/che camera, hiển thị chất lượng và trạng thái khóa | Chất lượng dữ liệu, timestamp, thời gian | Ngưỡng mờ phụ thuộc nền; ảnh ít chi tiết có thể báo sai |

**Ưu tiên DockCheck; KitCheck là phương án chuyển hướng.** RobotGuard đáng cân nhắc hơn nếu đội xác nhận đã có vòng lặp robot/sim chạy được. Chưa đủ thông tin để khẳng định một ý tưởng luôn tốt nhất trong mọi cấu hình đội.

## DockCheck: ý tưởng đề xuất

**Tên đăng ký:** DockCheck — Thị giác kiểm tra vị trí robot tại trạm bàn giao.

**Pitch:** “Robot tới gần trạm chưa đồng nghĩa đã đứng đúng chỗ. DockCheck dùng webcam để kiểm tra vị trí, hướng và độ ổn định của mô hình robot trước bước bàn giao mô phỏng; khi không quan sát đủ, hệ thống yêu cầu kiểm tra lại.”

Người dùng giả định là kỹ thuật viên thử nghiệm robot giao hàng nội bộ. Nhu cầu này cần được xác minh nếu phát triển tiếp; chưa có bằng chứng về quy trình nội bộ Vin Robotics.

### Bàn demo và đầu ra

1. Webcam cố định nhìn tờ giấy/mặt bàn phẳng có kích thước biết trước và một vùng dock hình chữ nhật.
2. Thẻ bìa mỏng đại diện robot, có hai miếng màu khác nhau đặt dọc trục tiến, với kích thước và vị trí gắn đã biết. Hai màu phân biệt đầu và đuôi. Nếu ArUco đã sẵn và chạy ổn, có thể dùng marker thay thế.
3. Chọn bốn điểm chuẩn không suy biến để đổi tọa độ ảnh sang tọa độ mặt bàn. Các điểm theo dõi phải nằm gần mặt phẳng đó. Camera phải giữ nguyên sau hiệu chuẩn.
4. Tính vị trí, hướng và đường bao thân mô hình trong tọa độ bàn. Dùng toàn bộ đường bao để kiểm tra nằm trong vùng dock đã chừa biên; tâm chỉ phục vụ chỉ dẫn.
5. Hiển thị `CHƯA ĐẠT`, `ĐANG XÁC NHẬN`, `ĐẠT`, `CHƯA ĐỦ DỮ LIỆU`. Khi hình học hợp lệ nhưng gần biên chưa phân biệt chắc, có thể yêu cầu kiểm tra lại.
6. Chỉ vào `ĐẠT` sau một khoảng ổn định liên tục, chẳng hạn 0,5 giây là tham số khởi đầu để thử. Hủy `ĐẠT` ngay khi frame được xử lý cho thấy mất quan sát hoặc điều kiện bị vi phạm; khi thấy lại, đếm từ đầu. Không giữ trạng thái đạt bằng kết quả cũ.

Đầu ra là kiểm tra căn chỉnh của mô hình bàn. Không suy từ đó rằng robot thật đã docking, sạc hoặc giao nhận thành công.

OpenCV hỗ trợ phát hiện góc và ID ArUco; ước lượng pose 3D còn cần thông số hiệu chuẩn camera và kích thước marker. MVP tránh phụ thuộc pose 3D, dùng ánh xạ mặt phẳng. Xem [tài liệu ArUco của OpenCV](https://docs.opencv.org/4.13.0/d5/dae/tutorial_aruco_detection.html) và [tài liệu homography của OpenCV](https://docs.opencv.org/4.13.0/d9/dab/tutorial_homography.html).

### Trụ cột để điền bảng và giải thích

**Điền ngắn:** Hình học; Biểu diễn; Thời gian; Bằng chứng.

- **Hình học:** ảnh phối cảnh không phải bản đồ mặt bàn; đổi hệ tọa độ rồi mới đo lệch. Nêu rõ điều kiện đồng phẳng và ảnh hưởng méo camera.
- **Biểu diễn:** mô hình robot có thân và hướng, không chỉ một điểm tâm. Chọn đường bao vì tâm nằm trong dock vẫn có thể để đuôi vượt mép.
- **Thời gian:** so sánh quyết định một frame với yêu cầu ổn định liên tục; báo cả lợi ích giảm đổi trạng thái và thời gian chờ tăng thêm.
- **Bằng chứng:** nhãn vật lý độc lập, phép đo ở vị trí không dùng để hiệu chuẩn, ca lỗi và giới hạn.

Chỉ thêm **Bất định** nếu đội thực sự biểu diễn/đánh giá độ tin cậy hoặc cơ chế từ chối kết luận, và giải thích giới hạn của nó. Một ngưỡng tùy chọn không tự chứng minh đã mô hình hóa bất định.

## Đo điều gì và trình diễn lỗi nào?

### Chuẩn kiểm tra độc lập

Dựng lưới/dấu trên giấy bằng thước. Nếu có thước đo góc, dựng thêm các hướng chuẩn. Nếu không có, chỉ đánh giá đúng/sai theo dấu hướng đã dựng, không công bố sai số góc định lượng.

Người phụ trách kiểm thử khóa nhãn trước khi xem dự đoán. Dùng 16 cấu hình minh họa:

- 4 cấu hình đạt rõ ràng.
- 4 cấu hình sai vị trí rõ ràng.
- 4 cấu hình sai hướng hoặc thân vượt mép.
- 4 cấu hình khó: sát biên/che khuất; báo riêng thay vì ép tất cả thành đặt sai.

Dùng thêm điểm kiểm tra bên trong mặt bàn, khác bốn điểm fit homography. Không lấy sai số tại chính bốn điểm hiệu chuẩn làm bằng chứng độ chính xác. Chọn dung sai sau khi biết sai số thực tế trong vùng làm việc; số đo nhỏ này không bảo đảm cho mọi điều kiện.

### Số đo cần báo cùng nhau

- **Báo đạt nhầm:** số cấu hình chắc chắn không đạt nhưng bị báo `ĐẠT`, kèm mẫu số.
- **Báo đạt đúng:** số cấu hình đạt được xác nhận đúng, kèm mẫu số.
- **Tỷ lệ chưa đủ dữ liệu/kiểm tra lại:** theo từng nhóm và toàn bộ lượt. Từ chối mọi lượt không thể được coi là hệ thống tốt chỉ vì không báo đạt nhầm.
- **Sai số vị trí:** đối chiếu các điểm kiểm tra với thước, nếu có chuẩn đo phù hợp.
- **Độ trễ xử lý:** từ lúc ứng dụng nhận frame đến quyết định. Báo riêng thời gian đợi ổn định; không gọi đây là tổng độ trễ camera → màn hình.

Chạy lại cùng dữ liệu cho baseline một frame và phiên bản có điều kiện thời gian nếu kịp. Không tối ưu số lần nhấp nháy bằng cách chấp nhận tăng trễ hoặc bỏ sót mà không báo cáo.

### Ca lỗi thật

**Nâng thẻ khỏi mặt bàn trong khi vẫn nhìn thấy hai điểm màu.** Homography phẳng có thể chiếu sai vị trí và báo đạt nhầm. Trình bày đây là hạn chế chưa giải quyết của MVP. Che marker rồi hệ thống chuyển sang chưa đủ dữ liệu là minh họa xử lý lỗi tốt, nhưng vẫn nên giữ ca hệ thống thực sự sai theo yêu cầu đề.

Mười sáu cấu hình chỉ là bằng chứng trong phạm vi demo, chưa đủ suy ra độ chính xác triển khai. Hiện chưa chạy thử và chưa có số đo.

## Phân vai 4 người và ngân sách build

| Người | Phần chính | Kết quả bàn giao |
| --- | --- | --- |
| 1 | Webcam và phát hiện hai màu/marker | Hai điểm/hướng, timestamp, cờ quan sát hợp lệ |
| 2 | Hình học và quyết định | Tọa độ bàn, đường bao thân, điều kiện đạt, trạng thái theo thời gian |
| 3 | Bàn thử và bằng chứng | Nhãn độc lập, cấu hình thử, replay/log, bảng đúng/sai |
| 4 | Giao diện và tích hợp | Màn hình chỉ dẫn, kết nối các phần, pitch, video dự phòng |

Chia việc không có nghĩa chờ cuối giờ mới ghép. Thống nhất đầu ra nhỏ ngay đầu: điểm ảnh/timestamp/valid → tọa độ bàn → trạng thái.

| Phút build | Mốc |
| --- | --- |
| 0–10 | Mở webcam, thấy hai điểm và hướng thay đổi đúng khi xoay thẻ |
| 10–15 | Đổi được tọa độ một điểm, có trạng thái mất quan sát; quyết định giữ hoặc chuyển hướng |
| 15–40 | Vòng webcam → tọa độ → chỉ dẫn trên màn hình chạy được |
| 40–60 | Đường bao và trạng thái; sẵn sàng checkpoint |
| 60–80 | Điều kiện ổn định, log và phản ứng mất quan sát |
| 80–105 | Thử cấu hình có nhãn, ghi kết quả và ca lỗi |
| 105–120 | Thử đầu vào bất ngờ, sửa lỗi tích hợp, khóa phạm vi |

Sau 120 phút build, dùng 15 phút chuẩn bị theo lịch để quay video dự phòng và tập demo. Không phụ thuộc UI cầu kỳ, train model, cài sim mới hoặc robot thật để hoàn tất MVP.

**Điều kiện chuyển hướng:** nếu trước phút 15 chưa có đầu vào và tọa độ cơ bản, chuyển KitCheck: camera cố định, 3–4 slot chứa vật màu, báo slot thiếu và trạng thái mất quan sát. Tận dụng segmentation đã làm. Nếu camera còn chưa mở được, phải giải quyết đầu vào trước; chuyển tên đề tài không khắc phục lỗi đó.

## Câu chuyện demo và impact

Theo lịch đề bài: 1 phút bài toán, 4 phút chạy trực tiếp, 2 phút kiến thức/số đo/ca lỗi/impact, 3 phút hỏi đáp.

Trong 4 phút demo, lần lượt: đúng vị trí → lệch thân/hướng → giám khảo tự di chuyển thẻ → che điểm theo dõi → nâng thẻ khỏi mặt phẳng. Nói rõ trường hợp cuối có thể tạo kết luận sai.

Impact trình bày bằng công thức:

`Thời gian tiết kiệm/ngày = số lượt kiểm tra/ngày × số giây giảm mỗi lượt`.

Số lượt là giả định kịch bản nếu chưa có dữ liệu vận hành; số giây tiết kiệm phải đo so sánh cùng tác vụ hoặc ghi rõ là giả định. Không suy ra giảm tai nạn, chi phí hay thành công sạc từ demo bàn. Nếu phát triển tiếp, cần kiểm thử camera trên robot, hình học 3D, tải hàng, occlusion và giao diện điều khiển thực.

## Biên bản phản biện theo codex-brainstorm

### Cách thực hiện và giới hạn

Đã đọc skill `codex-brainstorm` và ba tài liệu references của nó. Phiên này không có Claude; file transport `codex-code-review/references/codex-transport.md` được skill trỏ tới không tìm thấy trong các thư mục skill đã kiểm tra. Vì vậy dùng hai phân tích Codex độc lập: bên chính hình thành A trước khi nhận kết luận bên độc lập; bên độc lập tự đọc thư mục và HTML, sau đó tiếp tục cùng agent qua ba vòng phản biện. Không gán lời cho Claude và không tuyên bố đã thực hiện đúng cặp mô hình Claude–Codex.

### Hai quan điểm ban đầu

- **A:** RobotGuard dùng camera cố định, marker trên mặt bàn, vùng bảo vệ, xử lý mất quan sát và phản ứng trong sim khi có sẵn. Ưu điểm: câu chuyện robotics và trạng thái lỗi trực quan. Nhược điểm tự xác định: marker không nhận diện người tự do, giới hạn phẳng và phụ thuộc sim.
- **B:** DockCheck dùng camera cố định, marker và trạng thái thời gian, hỗ trợ căn chỉnh mô hình tại trạm. Runner-up KitCheck. Ưu điểm: chuẩn kiểm tra vật lý dễ dựng, không cần robot; nhược điểm: chưa chứng minh docking thật.

### Vòng 1 — hữu ích và phạm vi hình học

**A công kích B:** căn marker có thể thành đồ chơi; pose 3D cần hiệu chuẩn; tâm marker không đại diện thân robot.

**B đáp:** thu hẹp sang kiểm tra điều kiện bàn giao, dùng homography 2D và mô hình bìa có hình học marker–thân biết trước. Không cần pose 3D.

**B công kích A:** theo dõi marker chưa quan sát người/vật tự do; khoảng cách tâm không bảo đảm không va chạm; thiếu sim thì đổi màu chưa tạo phản ứng robot; hai vật động khó đo hơn một trạm cố định.

**Cập nhật:** đồng ý giới hạn phẳng và không claim hệ an toàn; chưa thống nhất chọn đề tài.

### Vòng 2 — đường bao, thời gian và phụ thuộc

**A công kích B:** bốn góc fit không đủ chứng minh accuracy; thân có thể vượt vùng dù tâm đúng; giữ READY khi mất marker là sai; máy in/thư viện là rủi ro đầu giờ.

**B đáp/cập nhật:** kiểm tra tại điểm độc lập; dùng toàn bộ đường bao; hủy READY khi mất quan sát và đếm lại khi thấy; thẻ hai màu phân biệt đầu/đuôi là đầu vào ưu tiên nếu chưa có ArUco. Đặt mốc quyết định trong 15 phút.

**A cập nhật:** chuyển ưu tiên từ RobotGuard sang DockCheck. Còn cần khóa cách gán nhãn và ý nghĩa chưa đủ dữ liệu.

### Vòng 3 — bằng chứng và chống số đo gây hiểu nhầm

**A đề nghị:** 16 cấu hình có nhãn bằng thước/dấu vật lý, không lấy dự đoán làm nhãn; nhóm sát biên/che báo riêng; giữ ca nâng thẻ gây sai; công bố giới hạn và impact có giả định.

**B phản biện bổ sung:** tỷ lệ UNKNOWN cao có thể làm tỷ lệ báo đạt nhầm trông đẹp; phải báo cùng tỷ lệ báo đạt đúng, từ chối và thời gian xác nhận. Không có thước góc thì không báo sai số góc định lượng.

**Cập nhật chung:** nhận các bổ sung. Không còn phản biện làm đảo lựa chọn dưới giả định 4 người, 120 phút, webcam và chưa có robot.

### Trạng thái kết luận

**Đồng thuận có điều kiện sau 3 vòng:** chọn DockCheck khi đầu vào/hình học cơ bản chạy được trong 15 phút; chuyển KitCheck nếu không đạt mốc đó và camera/segmentation có thể tái dùng. RobotGuard trở lại danh sách ưu tiên nếu có sim/controller sẵn.

Đây là hội tụ thiết kế trong các điều kiện đã nêu, không phải chứng minh cân bằng Nash toán học hoặc bảo đảm ý tưởng tối ưu toàn cục. Chưa triển khai, chưa kiểm chứng runtime và chưa có kết quả đo thực tế.
