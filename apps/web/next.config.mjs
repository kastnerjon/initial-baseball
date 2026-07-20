/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@initial-baseball/engine', '@initial-baseball/shared'],
  outputFileTracingIncludes: {
    '/*': ['../../packages/baseball-data/reports/canonical-runtime-payload/**/*'],
  },
};

export default nextConfig;
