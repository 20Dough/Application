import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Emit a minimal standalone server bundle for container/Docker deploys.
  output: "standalone",
};

export default nextConfig;
