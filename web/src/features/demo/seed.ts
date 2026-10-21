import type { MemoEvent } from "@/domain/event";
import type { Photo, ReactionKind } from "@/domain/photo";
import { defaultTimezone } from "@/domain/reveal";
import { generateShareCode } from "@/domain/share-code";
import type { Repositories, User } from "@/repositories";

/** Imagem de exemplo vetorial (campos de cor e discos, como o motivo do kit). Não é foto real. */
export function sampleImage(seed: number, w = 800, h = 1000): { bytes: ArrayBuffer; type: string } {
  const hues = [96, 28, 200, 330, 48, 160];
  const hue = hues[seed % hues.length];
  const dots = Array.from({ length: 9 }, (_, i) => {
    const x = ((seed * 53 + i * 97) % 700) + 50;
    const y = ((seed * 31 + i * 131) % 900) + 50;
    return `<circle cx="${x}" cy="${y}" r="${24 + ((seed + i) % 5) * 14}" fill="hsl(${hue} 22% ${34 + ((i * 7) % 30)}%)" opacity=".55"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="hsl(${hue} 20% 82%)"/><rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="hsl(${hue} 18% 62%)"/>${dots}</svg>`;
  return { bytes: new TextEncoder().encode(svg).buffer as ArrayBuffer, type: "image/svg+xml" };
}

const GUESTS = [
  { id: "demo-ana", name: "Ana", table: "Mesa 8" },
  { id: "demo-beto", name: "Beto", table: "Mesa 3" },
  { id: "demo-clara", name: "Clara", table: "Mesa 8" },
  { id: "demo-davi", name: "Davi", table: "Bar" },
  { id: "demo-eva", name: "Eva", table: "Mesa 1" },
];
const MOMENTS = ["Chegada", "O sim", "Pôr do sol", "Pista"];
const KINDS: ReactionKind[] = ["amei", "esse-momento", "risada", "uau"];

/** Cria o evento de exemplo "Emy e Igor" com dados fictícios, todos marcados como exemplo na interface. */
export async function seedDemoEvent(repos: Repositories, host: User, now: number, opts: { reveal?: "desativada" | "pendente" } = {}): Promise<MemoEvent> {
  const pending = opts.reveal === "pendente";
  let code = generateShareCode();
  while (await repos.events.getByCode(code)) code = generateShareCode();
  const event: MemoEvent = {
    id: crypto.randomUUID(), code, title: "Emy e Igor", category: "casamento", hostId: host.id, hostName: host.name,
    startAt: now - 3 * 3_600_000, durationHours: 8, cameraStyle: "original", revealEnabled: pending, revealAt: pending ? now + 2 * 60_000 : null, revealAnchor: "data", revealOffsetDays: 0, timezone: defaultTimezone(), revealStatus: pending ? "pendente" : "desativada", revealedAt: null, version: 1,
    capacity: 100, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone",
    place: "Chalés Taíba, CE", moments: MOMENTS, tables: 10, createdAt: now - 3 * 3_600_000,
    notice: { text: "Pôr do sol na areia em 10 minutos." },
  };
  await repos.events.save(event);
  for (const g of GUESTS) await repos.participants.put({ eventId: event.id, userId: g.id, name: g.name, joinedAt: event.startAt + 60_000, tableLabel: g.table });
  for (let i = 0; i < 12; i++) {
    const g = GUESTS[i % GUESTS.length];
    const photo: Photo = {
      id: crypto.randomUUID(), eventId: event.id, authorId: g.id, authorName: g.name, createdAt: now - (12 - i) * 11 * 60_000,
      moment: MOMENTS[i % MOMENTS.length], caption: i % 3 === 0 ? "Ninguém segurou a emoção." : undefined, tableLabel: g.table,
      status: "visivel", reports: i === 7 ? 1 : 0, highlighted: i === 2, version: 1, uploadStatus: "pronta",
    };
    await repos.photos.add(photo, sampleImage(i));
    for (let k = 0; k < (i % 4) + 1; k++) {
      await repos.reactions.put({ eventId: event.id, photoId: photo.id, authorId: GUESTS[(i + k + 1) % GUESTS.length].id, kind: KINDS[(i + k) % KINDS.length] });
    }
  }
  for (const label of ["Mesa 1", "Mesa 3", "Mesa 8", "Bar"]) await repos.invitations.put({ id: crypto.randomUUID(), eventId: event.id, label, createdAt: now });
  return event;
}
