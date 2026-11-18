import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/** Páginas públicas no domínio canônico (fotosdocasamento.online). */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/precos`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/ajuda`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/termos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
