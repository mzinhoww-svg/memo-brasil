/** Opções confirmadas pelo REA (docs/reverse-engineering/02, F-21), só para escolhas dentro do plano. `null` = ilimitado.
 * Limites e preço de cada plano vêm do servidor (`@/features/billing/api`). */
export const CAPACITY_OPTIONS = [5, 10, 20, 50, 100, 150, 200, null] as const;
export const SHOTS_OPTIONS = [5, 10, 16, 24, 36, null] as const;
export type Capacity = (typeof CAPACITY_OPTIONS)[number];
export type Shots = (typeof SHOTS_OPTIONS)[number];

export const MIN_DURATION_HOURS = 0.5; // término a pelo menos 30 minutos (REA F-17)

export type CameraStyle = "original" | "vintage" | "preto-e-branco"; // ORIGINAL | VINTAGE | BLACK_WHITE
export type EventCategory = "casamento" | "festa" | "empresa" | "viagem" | "outro";

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  casamento: "Casamento",
  festa: "Festa",
  empresa: "Evento de empresa",
  viagem: "Viagem",
  outro: "Outro evento",
};
export const CAMERA_STYLE_LABEL: Record<CameraStyle, string> = {
  original: "Original",
  vintage: "Vintage",
  "preto-e-branco": "Preto e branco",
};
