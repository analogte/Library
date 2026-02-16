import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

let nextConfig: NextConfig = {};

if (isProd) {
  // Only use Serwist in production build (uses webpack)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withSerwistInit = require("@serwist/next").default;
  const withSerwist = withSerwistInit({
    swSrc: "src/sw.ts",
    swDest: "public/sw.js",
  });
  nextConfig = withSerwist({});
}

export default nextConfig;
