// Client-side image shrinking: photos are always re-encoded small BEFORE leaving the phone (faster upload, cheaper AI call).
// Scans of slips / manuals / registration papers are only read by the AI and never stored; only defect reports keep a tiny thumbnail.
const MAX_SIDE = 1280; // plenty to read printed text
export const UPLOAD_LIMIT = 3.5 * 1024 * 1024; // PDFs are sent as is, so keep a cap

async function draw(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}
const toBlob = (c: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> => new Promise((r) => c.toBlob(r, type, q));

/** Downscale to ≤1280px JPEG (q 0.72; typically 150–350 KB). Non-images (PDF) pass through untouched. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const blob = await toBlob(await draw(file, MAX_SIDE), "image/jpeg", 0.72);
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });

/** Tiny evidence thumbnail for defect reports: ≤720px, WebP (JPEG fallback), squeezed under ~45 KB. Returns a data URL. */
export async function makeThumb(file: File, maxBytes = 45 * 1024): Promise<string> {
  const c = await draw(file, 720);
  let type = "image/webp";
  let q = 0.6;
  let b = await toBlob(c, type, q);
  if (!b || b.type !== type) { type = "image/jpeg"; b = await toBlob(c, type, q); } // Safari without WebP encoding
  for (let i = 0; b && b.size > maxBytes && q > 0.25 && i < 6; i++) { q -= 0.08; b = await toBlob(c, type, q); }
  if (b && b.size > maxBytes) { const s = document.createElement("canvas"); s.width = Math.round(c.width * 0.7); s.height = Math.round(c.height * 0.7); s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height); b = await toBlob(s, type, 0.5); }
  return b ? blobToDataUrl(b) : "";
}
