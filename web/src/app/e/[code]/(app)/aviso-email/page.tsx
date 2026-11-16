"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Sheet } from "@/components/revela";
import { visiblePhotos } from "@/domain/photo";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";
import { firstName, photoMoment } from "@/features/feed/format";
import { hhmm } from "@/features/guest/format";
import { emailFailureText, getMyEmail, optOutMine, setMyEmail, type MyEmail } from "@/features/participants/guest-email";
import { revealText } from "@/features/reveal/RevealIntro";
import { useSmartBack } from "@/lib/smart-back";
import { backendMode } from "@/lib/supabase/env";
import { FeedEmail } from "@/revela/screens/FeedEmail";

/** 24i · Aviso por e-mail: o e-mail que a pessoa recebe quando a festa revela, com o formulário para deixar, trocar ou tirar o e-mail. */
export default function AvisoEmail() {
  const router = useRouter();
  const { event, user, viewer, now, photos, counts } = useGuest();
  const feed = `/e/${event.code}/agora`;
  const back = useSmartBack(feed);
  const cloud = backendMode() === "supabase";
  const [mine, setMine] = useState<MyEmail | undefined>();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    void getMyEmail(event.id).then((m) => { if (live) { setMine(m); setEmail(m?.email ?? ""); } });
    return () => { live = false; };
  }, [event.id]);

  const picks = useMemo(() => visiblePhotos(event, photos, viewer, now).sort((a, b) => photoMoment(b) - photoMoment(a)).slice(0, 3), [event, photos, viewer, now]);
  const urls = usePhotoUrls(picks);
  const at = event.revealedAt ?? event.revealAt ?? now;
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: event.timezone || "America/Cuiaba", weekday: "short" }).format(new Date(at)).replace(".", "");
  const kind = event.category === "casamento" ? "casamento" : "evento";

  async function save() {
    if (busy) return;
    setBusy(true);
    setNote(undefined);
    const r = await setMyEmail(event.id, email);
    setBusy(false);
    if (r !== "ok") { setNote(emailFailureText(r)); return; }
    setMine(await getMyEmail(event.id));
    setNote(email.trim() ? "Pronto. Avisamos você neste e-mail quando as fotos revelarem." : "E-mail removido.");
  }
  async function leave() {
    if (busy) return;
    setBusy(true);
    const ok = await optOutMine(event.id);
    setBusy(false);
    if (ok) { setMine(await getMyEmail(event.id)); setEmail(""); setNote("Pronto, sem mais e-mails. As fotos continuam no feed."); }
    else setNote(emailFailureText("unavailable"));
  }

  return (
    <>
      <FeedEmail
        subject={`Revelou: as fotos de ${event.title}`} from={`Revela <avisos@revela.app> · ${day} ${hhmm(at, event.timezone)}`}
        greeting={`Revelou, ${firstName(user.name)}.`}
        body={`${revealText(event.title, counts.total, counts.mine, "no feed").replace(`de ${event.title}`, `do ${kind}`)} Curta, comente e baixe as que quiser.`}
        prints={picks.filter((p) => urls[p.id]).map((p) => ({ src: urls[p.id] }))}
        backHref={feed} onBack={back} openHref={feed} onOptOut={cloud ? () => void leave() : undefined}
      />
      {open && (
        <Sheet title="Aviso por e-mail" onClose={back}>
          <p className="corpo app-p">Quer um aviso quando as fotos revelarem? Deixe seu e-mail. É o único e-mail que enviamos sobre esta festa, e você sai da lista quando quiser.</p>
          {!cloud && <p className="app-p app-muted" role="status">Neste modo de teste os avisos por e-mail não são enviados.</p>}
          {mine?.optedOut && <p className="app-p app-muted">Você saiu da lista. Deixe o e-mail de novo para voltar a receber.</p>}
          <label className="rv-field" style={{ height: "48px" }}>
            <input type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" aria-label="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!cloud} />
          </label>
          <p className="app-p" role="status">{note ?? ""}</p>
          <Button block disabled={!cloud || busy || (!email.trim() && !mine?.email)} onClick={() => void save()}>{email.trim() ? "Salvar e-mail" : "Remover e-mail"}</Button>
          {cloud && mine?.email && <Button variant="secundario" block disabled={busy} onClick={() => void leave()}>Não quero mais avisos</Button>}
          <Button variant="texto" block onClick={() => { setOpen(false); router.push(feed); }}>Voltar ao feed</Button>
        </Sheet>
      )}
    </>
  );
}
