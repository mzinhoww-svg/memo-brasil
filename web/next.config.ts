import type { NextConfig } from "next";
import path from "node:path";

// Decisão (docs/architecture): sem cacheComponents/Activity. O app é local-first
// (IndexedDB) e a câmera não deve ficar viva em rotas "hidden".
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
