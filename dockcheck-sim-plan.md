# DockCheck Sim — thiết kế MVP và thí nghiệm v2

## 1. Mục tiêu và ràng buộc

Nhóm 12 có 4 người, laptop và trình duyệt, không có camera/phần cứng khác; 120 phút build. Đề `Vin Perception Hackathon.html` cho phép demo bằng sim. Đầu ra bàn giao là một file HTML offline, không CDN hoặc thư viện phải tải. Đây là thiết kế để build; chưa có code demo hoặc kết quả thực nghiệm.

**Đề tài:** DockCheck Sim — Công cụ kiểm thử quyết định căn chỉnh robot từ ảnh tổng hợp.

**Người dùng trực tiếp:** kỹ sư kiểm thử perception cho robot giao hàng nội bộ. Đây là người dùng mục tiêu giả định gắn với Vin Robotics, chưa phải nhu cầu đã được xác minh từ đơn vị.

**Đầu ra hữu ích:** bảng cho biết ca nào gây báo đạt nhầm, ca nào không được xác nhận và chi phí thời gian của hai chính sách. Simulator biết vị trí thật để làm đáp án; thuật toán đọc lại ảnh để kiểm tra ảnh và hiệu chuẩn sai ảnh hưởng tới quyết định như thế nào.

**Câu hỏi thí nghiệm:** yêu cầu các quan sát hợp lệ trong 500 ms làm thay đổi bao nhiêu lượt báo đạt nhầm, lượt xác nhận được và thời gian chờ so với quyết định từng frame?

Không đặt trước kết luận chính sách nào tốt hơn. MVP xác nhận **vị trí và hướng hợp lệ tại các mẫu quan sát liên tiếp**, không xác nhận robot đứng yên. Robot vẫn có thể chuyển động trong vùng cho phép. Đo vận tốc/biến thiên tư thế để xác nhận đứng yên nằm ngoài MVP.

## 2. Phạm vi lõi và giao diện

**Bắt buộc:** thế giới 2D nhìn từ trên xuống; ảnh tổng hợp; đọc pixel; suy tư thế và toàn bộ thân; xử lý mất dấu; hai chính sách chạy đồng thời; bộ ca cố định; số đo có mẫu số; một preset sai hiệu chuẩn tái lập được; tương tác tại chỗ và xuất CSV.

**Mở rộng có thể cắt:** phối cảnh/homography, hiệu ứng đẹp, replay toàn bộ ảnh. Không phụ thuộc mô phỏng vật lý 3D, điều hướng tự động hoặc model học máy.

Màn hình gồm thế giới và ảnh quan sát, kết quả A/B, điều khiển vị trí/góc/nhiễu/che dấu, nút chạy bộ thử và bảng kết quả. Ghi rõ ảnh tổng hợp 2D. Chạy tương tác tự do không cộng vào bộ đánh giá đã khóa.

Chỉ cân nhắc phối cảnh sau phút 60 khi lõi vượt checkpoint. Phải nằm trong renderer/calibration riêng và có thể tắt; đến phút 75 chưa chạy xuyên suốt thì bỏ khỏi demo. Kết quả có phối cảnh báo riêng, không trộn với bộ 2D.

## 3. Quy ước khóa trước khi code

Các số dưới đây là tham số thiết kế v2 để triển khai, không phải ngưỡng đã tối ưu hoặc đo trên robot thật.

| Đại lượng | Quy ước |
| --- | --- |
| Đơn vị | `u`: đơn vị chiều dài mô phỏng; ảnh dùng px, thời gian dùng ms |
| Thế giới | 100 × 60 u; gốc góc trên trái; x sang phải, y xuống dưới |
| Canvas camera | 640 × 400 px; ánh xạ thật `px = 20 + 6*x`, `py = 20 + 6*y` |
| Robot | Dài 12 u theo trục tiến, rộng 8 u; tư thế `(x,y,theta)` tại tâm |
| Góc | 0° hướng +x, dương theo chiều kim đồng hồ; nội bộ radian chuẩn hóa về [-π,π) |
| Hai dấu | Tâm cục bộ (+4,0) và (-4,0) u; hai màu khác nhau, bán kính 1 u |
| Dock | x ∈ [40,60], y ∈ [20,40] u, hướng mục tiêu 0° |
| Vùng cho phép | Dock chừa biên 1 u: x ∈ [41,59], y ∈ [21,39] |
| Hình học đạt | Cả bốn góc thân trong vùng cho phép, tính cả biên; lệch hướng tuyệt đối ≤5° |
| Chính sách B | Quan sát đạt liên tiếp ≥500 ms; khoảng ngắt tối đa 150 ms |
| Bộ thử | Mỗi lượt 5.000 ms; lấy mẫu mỗi 50 ms, gồm 101 mẫu từ t=0 đến t=5.000 |

