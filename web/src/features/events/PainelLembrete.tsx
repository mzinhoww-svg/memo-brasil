/**
 * Lembrete de ativação no painel do evento: os mesmos lembretes do WhatsApp (textos da Coordenação), para quem não ativou os avisos
 * ou não abriu a mensagem. Um por vez, pela data do evento no fuso dele: logo depois de criar (sem convidados), 3 dias antes, véspera,
 * e a festa já começou sem ninguém. Some depois do evento ou quando já há convidados (fora dos lembretes de data).
 */
import { Button } from "@/components/revela/Button";

export type Lembrete = { kind: "criado" | "faltam" | "vespera" | "comecou"; title: string; text: string };

const dayIn = (ms: number, tz: string) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  return Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1, Number(p.slice(8, 10))) / 86_400_000;
};

export function lembreteDoPainel(e: { startAt: number; durationHours: number; timezone?: string | null }, now: number, guests: number): Lembrete | null {
  const end = e.startAt + e.durationHours * 3_600_000;
  if (now >= end) return null;
  let tz = e.timezone || "America/Cuiaba";
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); } catch { tz = "America/Cuiaba"; }
  if (now >= e.startAt) {
    return guests === 0 ? { kind: "comecou", title: "A festa começou!", text: "Ninguém entrou na câmera ainda. Mostre o QR nas mesas ou mande o link do convite: os convidados fotografam pelo celular, sem baixar nada." } : null;
  }
  const days = dayIn(e.startAt, tz) - dayIn(now, tz);
  if (days === 1) return { kind: "vespera", title: "Amanhã é o grande dia! 🎉", text: "Já imprimiu o QR e colocou nas mesas? Na hora, os convidados apontam a câmera do celular e fotografam, sem baixar nada." };
  if (days >= 2 && days <= 3) return { kind: "faltam", title: `Faltam ${days} dias para o evento`, text: "Já espalhou o QR? Dica: coloque um em cada mesa e um na entrada." };
  if (guests === 0) return { kind: "criado", title: "Próximo passo: o QR nas mesas", text: "Imprima o QR e coloque nas mesas. Seus convidados fotografam pelo celular, sem baixar aplicativo." };
  return null;
}

export function PainelLembrete({ eventId, lembrete }: { eventId: string; lembrete: Lembrete | null }) {
  if (!lembrete) return null;
  return (
    <section className="app-card stack" aria-labelledby="lembrete-titulo" data-testid={`lembrete-${lembrete.kind}`}>
      <h2 id="lembrete-titulo" className="titulo-card app-h1">{lembrete.title}</h2>
      <p className="app-p">{lembrete.text}</p>
      <Button href={`/painel/${encodeURIComponent(eventId)}/qr`} variant="secundario" block>Ver o QR</Button>
    </section>
  );
}
