# Bàn giao phần 2 — perception

Đã triển khai `../perception.js` theo plan v2 và phân công người 2. Chưa tích hợp renderer người 1 hoặc app người 4 vì các file đó chưa có tại thời điểm kiểm tra.

## Tích hợp

Nạp classic script `perception.js`, sau đó gọi:

```js
const observation = DC.perception.estimate(
  cameraCtx.getImageData(0, 0, 640, 400),
  { scale: 6, offsetX: 20, offsetY: 20 },
  tMs
);
```

Hàm không đọc world, seed, sensor config hoặc cờ che. Không lưu kết quả cũ. Không cần config.js: các hằng hình học khóa theo plan v2 nằm trong perception; nếu đổi thiết kế cần cập nhật đồng bộ với renderer/evaluator. Giữ nguyên namespace DC đã tồn tại.

Observation đúng schema `{tMs, valid, reason, pose, footprint, geometryPass}`. Góc radian trong [-π,π), chiều dương theo y ảnh hướng xuống. Footprint theo thứ tự các góc cục bộ (6,4), (-6,4), (-6,-4), (6,-4). Timestamp được truyền nguyên trạng; việc kiểm tra thứ tự thời gian thuộc policy.

`reason=null` khi valid, kể cả khi geometryPass=false. Các reason invalid:

- `missing-red`, `missing-blue`: màu tương ứng có dưới 25 pixel; nếu cả hai thiếu thì trả missing-red trước.
- `marker-distance`: khoảng cách ngoài [6.4,9.6] u hoặc không hữu hạn.
- `invalid-calibration`: scale không dương/hữu hạn hoặc offset không hữu hạn.
- `invalid-image`: kích thước hoặc độ dài buffer RGBA không hợp lệ.

Invalid luôn có pose/footprint null và geometryPass=false. Policy phải kiểm valid trước.

## Bằng chứng kiểm thử

Chạy từ thư mục K4-Track4-D28:

```sh
node tests/perception.test.cjs
```

Đã chạy: 10 test pass, 0 fail, exit 0. Test ban đầu thất bại vì API estimate chưa tồn tại. Test dùng buffer RGBA tự rasterize, không truyền pose thật vào perception. Bao phủ C1/C2/C3, thiếu từng màu, ngưỡng 24/25 pixel, ngưỡng màu nghiêm ngặt, khoảng cách dấu, biên dock, góc π, hiệu chuẩn sai và đầu vào lỗi.

Mở `perception-browser.html` để chạy fixture Canvas thực, hoặc dùng Chrome headless với `--dump-dom` và URL file tuyệt đối. Đã chạy Chrome: 6/6 ca pass, exit 0. Trang phải hiện PASS: 6/6; đây là fixture phát triển, không phải pipeline renderer của đội.

Số đo trên môi trường kiểm tra:

- Fixture RGBA không khử răng cưa: C1 tâm (50,30), góc 0; ca 8° có sai số góc -0.154279°. Test dùng mức chặn 1.2° dựa trên một pixel ngang qua baseline 48 px, không điều chỉnh ngưỡng quyết định 5°.
- Canvas Chrome: C1 tâm (49.992991,29.994548), góc 0; sai số tâm khoảng 0.00888 u. Ca 8° ước lượng khoảng 8.098°.
- Calibration bias: cùng ảnh x thật 54.5, offsetX=20 không đạt; offsetX=32 cho tâm x khoảng 52.492991 và geometryPass=true. Đây là lỗi quan sát cố ý, không phải sửa nhãn thật.

Tâm pixel dùng (x+0.5,y+0.5). Khử răng cưa và threshold có thể gây sai số tại sát biên; không thêm dung sai vào điều kiện dock để che sai số. Nền/thân không được dùng màu dấu. Detector lấy trọng tâm toàn bộ mask theo plan, chưa tách thành phần liên thông hoặc loại vật gây nhiễu cùng màu.

## Việc còn lại khi ghép nhóm

Chạy lại C1/C2/C3, che dấu và calibration-bias-v1 với ImageData từ renderer thật của người 1. Người 4 truyền cùng Observation cho A/B; geometryPass không phải ground truth. Chưa có kết quả suite 19 lượt hay xác nhận demo toàn bộ.
