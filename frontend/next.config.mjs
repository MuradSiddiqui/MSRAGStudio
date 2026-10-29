/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const nextConfig = {
  // In local development the browser talks to this same-origin proxy instead of
  // calling the backend directly. When NEXT_PUBLIC_API_URL is set, the proxy
  // targets that URL and lib/api.ts calls it directly.
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  experimental: {
    // Indexing a large PDF or describing an image, and agentic answers, can take
    // minutes; the 30 s default makes the proxy hang up on a request that later succeeds.
    proxyTimeout: 10 * 60 * 1000,
  },
};

export default nextConfig;
