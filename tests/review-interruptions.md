# Sửa review: gián đoạn quan sát và đo tác động

- Pause preview: reset policy và xóa READY ngay ở cả hai giao diện; chuỗi 400 ms trước pause không được dùng tiếp sau resume. B cần 500 ms quan sát mới.
- Batch của app.js: cờ hủy giữ nguyên dù tab đã hiện lại; loại toàn bộ bộ đo dở, không xuất CSV; kiểm tra cả sau mẫu cuối. finally mở lại điều khiển cả khi lỗi.
- Auto impact: khóa nút trong suite/challenge, guard ở hàm đo, dùng kết quả hoàn tất của runner trước khi ghi thời lượng. Phép đo bị hủy không có duration.
- Builder tạo hai file riêng cho hai giao diện. Kiểm tra bundle không được tải script bên ngoài.

Kiểm thử hồi quy trong `interruptions.test.cjs` dùng mã nguồn thật và Canvas/Skia, DOM giả lập. Bao gồm pause khi đang CHECKING và READY, ẩn rồi hiện tab trước frame tiếp theo, chạy lại C1, bấm auto impact khi đang chạy batch, hủy auto impact và hai bundle offline. Không thay thế kiểm tra trình duyệt thật.