Bốn góc thân: quay các điểm cục bộ `(±6,±4)` theo theta rồi cộng tâm. Dock lồi nên kiểm tra bốn góc đủ cho thân chữ nhật. Tính lệch hướng theo góc vòng tròn, tránh lỗi tại ±π.

## 4. Pipeline và hợp đồng dữ liệu

`WorldState → render ảnh → ImageData → tìm hai màu → đổi tọa độ → tư thế/thân ước lượng → A và B → Evaluator`.

Perception chỉ nhận ImageData và Calibration; không nhận WorldState, cấu hình nhiễu, seed, nhãn hoặc cờ che dấu. Chính sách chỉ nhận cùng một Observation và timestamp. Tọa độ thật dành cho renderer và evaluator. Kích thước thân/vị trí gắn dấu là cấu hình hình học biết trước, được phép dùng.

- `WorldState = {x, y, theta}`.
- `Calibration = {scale, offsetX, offsetY}`; bản đúng `{6,20,20}`.
- `Observation = {tMs, valid, reason, pose, footprint, geometryPass}`; pose/footprint null khi invalid; geometryPass không phải nhãn thật.
- `PolicyResult = {state, ready}`; state là NOT_READY, CHECKING, READY, UNKNOWN.
- `TrialConfig = {id, world, noiseAmplitudePx, occlusionSchedule, calibration, seed, durationMs, sampleMs}`.

Lõi nhận màu: nền/thân không dùng màu dấu. Dấu đầu đỏ `(240,40,40)`, dấu sau xanh `(40,80,240)`. Mask đỏ `R>180,G<100,B<100`; mask xanh `B>180,R<100,G<160`. Lấy trọng tâm pixel mỗi màu. Mỗi màu cần ít nhất 25 pixel; khoảng cách hai tâm sau đổi tọa độ nằm trong [6,4;9,6] u. Thiếu màu hoặc sai điều kiện thì invalid; không thay bằng tư thế cũ. Đây là kiểm tra hợp lệ đơn giản, chưa phải xác suất tin cậy được hiệu chuẩn.

Đổi tọa độ ảnh sang thế giới ước lượng bằng Calibration. Tâm robot là trung điểm hai dấu; hướng từ dấu sau tới dấu đầu. Từ đó dựng toàn bộ thân. Nền không có vật trùng màu là giới hạn công khai.

## 5. Hai chính sách và khoảng ngắt frame

**A — baseline một frame:** valid và geometryPass thì READY; valid nhưng không đạt thì NOT_READY; invalid thì UNKNOWN.

**B — quan sát đạt liên tiếp 500 ms:** mẫu đạt đầu lưu `candidateSince=tMs`, trả CHECKING. Mẫu tiếp tục đạt và cách mẫu trước ≤150 ms thì giữ bộ đếm; tới 500 ms mới READY. Invalid hủy bộ đếm, trả UNKNOWN; hình học không đạt hủy bộ đếm, trả NOT_READY. Không trì hoãn hủy READY.

Timestamp phải tăng. Khi tab ẩn, cả hai xóa READY, B xóa bộ đếm và đánh dấu gián đoạn. Khi tiếp tục hoặc khoảng ngắt >150 ms, hủy lịch sử trước khi xử lý mẫu mới; B đếm lại từ mẫu đạt đầu sau gián đoạn. Thời gian không quan sát không được cộng vào 500 ms.

