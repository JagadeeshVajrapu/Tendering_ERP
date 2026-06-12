import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ['172.28.80.1', 'localhost', '127.0.0.1'],
  // pdfjs-dist breaks with webpack eval-* devtool (Object.defineProperty on non-object).
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = 'cheap-module-source-map';
    }
    return config;
  },
};

export default nextConfig;
