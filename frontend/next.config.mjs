/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const nextConfig = {
  // The FastAPI backend ships without CORS middleware, so in local development
  // the browser talks to this same-origin proxy instead of calling the backend
  // directly. When NEXT_PUBLIC_API_URL is set, the proxy targets that URL and
  // lib/api.ts calls it directly.
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
