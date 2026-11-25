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
  // a clean address for the email-signature page (a standalone HTML file, so
  // no site styles touch the signature it copies)
  async rewrites() {
    return [{ source: "/signature", destination: "/email/signature.html" }];
  },
};

export default nextConfig;
