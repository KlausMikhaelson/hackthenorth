import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // XRPL browser support: map ws to wrapper per docs
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      ws: "xrpl/dist/npm/client/WSWrapper",
    };
    return config;
  },
};

export default nextConfig;
