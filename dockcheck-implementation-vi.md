# DockCheck World Simulation v2 — ghi chú triển khai

Module đã cập nhật theo `dockcheck-sim-plan.md` v2. Mở `dockcheck-world.html` trực tiếp bằng trình duyệt. Giao diện, thông báo kiểm tra và hướng dẫn đều bằng tiếng Việt; tên API giữ bằng tiếng Anh để đồng đội tích hợp.

## Những gì đã thay đổi

| Thành phần | Bản trước | Bản v2 |
| --- | --- | --- |
| Tọa độ | Thế giới bằng pixel | Thế giới 100×60 u, tách khỏi pixel |
| Ảnh camera | 640×480 | 640×400 |
| Ánh xạ thật | Đồng nhất | px=20+6*x; py=20+6*y |
| Robot | 80×50 px | 12×8 u, tương đương 72×48 px |
| Dấu | Offset ±25 px, bán kính 7 px | Offset ±4 u, bán kính 1 u; đỏ (240,40,40), xanh (40,80,240) |
| Dock | Tham số thử ban đầu | [40,60]×[20,40] u; biên 1 u; hướng ±5° |
| Góc | thetaRad | theta, radian trong [-π,π) |
| Nhiễu | LCG; bỏ lấy mẫu khi che dấu | xorshift32; luôn bốn mẫu mỗi ảnh, seed khác 0 |
| Ca mẫu | Năm ví dụ minh họa | C1–C4, N1–N3 và calibration-bias-v1 |
| Thời gian | Chụp tự do | Thêm tạo ảnh theo lịch cố định 0,50,…,5000 ms |

Tất cả kích thước vẽ và hình học lấy từ một cấu hình. Canvas thế giới dùng cùng phép chiếu để dễ đối chiếu, nhưng tư thế API luôn tính bằng u.

## Hợp đồng module

- `DockCheckWorld`: cấu hình và hình học thuần. `evaluate(world)` tính đáp án từ tư thế thật.
- `DockCheckRenderer.create(context, seed)`: renderer độc lập với giao diện. `render(world, effects)` trả `ImageData` mới; `setSeed(seed)` đặt lại chuỗi.
- `DockCheckSim`: điều khiển prototype, cấu hình lượt và chụp ảnh.
- `DockCheckEvaluator`: đọc vị trí thật và đáp án hình học, chỉ dành cho evaluator.
- `DockCheckChecks.runSelfChecks()`: kiểm tra renderer bằng pixel; không phải thuật toán perception của sản phẩm.

Mã nguồn được chia thành các khối WORLD, RENDERER, APP và kiểm tra trong file HTML. Có thể lấy riêng hai khối WORLD/RENDERER thành world.js/renderer.js để tích hợp; bản bàn giao vẫn nhúng toàn bộ script để mở offline.

```js
DockCheckSim.setPreviewRunning(false);
DockCheckSim.setPose({x:50, y:30, theta:0});
DockCheckSim.setObservation({noiseAmplitudePx:3, hideFront:false, hideRear:false});
DockCheckSim.setSeed(101);
const frame = DockCheckSim.captureFrame(performance.now());
// {imageData, tMs, timestampMs}; timestampMs là bí danh của tMs.
// perception(frame.imageData, calibration) → Observation → A và B.
```

Đổi `thetaRad` thành `theta`; đổi `jitterPx` thành `noiseAmplitudePx`. API từ chối hai tên cũ để tránh tích hợp sai âm thầm. `setPose` và `setObservation` cập nhật điều khiển/thế giới; gọi `captureFrame` để cập nhật camera nếu đang tạm dừng.

Perception chỉ nhận ImageData và Calibration. Không truyền pose thật, hiệu ứng, seed, TrialConfig hoặc nhãn vào perception. API tách trách nhiệm nhưng không phải cơ chế bảo mật.

## Lượt thử và tính tái lập

