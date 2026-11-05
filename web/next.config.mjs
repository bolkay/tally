/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the ASP.NET Core API serves these files from wwwroot.
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
  // During `next dev`, send API calls to a locally running API.
  ...(process.env.NODE_ENV === "development"
    ? {
        async rewrites() {
          const api = process.env.API_URL ?? "http://localhost:5080";
          return [
            { source: "/api/:path*", destination: `${api}/api/:path*` },
            { source: "/g/:id", destination: "/g" },
          ];
        },
      }
    : {}),
};

export default nextConfig;
