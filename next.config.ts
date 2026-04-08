import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino", "pino-pretty"],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
