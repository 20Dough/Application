import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // In dev, Next's file watcher recompiles whenever a watched file changes. The
  // SQLite database lives in-tree (prisma/dev.db, plus its -journal/-wal/-shm
  // sidecars), so ordinary request traffic — every message write — was tripping
  // a recompile. A request landing mid-recompile reads a half-written build
  // manifest and 500s with "Unexpected end of JSON input". These are runtime
  // data files, never source, so exclude them from the watcher. Dev-only; has no
  // effect on `next build`/`next start`.
  webpack: (config, { dev }) => {
    if (dev) {
      // Standard ignores (Next's defaults) plus the in-tree SQLite runtime files.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/node_modules/**",
          "**/prisma/*.db",
          "**/prisma/*.db-*",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
