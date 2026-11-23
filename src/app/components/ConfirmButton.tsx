"use client";

/** Nút xóa có hỏi lại, tránh bấm nhầm (đặc biệt trên điện thoại). */
export default function ConfirmButton({ label, message }: { label: string; message: string }) {
  return (
    <button className="danger" type="submit" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {label}
    </button>
  );
}
