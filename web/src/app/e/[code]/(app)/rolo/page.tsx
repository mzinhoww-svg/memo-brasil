"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shotsLeft } from "@/domain/event";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { DEFAULT_FILM } from "@/domain/options";
import { fileToImage, renderPhoto } from "@/features/photos/capture";
import { postPhoto } from "@/features/photos/service";
import { useRollPicker } from "@/features/photos/roll-picker";
import { momentName } from "@/domain/moments";
import { ConvidadoPostar } from "@/revela/screens/ConvidadoPostar";

/** 23d · Enviar do rolo: as fotos escolhidas no aparelho, com o mesmo filme, vão direto para o laboratório. */
export default function Rolo() {
  const router = useRouter();
  const { repos, now: clock } = useApp();
  const { event, user, participant, counts, refresh } = useGuest();
  const picker = useRollPicker();
  const base = `/e/${event.code}`;
  const left = shotsLeft(event, counts.mine);
  const cap = left === null ? picker.files.length : left;
  const urls = useMemo(() => picker.files.map((f) => URL.createObjectURL(f)), [picker.files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [on, setOn] = useState<boolean[]>([]);
  const init = useRef(false);
  useEffect(() => {
    if (picker.files.length && !init.current) { init.current = true; setOn(picker.files.map((_, i) => i < cap)); }
  }, [picker.files, cap]);
  useEffect(() => { if (!picker.files.length) router.replace(`${base}/minhas`); }, [picker.files.length, router, base]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const items = urls.map((src, i) => ({ src, on: !!on[i] }));
  const chosen = on.filter(Boolean).length;

  function toggle(i: number) {
    setError(undefined);
    setOn((cur) => {
      const next = [...cur];
      if (!next[i] && next.filter(Boolean).length >= cap) { setError(`Você tem ${cap} ${cap === 1 ? "pose" : "poses"} no rolo.`); return cur; }
      next[i] = !next[i];
      return next;
    });
  }
  async function send() {
    if (busy || !chosen) return;
    setBusy(true); setError(undefined);
    let sent = 0;
    try {
      for (const [i, f] of picker.files.entries()) {
        if (!on[i]) continue;
        const img = await fileToImage(f);
        const data = await renderPhoto(img, img.naturalWidth, img.naturalHeight, event.filmLook ?? DEFAULT_FILM);
        const r = await postPhoto(repos, event, user, data, { moment: momentName(event.moments[0] ?? "Agora"), caption: "", tableLabel: participant?.tableLabel }, clock(), { photoId: crypto.randomUUID(), resume: false });
        if (!r.ok) { setError(r.reason === "rolo" ? "Seu rolo acabou." : r.reason === "rede" ? "Sem conexão. Tente de novo." : "Não deu para enviar uma das fotos."); break; }
        sent++;
      }
    } catch { setError("Não deu para enviar. Tente de novo."); }
    await refresh();
    setBusy(false);
    if (sent && sent === chosen) { picker.clear(); router.push(`${base}/minhas`); }
  }
  return (
    <>
      <ConvidadoPostar perPerson={event.shotsPerPerson} cap={cap} items={items} busy={busy} onToggle={toggle} onSend={() => void send()} onClose={() => { picker.clear(); router.push(`${base}/minhas`); }} />
      {error && <p className="rv-field-erro rv-toast-in" role="alert" style={{ position: "fixed", left: 20, right: 20, bottom: 84, textAlign: "center", zIndex: 40 }}>{error}</p>}
    </>
  );
}
