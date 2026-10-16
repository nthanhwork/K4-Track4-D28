# Phân công nhóm 12 — DockCheck Sim, 120 phút

Dựa trên `dockcheck-sim-plan.md` v2. Chưa biết thế mạnh từng thành viên nên dùng vai trò 1–4; nhóm gán tên trong 2 phút đầu. Người vững JavaScript/debug nhất nhận vai 4. Đây là phân công, chưa phải các phần đã được thực hiện.

## Chốt chung trong 10 phút đầu

- Đọc bảng thông số mục 3 và cấu trúc Observation mục 4 của plan v2. Mọi góc nội bộ dùng radian; giao diện mới đổi sang độ. Timestamp dùng ms, chiều dài dùng u.
- Người 4 tạo khung HTML, hai canvas và config.js. Mỗi người chỉ sửa file mình sở hữu; đề nghị thay giao diện hàm trước khi đổi.
- JavaScript thuần, classic script, namespace `window.DC`; không module import, không CDN. Trong lúc phát triển index.html tải các script cục bộ; cuối buổi người 4 nhúng script thành một HTML độc lập.
- Nhận thức chỉ đọc ImageData và Calibration; A/B nhận cùng Observation. Nhiễu phải đi qua ảnh trước khi nhận màu.
- Mốc ghép đầu tiên phút 20, vòng thật xuyên suốt phút 30. Họp ngắn ở phút 30, 60, 90; lỗi chặn tích hợp báo ngay kèm đầu vào tái hiện.

## Người 1 — thế giới, ảnh tổng hợp và nhiễu

**Sở hữu:** world.js, renderer.js. Mục tiêu: cung cấp ảnh camera thật sự có thể đọc pixel.

**Việc theo thứ tự:**

1. Vẽ nền, dock, thân robot 12 × 8 u và hai dấu đỏ/xanh. Đầu đỏ ở (+4,0), đuôi xanh ở (-4,0).
2. Ánh xạ thế giới sang ảnh đúng `px=20+6*x`, `py=20+6*y`; camera 640 × 400 px.
3. Cung cấp ảnh sạch tại (50,30,0°), (54.5,30,0°), (50,30,8°) để người 2 thử.
4. Viết PRNG xorshift32 và dịch từng dấu màu trước khi vẽ; implement che dấu theo lịch. Đầu mỗi lượt reset seed, không reset mỗi frame. Tiêu thụ số mẫu RNG cố định dù che dấu.
5. Hỗ trợ người 3 tái hiện ca nhiễu/che và xác nhận renderer không vô tình đổi WorldState.

**Giao diện bàn giao:**

```text
DC.world.draw(ctx, world)
DC.renderer.createRng(seed) → rng
DC.renderer.render(cameraCtx, world, sensorConfig, tMs, rng) → ImageData
```

`sensorConfig` chỉ chứa noiseAmplitudePx và occlusionSchedule. Tách lớp camera với lớp hiển thị chú thích; chữ, khung debug hoặc nhãn màu không được vẽ vào ảnh trước khi perception đọc.

**Hạn:** phút 20 có ảnh sạch; phút 40 có nhiễu và che dấu; phút 60 đầu vào tái lập được theo seed.

**Tự kiểm:** tâm robot (50,30) chiếu thành (320,200) px; hai tâm dấu ở (344,200) và (296,200). Che dấu đầu thì ảnh mất vùng đỏ. Cùng seed + cùng chuỗi timestamp tạo cùng ảnh trên máy/trình duyệt demo.

## Người 2 — nhận màu, tư thế và hình học thân

**Sở hữu:** perception.js. Mục tiêu: từ pixel suy ra vị trí/hướng, không dùng tọa độ thật.

**Việc theo thứ tự:**

1. Quét ImageData, đếm pixel đỏ/xanh và tính trọng tâm theo ngưỡng trong plan.
2. Màu thiếu hoặc diện tích <25 pixel thì invalid; không trả vị trí cũ.
3. Dùng Calibration để đổi pixel → u. Kiểm tra khoảng cách dấu trong [6.4,9.6] u.
4. Tâm là trung điểm; hướng từ xanh sang đỏ; dựng bốn góc thân và tính geometryPass.
5. Thử dấu sát biên, góc 8°, che dấu, hiệu chuẩn offsetX=32. Ghi rõ sai khác do làm tròn/rasterization nếu có.

