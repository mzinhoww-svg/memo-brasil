import type { PhotoData, PhotoUrl } from "./types";

/** URL temporária para os bytes locais. Com o Supabase este papel é de uma URL assinada (curta) do Storage. */
export function objectUrl(data: PhotoData): PhotoUrl {
  const url = URL.createObjectURL(new Blob([data.bytes], { type: data.type }));
  return { url, release: () => URL.revokeObjectURL(url) };
}
