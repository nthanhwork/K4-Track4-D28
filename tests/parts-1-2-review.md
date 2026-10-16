# Kiểm tra tiến độ và tương thích phần 1–2 — bản trước tích hợp

> Báo cáo lịch sử trước khi nhận phần 3 (commit f913306). Các lỗi ghép nối dưới đây đã được xử lý; xem [báo cáo hiện tại](parts-1-3-integration.md). Harness `parts-1-2-review.cjs` và JSON cùng tên nay kiểm tra phiên bản đã tích hợp, không tái hiện các lỗi cũ.

## Kết luận

Lõi phần 1 và phần 2 tương thích về ảnh, tọa độ, màu dấu và hình học. Đã chạy mã renderer hiện tại nối với perception hiện tại qua Canvas/Skia trong Node, đủ 19 lượt/1.919 frame. Trang `dockcheck-world.html` hiện chưa nạp hoặc gọi `DC.perception.estimate`, nên chưa có demo tích hợp hiển thị kết quả nhận thức.

Không sửa mã sản phẩm trong lần kiểm tra này. Thêm harness, kết quả JSON và báo cáo để nhóm tái kiểm tra. Kết quả dưới đây chưa bao gồm policy A/B, metrics sản phẩm hoặc kiểm tra trình duyệt end-to-end.

## Tiến độ theo đầu ra bàn giao

| Phần | Đã có và kiểm tra được | Còn thiếu |
| --- | --- | --- |
| 1 — thế giới/renderer | Mô phỏng tương tác, ảnh 640×400, dấu màu, nhiễu seed, che dấu theo lịch, 19 TrialConfig, preset calibration bias, API lấy ImageData | Khác tên API đã phân công; WORLD/RENDERER còn nằm trong HTML, chưa thành world.js/renderer.js để nạp riêng |
| 2 — perception | Classic script độc lập, nhận pixel → pose/footprint/geometryPass, xử lý invalid, test Node và fixture browser | Chưa được trang phần 1 gọi; cần chạy lại kiểm tra ghép trên browser demo |
| Mối nối 1→2 | Harness đã chạy ảnh do renderer tạo vào perception, không truyền truth | Chưa có mối nối trong giao diện sản phẩm |
| Phần 3/4 liên quan | Phần 1 đã có bộ cấu hình 19 lượt để dùng chung | Trong checkout đang kiểm tra chưa có policies.js/evaluation.js/app.js hoặc bảng kết quả A/B chạy thật |

## Những việc cần xử lý trước khi tích hợp

### 1. Thống nhất API hiện có và nối vào app — ưu tiên cao

Phần 1 xuất `DockCheckWorld`, `DockCheckRenderer`, `DockCheckSim` trong `dockcheck-world.html:78`, `:105`, `:139`. Phần 2 xuất `DC.perception.estimate` trong `perception.js:57`. API `DC.renderer.render(...)` và `DC.world.draw(...)` trong phân công chưa tồn tại.

Đây là lệch giao diện bàn giao, không phải lệch dữ liệu ảnh. Người 1 và người 4 cần thống nhất dùng API đang có hoặc viết adapter nhỏ; không gọi API giả định từ bản phân công. Người 1 có thể tách khối WORLD/RENDERER ra file riêng; người 4 sở hữu mối nối và hiển thị Observation.

### 2. Ví dụ phần 1 bỏ timestamp — cần sửa khi ghép

Ví dụ ở `dockcheck-world.html:38`, `:46` chỉ ghi lời gọi perception với ảnh và calibration. Hàm thực tế ở `perception.js:5` cần đối số thứ ba `tMs`. Gọi hai đối số tạo Observation có `tMs=undefined`; ảnh vẫn nhận được nên lỗi dễ bị bỏ qua, nhưng policy thời gian không có đầu vào đúng.

Lời gọi đúng, sau khi đã nạp perception.js:

```js
const trial = DockCheckSim.trials[0];
DockCheckSim.beginTrial(trial); // tắt preview, reset seed và lịch
const frame = DockCheckSim.captureTrialFrame(0);
const observation = DC.perception.estimate(
  frame.imageData,
  trial.calibration,
  frame.tMs
);
// Truyền chính observation này cho A và B.
```

### 3. Không tạo lại TrialConfig rồi truyền vào beginTrial

`dockcheck-world.html:136` kiểm tra danh tính đối tượng bằng `trials.includes(trial)`. `structuredClone(DockCheckSim.trials[0])` bị từ chối dù nội dung giống hoàn toàn.

Điều này xung đột với việc người 3 tự tạo danh sách scenarios.js theo bản phân công. Cách ghép nhanh nhất: dùng duy nhất `DockCheckSim.trials` và `DockCheckSim.calibrationBias`, không sao chép hoặc sinh lại để gọi beginTrial. Nếu chọn renderer mức thấp, app có thể tự quản lý TrialConfig, lịch che và seed; khi đó không dùng beginTrial của prototype. Không xây song song hai nguồn suite.

### 4. Khóa điều khiển khi batch chạy

`beginTrial()` tắt preview nhưng chưa khóa controls. `dockcheck-world.html:142–144` vẫn cho phép sửa slider, nhấn Tiến 50 ms, reset seed hoặc bật lại preview.

Đã tái hiện hai hậu quả:

