import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // The home page is the plates portfolio, a static page in public/plates.
  // The earlier field-and-tour site lives on at /field.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/plates/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
