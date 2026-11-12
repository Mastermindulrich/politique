/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
module.exports = {
  reactStrictMode: true,
  basePath,
  images: { formats: ["image/avif", "image/webp"] },
};
