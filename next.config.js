/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
module.exports = {
  reactStrictMode: true,
  basePath,
  images: { formats: ["image/avif", "image/webp"] },
  // The service worker must always be fresh so fixes to notifications reach every device.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }];
  },
};
