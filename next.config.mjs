import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// khi chạy `npm run dev`: cho phép dùng D1/R2 cục bộ (wrangler mô phỏng)
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
export default {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
