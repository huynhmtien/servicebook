import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// when running `npm run dev`: allow using local D1/R2 (emulated by wrangler)
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
export default {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
