import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Use documented loader workers so builds also work on hosts that block child-process sockets.
  ...(process.env.ADG_TURBOPACK_WORKERS !== "0"
    ? { experimental: { turbopackPluginRuntimeStrategy: "workerThreads" as const } }
    : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
