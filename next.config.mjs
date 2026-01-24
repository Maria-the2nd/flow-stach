import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)));

const nextConfig = {
  turbopack: {
    root,
  },
  outputFileTracingRoot: root,
};

export default nextConfig;
