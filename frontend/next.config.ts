import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      // MinIO local dev
      { protocol: 'http', hostname: 'localhost', port: '9100' },
      // Production S3 / MinIO — match any hostname on https
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
