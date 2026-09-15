import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the multi-stage Dockerfile (Technical Plan §17): emits
  // .next/standalone with a minimal server.js and only the traced
  // node_modules, so the runtime image stays small.
  output: "standalone",
};

export default nextConfig;
