import type { EventCategory } from "@/domain/options";

const MAX = 60;
const HOST_MAX = 40;

/** Nome do anfitrião vindo da conta Google (editável depois no painel). Cai num padrão seguro quando vazio. */
export function hostFallbackName(accountName: string | undefined | null): string {
  const clean = (accountName ?? "").trim().slice(0, HOST_MAX).trim();
  return clean || "Organizador";
}

const OF: Record<EventCategory, string> = { casamento: "Casamento", festa: "Festa", empresa: "Evento", viagem: "Viagem", outro: "Evento" };
const OURS: Record<EventCategory, string> = { casamento: "Nosso casamento", festa: "Nossa festa", empresa: "Nosso evento", viagem: "Nossa viagem", outro: "Nosso evento" };

/** 3 sugestões de nome a partir do tipo e do primeiro nome do anfitrião. Pura: a data entra como argumento. */
export function suggestEventNames(category: EventCategory, hostName: string, now: number): string[] {
  const first = hostName.trim().split(/\s+/)[0] ?? "";
  const d = new Date(now);
  const dd = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const list = first
    ? [`${OF[category]} de ${first}`, OURS[category], `${first} · ${dd}`]
    : [OF[category], OURS[category], `${OF[category]} · ${dd}`];
  return list.map((s) => s.slice(0, MAX).trim());
}
