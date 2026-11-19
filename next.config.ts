import type { NextConfig } from "next";

// Header keamanan dasar untuk aplikasi internal.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS sebaiknya dipasang di reverse proxy HTTPS (Nginx/IIS), bukan di sini.
];

const nextConfig: NextConfig = {
  // "standalone" menghasilkan server Node.js mandiri (folder .next/standalone)
  // sehingga mudah dipasang di server internal atau di dalam container Docker.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      // Hanya perlu bila reverse proxy TIDAK meneruskan header Host asli. Dibaca saat BUILD
      // (docker compose build --build-arg SERVER_ACTIONS_ALLOWED_ORIGINS=epr.perusahaan.local).
      allowedOrigins: process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean),
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
