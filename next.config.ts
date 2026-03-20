import type { NextConfig } from "next";

// Allow self-signed certs for Prometheus
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
