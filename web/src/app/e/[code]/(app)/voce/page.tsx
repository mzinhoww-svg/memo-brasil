"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationPlan } from "@/domain/notifications";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { download, zipAlbum } from "@/features/admin/export";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { ConvidadoVoce } from "@/revela/screens/ConvidadoVoce";

/** 23g · Você */
export default function Voce() {
  const { repos, scheduler, now: clock, signOut } = useApp();
  const { event, user, participant, photos, counts, now } = useGuest();
  const router = useRouter();
  const cloud = backendMode() === "supabase";
  const [notify, setNotify] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | undefined>();
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    void browserSupabase().rpc("get_my_email", { p_event: event.id }).then(({ data }) => { if (live && data?.email) { setEmail(String(data.email)); setNotify(true); } });
    return () => { live = false; };
  }, [cloud, event.id]);

  async function toggleNotify() {
    if (notify) { setNotify(false); if (cloud) await browserSupabase().rpc("email_opt_out_mine", { p_event: event.id }); setEmail(undefined); return; }
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (p === "granted") scheduler.schedule(event.id, notificationPlan(event, clock()));
    }
    setNotify(true);
  }
  async function editEmail() {
    const v = window.prompt("E-mail para o aviso de revelação (só serve para isso)", email ?? "");
    if (v === null) return;
    if (!cloud) return setMsg("O aviso por e-mail precisa do servidor ligado.");
    const { error } = await browserSupabase().rpc("set_my_email", { p_event: event.id, p_email: v, p_consent: v.trim() !== "" });
    if (error) return setMsg("Confira o e-mail e tente de novo.");
    setEmail(v.trim() || undefined);
    setNotify(true);
  }
  async function downloadMine() {
    const mine = photos.filter((p) => p.authorId === user.id);
    if (!mine.length) return setMsg(counts.mine ? "Suas fotos aparecem para baixar depois da revelação." : "Você ainda não tirou fotos.");
    const z = await zipAlbum(repos, event, mine);
    download(z.blob, z.filename);
  }
  async function leave() {
    if (!window.confirm("Sair deste evento? Suas fotos continuam no evento.")) return;
    await repos.participants.remove(event.id, user.id);
    router.push("/");
  }
  async function wipe() {
    if (!window.confirm("Apagar meus dados? Suas fotos e comentários deixam de ter o seu nome e você sai do evento.")) return;
    if (cloud) await browserSupabase().rpc("request_account_deletion");
    for (const p of photos.filter((x) => x.authorId === user.id)) await repos.photos.remove(p.id).catch(() => undefined);
    await repos.participants.remove(event.id, user.id).catch(() => undefined);
    await signOut();
    router.push("/");
  }
  const total = event.shotsPerPerson;
  const sub = `${event.hostName ? `Convidado de ${event.title}` : "Convidado"}${participant?.tableLabel ? ` · ${participant.tableLabel}` : ""}`;
  return (
    <>
      <ConvidadoVoce code={event.code} name={user.name} sub={sub} used={counts.mine} total={total} notify={notify} email={email ?? "Adicionar e-mail"}
        onNotify={() => void toggleNotify()} onEmail={() => void editEmail()} onDownload={() => void downloadMine()} onLeave={() => void leave()} onDelete={() => void wipe()} />
      {msg && <p className="rv-field-erro rv-toast-in" role="status" style={{ position: "fixed", left: 20, right: 20, bottom: 84, textAlign: "center", zIndex: 40 }} onClick={() => setMsg(undefined)}>{msg}</p>}
      <span className="rv-sr-only" data-now={now} />
    </>
  );
}