`DockCheckSim.trials` cung cấp 19 TrialConfig: C1–C4 mỗi ca một lượt, N1–N3 mỗi nhóm năm seed 101,202,303,404,505. C1–C4 dùng seed 101. Có 12 lượt đạt và 7 không đạt, tổng 1.919 mẫu. Đây là bộ cấu hình đầu vào, chưa phải bảng kết quả A/B đã đo.

```js
const trial = DockCheckSim.trials[0];
DockCheckSim.beginTrial(trial); // tắt preview, đặt pose, lịch, seed, calibration
for (let t=0; t<=trial.durationMs; t+=trial.sampleMs) {
  const frame = DockCheckSim.captureTrialFrame(t);
  // Tích hợp perception và hai chính sách tại đây.
}
```

Mỗi lượt có 101 mẫu, từ 0 đến 5000 ms, bước 50 ms. `captureTrialFrame` từ chối mẫu lặp, sai thứ tự, vượt hạn hoặc khi tab bị ẩn. Bên tích hợp phải tạm dừng batch khi ẩn tab. Tầng policy phải xóa READY/lịch sử khi gián đoạn; module phát `dockcheck:interruption` khi trạng thái hiển thị đổi.

xorshift32 lấy bốn mẫu mỗi lần render: đầu-x, đầu-y, sau-x, sau-y, kể cả khi che dấu hoặc biên độ bằng 0. Vẽ thế giới không tiêu thụ chuỗi camera. Muốn tái lập cần reset seed và giữ cùng thứ tự chụp; không gọi thêm capture/preview giữa các mẫu. Cùng timestamp không tự khôi phục trạng thái PRNG.

Lịch che C4: t mod 300 thuộc [250,300). Lịch N3: [1000,1800) và [3000,3800). Che dấu được thực hiện trong ảnh; vị trí thật không đổi. Tương tác tự do không được cộng vào bộ thử đã khóa.

## Ca sai hiệu chuẩn

`DockCheckSim.calibrationBias` là preset ngoài suite-v1. Robot ở (54.5,30,0), ảnh giống C2. Renderer luôn dùng calibration thật (6,20,20); bên perception nhận calibration sai (6,32,20).

Kiểm tra pixel cho thấy trung điểm dấu đổi ngược thành x≈52.5 u với calibration sai, trong khi tâm thật là 54.5 u. Hình học thật không đạt nhưng hình học ước lượng có thể đạt. Việc A/B có READY phải được xác minh sau khi ghép perception và policy; module không tuyên bố đã đo kết quả đó.

## Kiểm chứng

Đã chạy Chrome thực ở chế độ headless:

- 21/21 kiểm tra module đạt: kích thước ảnh, trọng tâm màu, quay 90°, nhãn hình học từng nhóm, biên và góc ±5°, lịch che, tái lập nhiễu, số lượt/mẫu, kiểm tra sai hiệu chuẩn qua pixel, buffer độc lập và dữ liệu không hợp lệ.
- Kiểm tra thao tác thanh X và thanh nhiễu đạt.
- Chạy C4 đủ 101 ảnh: 16 ảnh thiếu dấu đầu, đáp án hình học không đổi; chặn chụp vượt lượt.
- Xác nhận ảnh C2 và ca sai hiệu chuẩn giống nhau từng byte.
- JavaScript vượt kiểm tra cú pháp.

## Phần còn lại của toàn dự án

Đồng đội cần ghép perception sản phẩm, hai chính sách A/B, xử lý gián đoạn tại policy, bảng chỉ số, xuất CSV và chạy/ghi kết quả đầy đủ 19 lượt. Không cộng thời gian tab ẩn vào 500 ms xác nhận. Phối cảnh là mở rộng, chưa triển khai.

Giới hạn: thế giới 2D tổng hợp, nền không trùng màu dấu; nhiễu không phải camera đã hiệu chuẩn; không mô phỏng vật lý hoặc chứng minh robot thật đứng yên/bàn giao thành công.