Interactive dùng timestamp thực từ đồng hồ monotonic của browser. Batch dùng timestamp mô phỏng cố định, ghi rõ thời gian xác nhận trong batch là ms mô phỏng. Tab ẩn trong batch thì tạm dừng, không sinh thêm kết quả bằng wall-clock; mẫu/timestamp của từng lượt vẫn theo lịch 50 ms khi chạy tiếp.

A và B luôn nhận **cùng một Observation tại cùng tMs**. Không chạy perception hai lần với nhiễu khác nhau. Không cần lưu/replay toàn bộ ảnh để so sánh chính sách.

## 6. Nhiễu và bộ ca khóa trước

**Nhiễu lõi:** dịch tâm vẽ từng dấu màu theo x/y trước khi rasterize ảnh. Mỗi thành phần độc lập, phân phối đều [-a,a] px, PRNG có seed. Thân và WorldState không đổi. Đây là sai lệch vị trí dấu trên ảnh, không phải mô hình đầy đủ của rung camera hay sensor.

**Che dấu:** không vẽ dấu đầu trong khoảng đã định. Perception chỉ nhận ảnh, tự phát hiện thiếu màu. Vẫn tiêu thụ cùng số mẫu PRNG mỗi timestamp dù dấu bị che để giữ chuỗi tái lập.

**Sai hiệu chuẩn:** giữ ảnh nguyên, đổi Calibration trong bước ảnh → thế giới. Không thêm nhiễu vào tọa độ sau perception rồi gọi là đã thử qua pixel.

Khóa generator/seed/config thành `suite-v1` trước khi xem kết quả. Dùng PRNG xác định như xorshift32, seed khác 0, khởi tạo lại đầu mỗi lượt; ghi algorithm và seed trong kết quả. Năm seed: 101,202,303,404,505.

Một lượt = một tư thế thật cố định chạy 5.000 ms; reset chính sách và PRNG trước lượt. Evaluator tính nhãn từ WorldState và quy tắc mục 3, không từ pose ước lượng. Nhãn thật cố định suốt lượt giúp mẫu số và thời gian xác nhận rõ ràng. Robot di chuyển thuộc tương tác minh họa ngoài bộ này.

| Nhóm | x; y; góc | Nhiễu a | Che dấu | Nhãn thật | Số lượt |
| --- | --- | --- | --- | --- | --- |
| C1 | 50;30;0° | 0 px | Không | Đạt | 1 |
| C2 | 54,5;30;0° | 0 px | Không | Không đạt vị trí | 1 |
| C3 | 50;30;8° | 0 px | Không | Không đạt hướng | 1 |
| C4 | 50;30;0° | 0 px | `t mod 300 ∈ [250,300)` ms | Đạt | 1 |
| N1 | 52,7;30;0° | 3 px | Không | Đạt, gần biên | 5 seed |
| N2 | 53,3;30;0° | 3 px | Không | Không đạt, gần biên | 5 seed |
| N3 | 50;30;0° | 3 px | [1000,1800) và [3000,3800) ms | Đạt | 5 seed |

Tổng **19 lượt: 12 đạt, 7 không đạt; 1.919 mẫu cho mỗi chính sách; 95 giây mô phỏng**. Ca không nhiễu chạy một lần, không nhân bản đầu vào giống nhau thành nhiều mẫu độc lập. Báo theo nhóm và tổng gộp; tỷ lệ tổng phụ thuộc thành phần suite, không đại diện tần suất lỗi thực địa.

C4 kiểm tra chi phí của yêu cầu 500 ms: quan sát ngắt mỗi 300 ms có thể khiến B không xác nhận dù vị trí thật đạt. Đây là kết quả cần báo, không phải lý do âm thầm sửa ca.

Thay ngưỡng/seed/ca sau khi xem kết quả thì tăng phiên bản suite hoặc ghi là khám phá; giữ kết quả cũ để đối chiếu.

## 7. Chỉ số và cách báo cáo

