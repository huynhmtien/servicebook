"use client";

export default function ErrorPage() {
  return (
    <div className="card">
      <h1>Có lỗi khi tải trang</h1>
      <p>Thường là do chưa kết nối được database hoặc thiếu biến cấu hình.</p>
      <p>Mở <a href="/api/health">/api/health</a> để xem chẩn đoán, rồi xem mục “Gặp lỗi?” trong HUONG-DAN.md.</p>
    </div>
  );
}
