import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Monorepo root (where next / @swc/helpers are hoisted).
  // Avoids Next picking a parent ~/package-lock.json as the workspace root.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
