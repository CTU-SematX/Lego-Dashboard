import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

const isDev = process.env.NODE_ENV === 'development'
const isLocalhost = NEXT_PUBLIC_SERVER_URL.includes('localhost') || NEXT_PUBLIC_SERVER_URL.includes('127.0.0.1')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Add localhost patterns when running on localhost (dev or prod build)
      ...(isDev || isLocalhost
        ? [
            {
              protocol: 'http',
              hostname: 'localhost',
            },
            {
              protocol: 'http',
              hostname: '127.0.0.1',
            },
          ]
        : []),
      // Production/configured server URL
      ...[NEXT_PUBLIC_SERVER_URL].map((item) => {
        const url = new URL(item)
        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
    // Skip image optimization when on localhost to avoid private IP issues
    unoptimized: isDev || isLocalhost,
    // Add quality 100 to allowed qualities
    qualities: [100, 75],
  },
  // Allow dev origins for HMR and image loading
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
