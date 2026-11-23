/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const target = process.env.CONTROL_API_URL || 'http://control-api.platform.svc.cluster.local:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${target}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