- Đổi slider X sau khi bắt đầu lượt gọi custom(), xóa activeTrial; capture tiếp theo báo lỗi “Gọi beginTrial trước”.
- Nhấn Tiến 50 ms sau mẫu t=0 tiêu thụ thêm RNG. captureTrialFrame(50) tiếp theo vẫn được chấp nhận nhưng ảnh khác lượt sạch cùng seed, làm hỏng tái lập.

Người 4 cần khóa toàn bộ control có thể thay world/RNG/chụp frame trong batch. Một nơi sở hữu vòng lấy ảnh; không gọi preview/capture thêm giữa các mẫu của suite.

## Các thông số đã khớp

- ImageData RGBA 640×400; đổi tọa độ scale=6, offsetX=20, offsetY=20.
- Đỏ là đầu, xanh là đuôi; RGB và ngưỡng màu tương thích.
- Thân 12×8 u; dấu cách tâm ±4 u; bán kính 1 u.
- theta dùng radian, chiều dương theo y hướng xuống; π chuẩn hóa về −π.
- Vùng thân cho phép [41,59] × [21,39], hướng ±5°.
- Timestamp truyền nguyên từ frame khi caller gọi đủ ba đối số.
- Che dấu được phản ánh bằng thiếu pixel màu, perception không đọc cờ simulator.
- Calibration bias thay phép đổi ảnh → thế giới, không làm thay ảnh nguồn.

World và perception liệt kê bốn góc với điểm bắt đầu khác nhau nhưng cùng hình chữ nhật và thứ tự đi quanh thân; đây không phải lỗi. Không so khớp footprint theo từng index nếu chưa chuẩn hóa thứ tự.

Các hằng hình học đang được lặp trong perception và cấu hình renderer. Hiện khớp; khóa chúng theo v2 trong hackathon hoặc cập nhật đồng bộ nếu thay. Không cần refactor lớn để tích hợp hai phần ở phạm vi hiện tại.

## Bằng chứng chạy lại trong phiên kiểm tra

1. `node tests/perception.test.cjs`: exit 0, 10/10 test đạt.
2. `tests/parts-1-2-review.cjs` với @napi-rs/canvas cài sẵn: exit 0; renderer self-check 21/21, kiểm tra chức năng ghép 10/10. Bốn probe bổ sung tái hiện các rủi ro tích hợp kể trên; probe đạt nghĩa là đã tái hiện được rủi ro, không có nghĩa rủi ro đã được sửa.
3. Pipeline ghép chạy 19 lượt, 1.919 frame; 12 nhãn thật đạt và 7 không đạt. Đây là kết quả frame-level của perception, chưa phải kết quả policy.

Kết quả chính trên Canvas/Skia Node:

| Ca | Kết quả qua pixel |
| --- | --- |
| C1 | 101/101 frame valid và geometryPass=true; tâm (50,30) |
| C2 | 101/101 valid, geometryPass=false; thân vượt biên |
| C3 | 101/101 valid, geometryPass=false; sai hướng |
| C4 | 16/101 frame invalid do che dấu; 85 frame còn lại geometryPass=true |
| N3 | Mỗi seed có 32/101 frame invalid, khớp hai khoảng che |
| Calibration bias | Ảnh giống C2 từng byte; tâm thật x=54.5, ước lượng x=52.5, geometryPass=true |
| N2-101 lặp lại | Cùng seed/lịch cho 101 Observation giống nhau |

Các nhóm nhiễu có frame nhận sai như dự kiến phạm vi thí nghiệm; không xem đó là lỗi kết nối. Ví dụ N2 có lần geometryPass=true dù nhãn thật không đạt. Không gọi đây là READY của A/B khi policy chưa tích hợp.

## Môi trường và giới hạn xác minh

Chrome headless không khởi động trong sandbox: `setsockopt: Operation not permitted`, exit 133. Không dùng kết quả browser cũ trong handoff để tuyên bố browser hiện tại đã pass.

Thay vào đó harness chạy mã nguồn thật trong Node VM với @napi-rs/canvas (Skia); DOM và requestAnimationFrame được giả lập tối thiểu. Pixel, rasterization và perception chạy thật trên Canvas backend này; điều phối browser, visibility event và màu khử răng cưa trên Chrome vẫn cần thử tại máy demo. Hàm xử lý control được gọi trực tiếp trong probe, không phải thao tác chuột qua browser.

Harness là công cụ phát triển, không thêm dependency vào bản HTML sản phẩm. Chạy nếu máy đã có @napi-rs/canvas:

```sh
node tests/parts-1-2-review.cjs
```

Hoặc đặt `DOCKCHECK_CANVAS_MODULE` tới thư mục package cài sẵn. Phiên này dùng package tại `/home/sakana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas`. Kết quả chi tiết lưu `tests/parts-1-2-review-results.json`, gồm SHA-256 của hai file nguồn.

## Bước tiếp theo theo người phụ trách

1. Người 1 + 4: chốt API đang có, tách renderer hoặc adapter để app nạp được; dùng một nguồn TrialConfig.
2. Người 4: nạp perception, gọi đủ timestamp, hiển thị valid/pose/geometryPass; khóa controls khi batch chạy.
3. Người 2: đối chiếu C1/C2/C3, mất dấu và calibration bias trên browser thật với renderer của đội; ghi sai số rasterization.
4. Người 3: dùng cùng Observation cho A/B và tiếp tục bộ đo; không đưa frame-level geometryPass vào báo cáo như READY đã đo.

Chưa sửa API, controls hoặc mã thuật toán trong lần review này.