**Giao diện bàn giao:**

```text
DC.perception.estimate(imageData, calibration, tMs) → Observation
Observation = {tMs, valid, reason, pose, footprint, geometryPass}
```

`pose={x,y,theta}`, `footprint` gồm bốn điểm; invalid trả pose/footprint null và geometryPass=false. Policy luôn kiểm valid trước, không coi invalid là vị trí sai.

**Hạn:** phút 20 có detector thử được với ảnh đơn giản; phút 30 chạy ảnh từ người 1; phút 45 đủ đường bao, góc và invalid; phút 60 xử lý preset hiệu chuẩn sai.

Nếu renderer chưa bàn giao, dùng ảnh Canvas kiểm thử hai chấm tại vị trí biết trước để phát triển riêng. Fixture phải đi qua pixel, đánh dấu chỉ dùng phát triển; không thay thế pipeline thật tại checkpoint.

**Tự kiểm:** ảnh sạch trung tâm cho tư thế gần (50,30,0°); C2 sai vị trí và C3 sai hướng bị loại; che dấu thành invalid. Sai số pixel và làm tròn được đo trước khi chọn dung sai test, không mặc định kết quả phải bằng tuyệt đối.

## Người 3 — hai chính sách, suite và bằng chứng

**Sở hữu:** policies.js, evaluation.js, scenarios.js. Mục tiêu: so sánh A/B đúng và xuất số đo có mẫu số.

**Việc theo thứ tự:**

1. Viết A quyết định một frame; B yêu cầu đạt liên tiếp 500 ms. Invalid/không đạt/gap >150 ms phải xử lý đúng; t=0 là timestamp hợp lệ, không dùng kiểm tra truthy để xác định có candidateSince.
2. Viết thử chính sách bằng Observation dựng sẵn: đạt liên tục; đạt rồi mất dấu; đạt rồi sai hình học; gap 200 ms. Các thử này chỉ kiểm policy, không tính vào bằng chứng pixel của demo.
3. Chuyển bảng C1–C4/N1–N3 trong plan thành suite-v1 đủ 19 lượt, 12 đạt/7 không đạt. Preset calibration-bias-v1 để riêng.
4. Tính nhãn thật từ WorldState trong evaluator; tích lũy false READY, xác nhận đúng, timeout, invalid, thời gian xác nhận và chuyển đổi boolean ready.
5. Chạy lại cùng seed kiểm tra tái lập; phân tích cả ca B không xác nhận được, không chỉ ca B tốt hơn.

**Giao diện bàn giao:**

```text
DC.policies.create() → policyPair
policyPair.step(observation) → {A: PolicyResult, B: PolicyResult}
policyPair.reset()
DC.evaluation.create(trialConfig) → metrics
metrics.record(observation, policyResults)
metrics.finish() → TrialResult
DC.scenarios.suite → 19 TrialConfig
DC.scenarios.calibrationFailure → TrialConfig riêng
```

`PolicyResult={state,ready}`. TrialResult chứa id/config/seed/trueLabel, sampleCount/invalidCount và kết quả A/B. Người 3 thống nhất tên trường CSV với người 4 trước phút 10; thiếu thời gian xác nhận dùng null/timeout, không dùng 0.

**Hạn:** phút 25 có A/B dùng được; phút 40 policy đã thử độc lập và C1–C4 sẵn; phút 60 đủ suite/metrics; phút 90 có bảng kết quả thật để trình bày.

**Tự kiểm:** không cho B READY trước 500 ms; mất dấu/gap phải reset; đủ 101 mẫu/lượt và 1.919 mẫu/chính sách nếu không hủy lượt; ca hiệu chuẩn sai không lọt vào mẫu số bộ chính.

## Người 4 — tích hợp, chạy suite và bản demo

