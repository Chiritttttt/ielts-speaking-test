import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Disable turbopack for production build
    turbo: undefined,
  },
};

export default nextConfig;
