/**
 * Next.js 14 không hỗ trợ trực tiếp `next.config.ts`. Khi nâng lên Next 15+,
 * có thể đổi tên file thành `next.config.ts` và thêm typing.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Standalone build để Cloud Run/App Hosting đóng gói image gọn nhất.
  output: 'standalone',
  experimental: {
    // Các package server-only (Node binding, native deps) — Next bundle riêng,
    // không cố tree-shake vào edge runtime.
    serverComponentsExternalPackages: [
      'pdf-parse',
      'mammoth',
      'pdfkit',
      'docx',
      'firebase-admin',
    ],
  },
  // Lint trong CI riêng; build không nên fail vì style.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
