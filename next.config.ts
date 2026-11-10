import type { NextConfig } from "next";

// one public address: www and the old vercel.app alias land on hfccorreia.me
const ALIASES = ["www.hfccorreia.me", "portfolio-roan-six-76.vercel.app"];

const nextConfig: NextConfig = {
  async redirects() {
    return ALIASES.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://hfccorreia.me/:path*",
      permanent: true,
    }));
  },
};

export default nextConfig;
