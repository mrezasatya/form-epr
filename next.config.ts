import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" menghasilkan server Node.js mandiri (folder .next/standalone)
  // sehingga mudah dipasang di server internal atau di dalam container Docker.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
