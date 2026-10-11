/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Das ffmpeg-Binary muss zur Laufzeit aus node_modules geladen werden (nicht mitgebündelt).
  experimental: { serverComponentsExternalPackages: ["@ffmpeg-installer/ffmpeg"] },
};
export default nextConfig;
