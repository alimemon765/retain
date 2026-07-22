import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Phase 2 nav restructure: old routes folded into Library/Progress.
    return [
      { source: "/subjects", destination: "/library", permanent: true },
      { source: "/stats", destination: "/progress", permanent: true },
    ];
  },
};

export default nextConfig;
