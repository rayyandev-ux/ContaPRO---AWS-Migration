import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com https://us.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data: https:; connect-src 'self' http: https: ws: wss:; frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com; frame-ancestors 'none';",
          }
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path((?!proxy).*)',
        destination: `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:8080'}/api/:path`,
      },
    ]
  },
};

export default withNextIntl(nextConfig);
