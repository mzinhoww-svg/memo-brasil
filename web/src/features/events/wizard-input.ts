import type { EventCategory } from "@/domain/options";
import type { EventFontId, PaletteId } from "@/domain/event";
import type { RevealInput } from "./reveal-input";
import type { EventInput } from "./service";
import { FREE_LIMITS } from "./plan-hint";

/** O evento SEMPRE nasce nos padrões do Grátis (10/10): o servidor recusa acima do plano efetivo (MM012). */
export const WIZARD_DEFAULTS = { capacity: FREE_LIMITS.guests, shots: FREE_LIMITS.shots } as const;

/** Identidade vai para o Studio (/painel/[id]/aparencia); o assistente só cria com os padrões atuais. */
export const IDENTITY_DEFAULTS: { cameraStyle: "original"; palette: PaletteId; eventFont: EventFontId } = { cameraStyle: "original", palette: "salvia", eventFont: "birthstone" };

export interface WizardForm {
  title: string;
  category: EventCategory;
  durationHours: number;
  reveal: RevealInput;
  /** Escolha do passo Fotos: só orienta o plano; NÃO é enviada acima do Grátis. */
  desiredShots: number | null;
}

export function buildCreateInput(f: WizardForm): EventInput {
  return {
    title: f.title,
    category: f.category,
    durationHours: f.durationHours,
    reveal: f.reveal,
    ...IDENTITY_DEFAULTS,
    capacity: WIZARD_DEFAULTS.capacity,
    shotsPerPerson: WIZARD_DEFAULTS.shots,
    everyoneSeesAll: true,
  };
}
