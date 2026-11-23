const MAX_SIDE = 1800;
export const UPLOAD_LIMIT = 3.5 * 1024 * 1024; // ảnh nhỏ hơn → tải lên và AI đọc nhanh hơn

/** Thu nhỏ ảnh chụp từ điện thoại trước khi gửi (ảnh gốc 5–10MB sẽ vượt giới hạn upload). */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.2 * 1024 * 1024) return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}
