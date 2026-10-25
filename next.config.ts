import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Opt-in for restricted build hosts where loader child processes cannot bind sockets.
  ...(process.env.ADG_TURBOPACK_WORKERS === "1"
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
