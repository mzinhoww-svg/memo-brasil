import { extractShareCode } from "@/domain/share-code";

export function inviteUrl(origin: string, code: string, table?: string): string {
  const url = new URL(`/e/${code}`, origin);
  if (table) url.searchParams.set("mesa", table);
  return url.toString();
}

/** Lê "?mesa=8" do link. Aceita só rótulos curtos e simples. */
export function tableFromSearch(search: string): string | undefined {
  const v = new URLSearchParams(search).get("mesa")?.trim();
  return v && /^[\p{L}\p{N} .-]{1,24}$/u.test(v) ? v : undefined;
}

export { extractShareCode };
