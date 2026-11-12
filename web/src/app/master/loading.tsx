import { MNote } from "@/revela/master-kit";

export default function CarregandoMaster() {
  return <div role="status" aria-live="polite"><MNote icon="clock">Carregando…</MNote></div>;
}
