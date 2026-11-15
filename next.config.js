/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
module.exports = {
  reactStrictMode: true,
  basePath,
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    // Going back to a page seen in the last 30 s (feed -> post -> back) shows it instantly
    // from the browser's memory instead of asking the server again across the ocean.
    // Anything a member changes (post, like, follow...) still refreshes it right away,
    // because the server actions call revalidatePath, which empties this memory.
    staleTimes: { dynamic: 30, static: 300 },
  },
  // Share images read their fonts from disk; make sure the files ship with those functions.
  outputFileTracingIncludes: { "/**/*": ["./lib/og/fonts/*.ttf"] },
  // The service worker must always be fresh so fixes to notifications reach every device.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }];
  },
};
