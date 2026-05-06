import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://api-gateway:8000/api/:path*", // Proxy API calls to NGINX gateway
      },
      {
        source: "/ws/:path*",
        destination: "http://api-gateway:8000/ws/:path*", // Proxy WebSocket calls to NGINX gateway
      },
    ];
  },
};

export default nextConfig;
