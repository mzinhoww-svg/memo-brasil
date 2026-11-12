import type { NextConfig } from "next";

// Decisões (docs/architecture): sem cacheComponents/Activity (app local-first; câmera não deve ficar viva em rota oculta).
const isProd = process.env.NODE_ENV === "production";

// CSP: o app só carrega a própria origem. 'unsafe-inline' é necessário para o script do tema e os estilos
// gerados pelo Next (sem nonce nesta fase). Em dev o Next precisa de eval, por isso só vale em produção.
// Modo Supabase: libera SOMENTE o host configurado (REST/Auth/Storage por HTTPS e Realtime por WebSocket). Nada de curingas.
const sbUrl = process.env.NEXT_PUBLIC_MM_BACKEND === "supabase" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
const sbOrigin = sbUrl ? new URL(sbUrl).origin : "";
const sbWs = sbOrigin ? sbOrigin.replace(/^http/, "ws") : "";
// Production checkout and legacy sandbox preview each allow only their exact SDK hosts.
const validapayProduction = process.env.NEXT_PUBLIC_VALIDAPAY_CHECKOUT === "1";
const validapayPreview = !validapayProduction && process.env.NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW === "1";
const validapayEnabled = validapayProduction || validapayPreview;
const vpCardinal = validapayProduction
  ? " https://centinelapi.cardinalcommerce.com https://geo.cardinalcommerce.com"
  : validapayPreview ? " https://centinelapistag.cardinalcommerce.com https://geostag.cardinalcommerce.com" : "";
const vpApi = validapayEnabled
  ? `${validapayProduction ? " https://api.validapay.com.br https://api.marlim.co" : " https://sandbox.validapay.com.br https://sandbox.api.marlim.co"} https://h.online-metrix.net https://cas.client.cardinaltrusted.com${vpCardinal}` : "";
const vpScripts = validapayEnabled ? ` https://cdn.marlim.co https://h.online-metrix.net https://cas.client.cardinaltrusted.com${vpCardinal}` : "";
const vpFrames = `frame-src 'self'${validapayEnabled ? ` https://h.online-metrix.net https://cas.client.cardinaltrusted.com${vpCardinal}` : ""}`;

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${vpScripts}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${sbOrigin ? ` ${sbOrigin}` : ""}${validapayEnabled ? " https://h.online-metrix.net" : ""}`,
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self'${sbOrigin ? ` ${sbOrigin} ${sbWs}` : ""}${vpApi}`,
  vpFrames,
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
  // Páginas antigas do Master absorvidas pelas telas novas (M15–M32). Permanentes (308); o código antigo sai quando as ondas seguintes substituírem as telas.
  async redirects() {
    return [
      { source: "/master/usuarios", destination: "/master/pessoas?aba=contas", permanent: true },
      { source: "/master/organizadores", destination: "/master/pessoas?aba=organizadores", permanent: true },
      { source: "/master/participantes", destination: "/master/pessoas?aba=convidados", permanent: true },
      { source: "/master/storage", destination: "/master/saude", permanent: true },
      { source: "/master/analytics", destination: "/master", permanent: true },
    ];
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
