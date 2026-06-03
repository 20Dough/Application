import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Keep the document-parsing libraries out of the server bundle so their
  // native/worker assets (e.g. pdfjs' pdf.worker.mjs) resolve from node_modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth", "xlsx"],
};

export default nextConfig;
