import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/** Google lê as páginas públicas; o app (painel, master, convidado, criação e API) fica fora do índice. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/master", "/e/", "/api", "/conta", "/eventos", "/criar", "/dev", "/auth"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
