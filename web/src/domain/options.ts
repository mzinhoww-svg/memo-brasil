/** Opções confirmadas pelo REA (docs/reverse-engineering/02, F-21), só para escolhas dentro do plano. `null` = ilimitado.
 * Limites e preço de cada plano vêm do servidor (`@/features/billing/api`). */
export const CAPACITY_OPTIONS = [5, 10, 20, 50, 100, 150, 200, null] as const;
export const SHOTS_OPTIONS = [5, 10, 16, 24, 36, null] as const;
export type Capacity = (typeof CAPACITY_OPTIONS)[number];
export type Shots = (typeof SHOTS_OPTIONS)[number];

export const MIN_DURATION_HOURS = 0.5; // término a pelo menos 30 minutos (REA F-17)

/** Embalagem da câmera do evento (Revela). Valores antigos (original, vintage, preto-e-branco) continuam legíveis e caem em "festa". */
export const WRAPS = ["festa", "casamento", "aniversario", "noite"] as const;
export type Wrap = (typeof WRAPS)[number];
export type CameraStyle = Wrap | "original" | "vintage" | "preto-e-branco";
export const DEFAULT_WRAP: Wrap = "festa";
export function wrapOf(style: CameraStyle | string | null | undefined): Wrap {
  return (WRAPS as readonly string[]).includes(style ?? "") ? (style as Wrap) : DEFAULT_WRAP;
}
/** Filme aplicado nas fotos: natural ou Filme 35mm (tons quentes, grão, carimbo de data e brilho do flash). */
export type FilmLook = "natural" | "filme35";
export const DEFAULT_FILM: FilmLook = "filme35";
export const FILM_LABEL: Record<FilmLook, string> = { natural: "Natural", filme35: "Filme 35mm" };
export const WRAP_INFO: Record<Wrap, { label: string; blurb: string }> = {
  festa: { label: "Festa", blurb: "Laranja Revela, a embalagem clássica da câmera descartável." },
  casamento: { label: "Casamento", blurb: "Marfim com faixa dourada. O nome do casal sai impresso." },
  aniversario: { label: "Aniversário", blurb: "Azul cobalto com confete impresso." },
  noite: { label: "Noite", blurb: "Verde garrafa e champanhe, para festa à luz de vela." },
};
export type EventCategory = "casamento" | "festa" | "empresa" | "viagem" | "outro";

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  casamento: "Casamento",
  festa: "Festa",
  empresa: "Evento de empresa",
  viagem: "Viagem",
  outro: "Outro evento",
};
export const CAMERA_STYLE_LABEL: Record<CameraStyle, string> = {
  festa: "Festa",
  casamento: "Casamento",
  aniversario: "Aniversário",
  noite: "Noite",
  original: "Original",
  vintage: "Vintage",
  "preto-e-branco": "Preto e branco",
};
