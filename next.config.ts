import type { NextConfig } from "next";

// Allow self-signed certs for Prometheus
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION || '1.1.0',
  },
};

export default nextConfig;