| Chỉ số | Định nghĩa và mẫu số |
| --- | --- |
| Báo đạt nhầm theo lượt | Số lượt thật không đạt nhưng từng có READY / 7 lượt không đạt |
| Xác nhận đúng trong hạn | Số lượt thật đạt có READY ở t ≤5.000 ms / 12 lượt đạt |
| Không xác nhận trong hạn | Số lượt đạt không có READY tới hết hạn / 12 lượt đạt |
| Thiếu dữ liệu | Số mẫu perception invalid / tổng mẫu trong nhóm; toàn bộ là 1.919 mẫu. Dùng chung A/B; CHECKING không phải thiếu dữ liệu |
| Thời gian xác nhận | `t_READY đầu tiên - t_đạt thật` cho từng lượt thật đạt; bộ tĩnh có t_đạt thật=0. Đơn vị ms mô phỏng; timeout ghi riêng, không thay bằng 0 |
| Đổi trạng thái quyết định | Số lần boolean ready đổi giữa hai mẫu liên tiếp trong lượt; bỏ chuyển tiếp khởi tạo. Không phạt B chỉ vì có thêm CHECKING |

Báo thời gian xác nhận từng lượt. Nếu tổng hợp, dùng median các lượt được xác nhận, kèm số lượt và timeout; không giấu timeout bằng cách chỉ báo thời gian của ca thành công. Có thể đếm state đầy đủ để chẩn đoán riêng, nhưng A/B có tập state khác nhau.

CSV mỗi lượt có trialId, seed, suiteVersion, config, trueLabel và kết quả A/B; thiếu dữ liệu chỉ ghi một lần. Log Observation tùy chọn giúp kiểm tra chính sách, không cần log ảnh.

Không kết luận ít nhấp nháy là tốt hơn. Luôn đặt báo đạt nhầm, xác nhận đúng, timeout, độ trễ và đổi trạng thái cạnh nhau. Thời gian xử lý JavaScript nếu đo là wall-clock xử lý ảnh tổng hợp, không phải camera → robot thật.

## 8. Ca lỗi cố định ngoài bộ đánh giá chính

**Preset `calibration-bias-v1`:** robot tại x=54,5; y=30 u; góc 0°; nhiễu 0; không che; Calibration sai `{scale:6,offsetX:32,offsetY:20}`; 5.000 ms. Không cần seed ngẫu nhiên.

Theo mô hình: mép phải thật 54,5+6=60,5 u vượt biên cho phép 59. Hiệu chuẩn sai dịch vị trí ước lượng -2 u: tâm khoảng 52,5, mép phải khoảng 58,5 u, có thể được xem là đạt. Chờ 500 ms không loại sai lệch cố định này.

Đây là **dự kiến từ hình học**, chưa phải kết quả đã chạy. Phải xác minh qua đường pixel khi build. Preset là ca thách thức công khai ngoài 19 lượt chính, không thêm vào mẫu số đã khóa. Nếu phải chỉnh vì rasterization/implementation, lưu phiên bản mới và ghi rõ khám phá lỗi.

## 9. Đo tác động trong phạm vi demo

So sánh thao tác thủ công 19 ca với nút chạy tự động cùng suite/seed/hai chính sách, cùng tốc độ thời gian thực 1×. Mỗi lượt vẫn 5 giây; không tăng tốc riêng tự động để tạo lợi ích giả.

Wall-clock thủ công: từ BẮT ĐẦU BỘ THỬ trước khi chọn ca đầu đến khi lưu kết quả cuối. Tự động: từ CHẠY TOÀN BỘ đến khi lưu kết quả cuối. Cùng phạm vi ghi kết quả, cùng người thao tác, có lượt làm quen. Ghi thứ tự chạy, tổng click; giữ tab foreground. Nếu gián đoạn, ghi lý do và chạy lại cặp so sánh.

`ΔT = T_thủ_công - T_tự_động`; `tỷ lệ giảm = ΔT / T_thủ_công × 100%`. Kết quả âm thì báo tự động chậm hơn. Một cặp chỉ là minh họa n=1, không suy ra năng suất tổ chức hay tác động ở Vin. Chưa đo thì không điền số lợi ích.

Batch có thể chạy nhanh khi phát triển nhưng phải tách khỏi phép impact 1×. Không trộn thời gian mô phỏng với wall-clock.

## 10. Chia quyền sở hữu và lịch build

Một file HTML là **đầu ra bàn giao**. Trong lúc build làm ở file riêng, một người tích hợp; tránh bốn người cùng sửa một file.

