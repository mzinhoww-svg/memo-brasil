import type { EventFontId, PaletteId } from "@/domain/event";

/** Cinco tokens `evento-*` por tema (README do kit, "Camada do evento"). `on-evento` é fixo por tema. */
export interface EventColors {
  superficie: string;
  grafismo: string;
  controle: string;
  texto: string;
  profundo: string;
}
export const PALETTES: Record<PaletteId, { label: string; dia: EventColors; noite: EventColors }> = {
  salvia: {
    label: "Sálvia",
    dia: { superficie: "#E8ECE4", grafismo: "#AAB4A2", controle: "#889082", texto: "#5B6752", profundo: "#4A5543" },
    noite: { superficie: "#262D24", grafismo: "#5B6752", controle: "#889082", texto: "#AAB4A2", profundo: "#C9D1C1" },
  },
  terracota: {
    label: "Terracota",
    dia: { superficie: "#F3E6DD", grafismo: "#D9A58A", controle: "#A8725A", texto: "#8C4A2F", profundo: "#6E3820" },
    noite: { superficie: "#33261F", grafismo: "#8C4A2F", controle: "#A8725A", texto: "#D9A58A", profundo: "#EBC7B3" },
  },
  oceano: {
    label: "Oceano",
    dia: { superficie: "#E2ECF1", grafismo: "#9DB8C6", controle: "#6F8F9F", texto: "#3F6275", profundo: "#2F4C5C" },
    noite: { superficie: "#1F2A31", grafismo: "#3F6275", controle: "#6F8F9F", texto: "#9DB8C6", profundo: "#C3D6E0" },
  },
  ameixa: {
    label: "Ameixa",
    dia: { superficie: "#EEE3EA", grafismo: "#B79BAE", controle: "#8B6C82", texto: "#6B4A61", profundo: "#523648" },
    noite: { superficie: "#2D2229", grafismo: "#6B4A61", controle: "#8B6C82", texto: "#B79BAE", profundo: "#D9C5D2" },
  },
};
export const ON_EVENTO = { dia: "#FFFFFF", noite: "#141211" } as const;
export const THEME_BASE = { dia: { fundo: "#FFFFFF", tinta: "#1C1917" }, noite: { fundo: "#141211", tinta: "#F4F2EF" } } as const;

export const EVENT_FONT_VAR: Record<EventFontId, string> = {
  birthstone: "--fonte-birthstone",
  pinyon: "--fonte-pinyon",
  vibes: "--fonte-vibes",
};
export const EVENT_FONT_LABEL: Record<EventFontId, string> = { birthstone: "Birthstone Bounce", pinyon: "Pinyon Script", vibes: "Great Vibes" };

const block = (c: EventColors, on: string) =>
  `--evento-superficie:${c.superficie};--evento-grafismo:${c.grafismo};--evento-controle:${c.controle};--evento-texto:${c.texto};--evento-profundo:${c.profundo};--on-evento:${on};`;

/** CSS dos dois temas para cada paleta; a mesma fonte de dados é validada nos testes de contraste. */
export function paletteCss(): string {
  return (Object.keys(PALETTES) as PaletteId[])
    .map((id) => `[data-palette="${id}"]{${block(PALETTES[id].dia, ON_EVENTO.dia)}}[data-theme="noite"] [data-palette="${id}"],[data-theme="noite"][data-palette="${id}"]{${block(PALETTES[id].noite, ON_EVENTO.noite)}}`)
    .join("");
}