**Sở hữu:** config.js, index.html, app.js, dockcheck-demo.html bàn giao. Người này điều phối tích hợp, không chỉ trang trí giao diện.

**Việc theo thứ tự:**

1. Tạo hai canvas và điều khiển x/y/góc bằng slider hoặc số nhập; kéo thả chỉ thêm nếu dư thời gian. Tạo hai ô kết quả A/B và thông báo invalid.
2. Ghép vòng ảnh → perception → A/B ngay khi từng hàm được bàn giao. Tạm dùng kết quả fixture thì gắn nhãn phát triển, không trình bày như pipeline hoàn chỉnh.
3. Chạy interactive theo timestamp thực; khi visibilitychange/tab ẩn gọi reset và cập nhật trạng thái chưa đủ dữ liệu.
4. Viết runner dùng TrialConfig: reset world, RNG, policy, metrics mỗi lượt; tạo đúng t=0,50,...,5000; gọi perception một lần rồi truyền cùng Observation vào A/B và evaluator.
5. Hiển thị bảng TrialResult, xuất CSV. Khóa điều khiển tay trong khi batch chạy để không đổi suite giữa lượt. Interactive không cộng vào bảng suite.
6. Ghép HTML độc lập, mở file khi tắt mạng; tập demo và quay video dự phòng. Sau khi lõi ổn, thêm stopwatch đo thủ công/tự động 1× nếu kịp.

**Hạn:** phút 15 có khung mở được; phút 30 pipeline thật đầu tiên; phút 50 hiển thị A/B và C1–C4; phút 75 runner đầy đủ/CSV; phút 105 có HTML offline.

**Tự kiểm:** quay lại tab không giữ READY cũ; batch pause khi tab ẩn, dùng lịch mô phỏng cố định khi tiếp tục. Hiển thị rõ ms mô phỏng và wall-clock. Tắt mạng vẫn chạy; kiểm console và CSV trước khi khóa.

## Lịch bàn giao chung

| Mốc | Phải nhìn thấy | Khi trễ |
| --- | --- | --- |
| 10 phút | Tên người vào vai; schema/config/file ownership thống nhất | Dừng thêm tính năng, giải quyết giao diện hàm |
| 20 phút | Renderer ảnh sạch, detector thử riêng, policy A/B thử riêng, khung UI | Người 4 ghép từng phần, không chờ đủ hết |
| 30 phút | Ảnh thật → pixel → tư thế → A → màn hình | Người 1/2/4 tập trung sửa pipeline; người 3 tiếp tục policy/suite |
| 50 phút | A/B chung Observation, mất dấu, C1–C4 chạy qua pixel | Bỏ toàn bộ phối cảnh và kéo thả |
| 60 phút | Checkpoint có demo tương tác và giải thích trụ cột | Ưu tiên pipeline và đo kiểm, chưa làm đẹp |
| 80 phút | 19 lượt, CSV, preset lỗi chạy được | Cắt mở rộng, dồn sức bằng chứng |
| 100 phút | Có số đo thực, ca lỗi, nội dung trình bày | Không thêm tính năng |
| 120 phút | HTML offline, không lỗi console chặn demo, file kết quả đã lưu | Khóa code, dùng 15 phút chuẩn bị theo lịch |

## Phân công thuyết trình

- Người 4: 1 phút người dùng/câu hỏi; dẫn thao tác demo 4 phút, người 1 hỗ trợ tình huống ảnh/nhiễu.
- Người 2: giải thích pixel → tư thế → thân và ca hiệu chuẩn sai trong phần demo.
- Người 3: phần 2 phút số đo, trade-off, impact đã đo và giới hạn.
- 3 phút hỏi đáp: ai phụ trách trả lời trước, nhưng cả đội phải giải thích được vì sao có ground truth, vì sao B không luôn tốt hơn, và vì sao chưa chứng minh robot đứng yên.

Trạng thái xuất phát: tất cả phần triển khai chưa bắt đầu. File này phân công con người, không phải chỉ thị khởi chạy thêm agent hoặc tự triển khai demo.
