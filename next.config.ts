import type { NextConfig } from "next";

import { dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@mediapipe/tasks-vision"],
  turbopack: {
    root: here,
  },
};

export default nextConfig;
