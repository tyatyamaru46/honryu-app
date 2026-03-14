import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  // Turbopack does not yet support custom webpack config which next-pwa needs.
  // Explicitly allowing webpack during build.
};

export default withPWA(nextConfig);
