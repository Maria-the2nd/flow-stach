import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)));

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kindhearted-horse-113.convex.cloud",
        port: "",
        pathname: "/api/storage/**",
      },
    ],
  },
  turbopack: {
    root,
  },
  outputFileTracingRoot: root,
};

export default nextConfig;