| Người | Sở hữu | Hợp đồng |
| --- | --- | --- |
| 1 | world.js, renderer.js | ImageData từ WorldState và cấu hình ảnh |
| 2 | perception.js | Observation từ ImageData + Calibration; không import WorldState |
| 3 | policies.js, evaluation.js | Hai chính sách, suite-v1, chỉ số và CSV |
| 4 | index.html, app.js, HTML bàn giao | Điều khiển, tích hợp, giao diện, pitch/video |

Chốt giao diện dữ liệu trong 10 phút đầu. Bản bàn giao nhúng script nội bộ, không import/fetch file ngoài; mở trực tiếp bằng file://. Có thể ghép script thủ công theo namespace/thứ tự đã thống nhất, không cần bundler.

| Phút | Mốc bắt buộc |
| --- | --- |
| 0–10 | Khóa tham số, hợp đồng dữ liệu, suite và quyền sửa file |
| 10–30 | Vòng 2D đầy đủ: ảnh → pixel → tư thế/thân → quyết định A |
| 30–50 | B cùng Observation với A, mất dấu, chạy C1–C4 có nhãn |
| 50–60 | Sửa lỗi/checkpoint; chưa đạt thì bỏ mở rộng |
| 60–80 | Hoàn thiện suite/CSV, ca hiệu chuẩn sai; chỉ thử phối cảnh khi lõi ổn, cắt ở phút 75 nếu chưa xong |
| 80–100 | Chạy suite cố định, xác minh ca lỗi, đo thủ công/tự động nếu kịp |
| 100–120 | Tương tác bất ngờ, quay lại tab, ghép HTML offline và khóa demo |

15 phút chuẩn bị sau build theo lịch dành cho video dự phòng và tập trình bày.

## 11. Tiêu chí hoàn thành

- HTML bàn giao mở khi tắt mạng, tương tác/suite chạy, không request tới CDN/tài nguyên ngoài.
- C1: A xác nhận mẫu đạt đầu; B không trước 500 ms. C2/C3: không READY khi không nhiễu và hiệu chuẩn đúng.
- C4: mẫu thiếu dấu cho UNKNOWN ở cả hai; B không cộng dồn các đoạn ngắn rời nhau.
- Ẩn tab hoặc gap 200 ms: B hủy bộ đếm, không dùng thời gian gián đoạn để READY.
- Policy không đọc WorldState; perception không đọc truth/config nhiễu; mất dấu được phát hiện từ pixel.
- Đủ 19 dòng kết quả; mẫu số 12/7 đúng; tổng 1.919 mẫu; A/B cùng Observation. Chạy lại suite-v1 cùng seed cho cùng kết quả quyết định.
- Ca hiệu chuẩn sai đi qua pixel và có bằng chứng lỗi, báo riêng ngoài suite.
- Nêu rõ số nào đã đo, thời gian mô phỏng hay wall-clock và giới hạn ảnh tổng hợp.

## 12. Nội dung đăng ký và pitch

**Tên:** DockCheck Sim — Kiểm thử quyết định căn chỉnh robot từ ảnh tổng hợp.

**Trụ cột:** Hình học (đổi tọa độ 2D, hướng/đường bao); Biểu diễn (pixel → dấu → tư thế); Thời gian (hai chính sách, khoảng ngắt); Bằng chứng (suite, seed, mẫu số, ca lỗi).

**Pitch:** “Chúng em xây công cụ cho kỹ sư kiểm thử perception của robot giao hàng. Từ cùng một ảnh tổng hợp, hệ thống so sánh xác nhận ngay với yêu cầu quan sát hợp lệ trong 500 ms. Bộ thử cho biết chính sách giảm được bao nhiêu báo đạt nhầm, phải chờ thêm bao lâu và bỏ lỡ bao nhiêu lượt hợp lệ. Ca hiệu chuẩn sai cho thấy giới hạn mà chờ lâu hơn cũng không khắc phục được.”

Demo 10 phút: 1 phút người dùng/câu hỏi; 4 phút tương tác, mất dấu, ca hiệu chuẩn sai; 2 phút suite, trade-off, impact đã đo và giới hạn; 3 phút hỏi đáp. Không tuyên bố đã xác nhận robot thật đứng yên, docking hoặc bàn giao thành công.
