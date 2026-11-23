# Chính sách bảo mật

## Báo lỗ hổng
Vui lòng **không** đăng chi tiết lỗ hổng công khai. Dùng *Security → Report a vulnerability* (báo cáo riêng tư) trên trang GitHub của repo này. Mình sẽ phản hồi trong vài ngày.

## Phạm vi
ServiceBook là app tự triển khai: mỗi người chạy bản riêng trên tài khoản Cloudflare của mình. Dữ liệu, mật khẩu và khóa API nằm ở tài khoản của người triển khai, không có máy chủ trung tâm.

## Khuyến nghị cho người triển khai
- Luôn đặt `APP_PASSWORD` và `SESSION_SECRET` (xem [HUONG-DAN.md](HUONG-DAN.md)); thiếu mật khẩu thì app mở cho mọi người biết địa chỉ.
- Đặt bí mật bằng `wrangler secret put`, không ghi vào file được commit.
- Giữ phụ thuộc cập nhật (Dependabot đã bật sẵn trong repo).
