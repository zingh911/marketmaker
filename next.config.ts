import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pg` is a real Node driver; keep it out of the bundler's way.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
