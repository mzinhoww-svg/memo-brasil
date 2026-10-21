import type { NextConfig } from "next";

// Decisões (docs/architecture): sem cacheComponents/Activity (app local-first; câmera não deve ficar viva em rota oculta).
const isProd = process.env.NODE_ENV === "production";

// CSP: o app só carrega a própria origem. 'unsafe-inline' é necessário para o script do tema e os estilos
// gerados pelo Next (sem nonce nesta fase). Em dev o Next precisa de eval, por isso só vale em produção.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Fixa em "0" quando não definido: o código do relógio de teste sai do bundle de produção.
  env: {
    NEXT_PUBLIC_MM_TEST_CLOCK: process.env.NEXT_PUBLIC_MM_TEST_CLOCK ?? "0",
    // Versão do service worker = deploy; cache antigo é descartado ao ativar.
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now()),
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
      ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
    ];
    return [
      { source: "/:path*", headers: security },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
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
