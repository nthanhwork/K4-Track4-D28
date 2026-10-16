# DockCheck Sim — nhóm 12

Mở **`dockcheck-demo.html`** bằng trình duyệt để chạy offline. Không cần camera, server hay cài thư viện. Chọn preset rồi tải ca; quan sát ảnh camera, tư thế đọc từ pixel và quyết định A/B. A xét một ảnh; B cần hình học đạt liên tiếp 500 ms, khoảng ngắt không quá 150 ms. Đây không phải phép đo robot đứng yên.

`dockcheck-world.html` là trang phát triển, nạp `perception.js`, `policies.js`, `evaluation.js`, `scenarios.js` và `integration.js`, `batch.js` cùng thư mục. Sau khi sửa nguồn, tạo lại bản độc lập:

```sh
node scripts/build-demo.cjs
```

Bộ ca chuẩn duy nhất nằm ở `DC.scenarios.suite`. Renderer xuất `DockCheckSim`; cầu nối `integration.js` xử lý sự kiện `dockcheck:frame`, truyền ImageData/calibration/timestamp vào perception một lần rồi gửi cùng Observation cho A và B. `DC.integration.getSnapshot()` trả kết quả gần nhất. Truth chỉ dùng cho đánh giá.

Kiểm tra phần 3 và nối phần 1–2:

```sh
node tests/perception.test.cjs
node tests/part3.test.cjs
node tests/integration.test.cjs
node tests/batch.test.cjs
node tests/parts-1-2-review.cjs
```

Các test integration, batch và harness review cần `@napi-rs/canvas` trong môi trường phát triển; có thể đặt `DOCKCHECK_CANVAS_MODULE` tới package có sẵn. Sản phẩm HTML không cần dependency này. Harness dùng Canvas thật và DOM giả lập, chưa thay thế kiểm tra trên trình duyệt thật.

Xem [bàn giao tích hợp phần 1–3](tests/parts-1-3-integration.md). Bấm **Chạy 19 lượt** để đo và xem bảng A/B, sau đó **Xuất CSV**. **Đo ca sai hiệu chuẩn** chạy challenge riêng. Dừng hoặc ẩn tab sẽ hủy bộ chưa hoàn tất; cần chạy lại từ đầu. CSV giữ timestamp trống kèm timeout=true khi không xác nhận; có seed, phiên bản và cấu hình từng lượt để đối chiếu.

Sửa review về gián đoạn: cả hai giao diện xóa chuỗi xác nhận khi tạm dừng. Giao diện `index.html` hủy batch khi ẩn tab và yêu cầu chạy lại; phép đo tác động bị khóa khi batch khác đang chạy, chỉ công bố thời lượng sau khi hoàn tất. Test hồi quy: `node tests/interruptions.test.cjs` (cần Canvas như trên).

Builder tạo thêm `dockcheck-app-demo.html` từ `index.html`; `dockcheck-demo.html` vẫn là bản từ `dockcheck-world.html`. Cả `node bundle.js` và `node scripts/build-demo.cjs` tạo lại hai bản, tránh ghi đè lẫn nhau.
