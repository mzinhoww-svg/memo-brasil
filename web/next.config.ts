import type { NextConfig } from "next";

// Decisão (docs/architecture): sem cacheComponents/Activity. O app é local-first
// (IndexedDB) e a câmera não deve ficar viva em rotas "hidden".
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
