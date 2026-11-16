import type { PhotoData, PhotoSize, PhotoUrl } from "./types";

/** URL temporária para os bytes locais. Com o Supabase este papel é de uma URL assinada (curta) do Storage. */
export function objectUrl(data: PhotoData): PhotoUrl {
  const url = URL.createObjectURL(new Blob([data.bytes], { type: data.type }));
  return { url, release: () => URL.revokeObjectURL(url) };
}

/** `getUrls` dos adaptadores locais: os bytes estão no aparelho, então cada URL sai em paralelo (sem rede). */
export async function urlsFromSingle(getUrl: (id: string, size: PhotoSize) => Promise<PhotoUrl | undefined>, photos: { id: string }[], size: PhotoSize): Promise<Record<string, PhotoUrl>> {
  const got = await Promise.all(photos.map(async (p) => [p.id, await getUrl(p.id, size)] as const));
  const out: Record<string, PhotoUrl> = {};
  for (const [id, u] of got) if (u) out[id] = { ...u, size: "full" };
  return out;
}
