import type { Photo } from "@/domain/photo";

/** "Visão da Mesa 8", "Visão do bar", "Visão de Ana" (vocabulário do kit). */
export function visionName(p: Pick<Photo, "tableLabel" | "authorName">): string {
  const t = p.tableLabel?.trim();
  if (t) return /^mesa/i.test(t) ? `Visão da ${t}` : `Visão do ${t.toLowerCase()}`;
  return `Visão de ${p.authorName}`;
}
export const visionKey = (p: Pick<Photo, "tableLabel" | "authorId">): string => p.tableLabel?.trim() || p.authorId;
export function avatarOf(p: Pick<Photo, "tableLabel" | "authorName">): string {
  const t = p.tableLabel?.trim();
  const mesa = t?.match(/^mesa\s*(\d+)/i);
  if (mesa) return `M${mesa[1]}`;
  return (t ?? p.authorName).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
export function tagFor(category: string): string {
  return category === "casamento" ? "Escolha dos noivos" : "Escolha do anfitrião";
}
