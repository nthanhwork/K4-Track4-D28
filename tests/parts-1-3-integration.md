# Bàn giao tích hợp phần 1–3

Đã kiểm tra phần 3 sau khi người dùng pull thành công tới `f913306`. Các sửa đổi bên dưới đang ở workspace, chưa commit/push.

## Đã ghép

- `scenarios.js` là nguồn duy nhất cho 19 lượt và challenge hiệu chuẩn, dùng ID thống nhất và lịch che dạng JSON.
- `integration.js` nối ảnh thật của renderer → `DC.perception.estimate(imageData, calibration, frame.tMs)` → cùng Observation cho A/B → giao diện. Không truyền WorldState vào perception.
- `beginTrial()` nhận cả cấu hình gốc và bản sao không đổi, từ chối cấu hình bị chỉnh; khóa điều khiển/API có thể thay ảnh hoặc RNG trong lượt. `endTrial()` mở khóa.
- Mất quan sát hoặc ẩn tab xóa kết quả cũ; timestamp lỗi/lùi/lặp không được giữ READY. B phải xây lại chuỗi xác nhận.
- `dockcheck-demo.html` nhúng toàn bộ mã, mở độc lập offline. Chạy `node scripts/build-demo.cjs` sau khi sửa nguồn.

## Phần 3 đã sửa

1. Policy bỏ lọt timestamp thiếu, NaN, vô hạn, lùi/lặp; nay trả UNKNOWN và reset chuỗi.
2. Evaluator trước đây chờ caller tự gán truth; nay tính ngay từ world, không cho ghi nhãn mâu thuẫn. Sửa chuẩn hóa góc âm nhiều vòng và sai số ở đúng ±5°.
3. Trial ID, phiên bản suite và biểu diễn lịch che chưa khớp renderer; nay dùng chung cấu hình tái lập.

## Bằng chứng

- Perception: 10/10 test.
- Phần 3: 6/6 test, bao gồm chạy lại 71 self-check của ba module.
- Tích hợp: 6/6 test; có kiểm tra HTML độc lập không tải script bên ngoài.
- Renderer: 21/21 self-check.
- Suite: 19 lượt × 101 frame = 1.919 frame; 12 lượt thật đạt, 7 không đạt. Chạy lại N2-101 cho kết quả giống nhau.
- `git diff --check`: không lỗi.

Kết quả từ Canvas/Skia, DOM giả lập:

| Chỉ số theo lượt, trong 5 giây mô phỏng | A | B |
| --- | --- | --- |
| Lượt thật không đạt nhưng từng READY / 7 | 5/7 | 0/7 |
| Lượt thật đạt và từng READY / 12 | 12/12 | 9/12 |
| Thời điểm READY đầu tiên ở C1 | 0 ms | 500 ms |

C4 có 16/101 frame thiếu dữ liệu, B không xác nhận trong thời hạn. Challenge hiệu chuẩn nằm ngoài suite: truth FAIL_POSITION nhưng A xác nhận ở 0 ms, B ở 500 ms. Không kết luận B sửa được sai lệch hệ thống hoặc luôn tốt hơn A.

Chi tiết từng lượt và hash nguồn: `parts-1-2-review-results.json`; chạy lại bằng `tests/parts-1-2-review.cjs`. JSON đã cập nhật cho phiên bản tích hợp, còn báo cáo Markdown phần 1–2 cũ được giữ như lịch sử.

## Mối nối được batch.js sử dụng

```js
const trial = DC.scenarios.suite[0];
const metrics = DC.evaluation.create(trial);
DockCheckSim.beginTrial(trial);
try {
  for (let t = 0; t <= trial.durationMs; t += trial.sampleMs) {
    DockCheckSim.captureTrialFrame(t);
    const { observation, policies } = DC.integration.getSnapshot();
    metrics.record(observation, policies);
  }
  const result = metrics.finish();
  // Ghi result vào bảng/CSV ở đây.
} finally {
  DockCheckSim.endTrial();
}
```

Không gọi perception/policy lần thứ hai cho cùng frame. `firstReadyTMs === null` nghĩa là chưa xác nhận; không thay bằng 0. Hiện `transitions` đếm thay đổi boolean ready, không đếm mọi chuyển đổi giữa bốn state; nhãn bảng phải nói rõ điều này. Bộ ca hiện tại có world cố định từ t=0 nên firstReadyTMs cũng là thời gian chờ; chưa dùng cách tính này cho robot chuyển động.

## Còn lại và giới hạn

Đã nối thêm `batch.js` vào giao diện: chạy 19 lượt, bảng từng ca, tỷ lệ A/B với mẫu số, xuất CSV và challenge riêng. Dừng/ẩn tab hủy bộ chưa hoàn tất, không đưa lượt dở vào báo cáo. Kết quả CSV có cấu hình, seed, timeout và thời điểm xác nhận. Ba test batch kiểm tra suite thực, hủy/ẩn tab/chạy lại và challenge trong HTML độc lập. Không bổ sung phối cảnh hoặc phần cứng.

Chrome headless bị sandbox chặn (`setsockopt: Operation not permitted`); kết quả trên là Node VM + Canvas/Skia thật với DOM giả lập, chưa phải kiểm tra trình duyệt thật. Trước khi demo, mở `dockcheck-demo.html`, thử C1/C2/C3/C4/challenge, đổi slider, che từng dấu, ẩn rồi mở tab và xác nhận B chờ lại. B xác nhận hình học hợp lệ liên tục, không chứng minh robot đứng yên.

Kiểm tra workflow AI DevKit lint không chạy được: package chưa có trong npm cache offline (ENOTCACHED). Kiểm thử mã sản phẩm chạy trực tiếp bằng Node; không cài thêm dependency.
