"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmSheet, Field, Sheet, Stepper } from "@/components/revela";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";
import { inviteUrl, tableFromSearch } from "@/features/invitations/links";
import { copyText } from "@/features/invitations/share";
import { siteOrigin } from "@/lib/site";
import type { Invitation } from "@/repositories";
import { PainelConvites, type InviteRow } from "@/revela/screens/PainelConvites";
import { useFlash } from "@/revela/painel-ui";

type Pick = { kind: "geral" } | { kind: "mesa"; label: string } | { kind: "convite"; invite: Invitation };

/** Convites e mesas (17e): o link geral, um QR por mesa e links com nome (ex.: "Bar"); cada foto sai com a origem de quem tirou. */
export default function Convites() {
  const router = useRouter();
  const { repos, now: clock } = useApp();
  const { event, participants, refresh } = useAdmin();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [pick, setPick] = useState<Pick | undefined>();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [revoking, setRevoking] = useState<Invitation | undefined>();
  const [toast, flash] = useFlash();
  const origin = siteOrigin();
  const load = useCallback(async () => { try { setInvites(await repos.invitations.listByEvent(event.id)); } catch { flash("Não deu para carregar os convites."); } }, [repos, event.id, flash]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const guests = useMemo(() => participants.filter((p) => p.userId !== event.hostId), [participants, event.hostId]);
  const entered = (l?: string) => guests.filter((p) => (l ? p.tableLabel === l : !p.tableLabel)).length;
  const meta = (n: number) => `${n} ${n === 1 ? "entrou" : "entraram"}`;
  const mesas = Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`);
  const rows: InviteRow[] = [
    { id: "geral", label: "Geral (link e convite A5)", meta: meta(entered()) },
    ...mesas.map((l) => ({ id: `mesa:${l}`, label: l, meta: meta(entered(l)) })),
    ...invites.map((i) => ({ id: `convite:${i.id}`, label: i.label, meta: meta(entered(i.label)) })),
  ];
  function open(id: string) {
    if (id === "geral") return setPick({ kind: "geral" });
    if (id.startsWith("mesa:")) return setPick({ kind: "mesa", label: id.slice(5) });
    const invite = invites.find((i) => `convite:${i.id}` === id);
    if (invite) setPick({ kind: "convite", invite });
  }
  const linkOf = (p: Pick) => inviteUrl(origin, event.code, p.kind === "mesa" ? p.label : p.kind === "convite" ? p.invite.label : undefined);

  async function create() {
    const v = label.trim();
    if (!tableFromSearch(`?mesa=${encodeURIComponent(v)}`)) return setFormError("Use até 24 letras, números, espaço, ponto ou hífen.");
    if ([...mesas, ...invites.map((i) => i.label)].some((l) => l.toLowerCase() === v.toLowerCase())) return setFormError("Esse convite já existe.");
    try {
      await repos.invitations.put({ id: crypto.randomUUID(), eventId: event.id, label: v, createdAt: clock() });
      setLabel(""); setFormError(undefined); setAdding(false);
      await load();
    } catch { setFormError("Não foi possível criar o convite. Tente de novo."); }
  }

  return (
    <>
      <PainelConvites rows={rows} onBack={() => router.push(`/painel/${event.id}`)} onNew={() => { setFormError(undefined); setAdding(true); }} onRow={open} onPrint={() => router.push(`/painel/${event.id}/qr`)} />
      {toast}
      {pick && (
        <Sheet title={pick.kind === "geral" ? "Convite geral" : pick.kind === "mesa" ? pick.label : pick.invite.label} onClose={() => setPick(undefined)}>
          <p className="app-p app-muted" style={{ wordBreak: "break-all" }}>{linkOf(pick)}</p>
          <div className="app-stack-sm">
            <Button block onClick={async () => { flash((await copyText(linkOf(pick))) ? "Link copiado." : "Não conseguimos copiar o link."); setPick(undefined); }}>Copiar link</Button>
            {pick.kind === "geral" && <Button block variant="secundario" onClick={() => router.push(`/painel/${event.id}/convite`)}>Ver convite A5</Button>}
            {pick.kind !== "convite" && <Button block variant="secundario" onClick={() => router.push(`/painel/${event.id}/qr`)}>Cartões de mesa</Button>}
            {pick.kind === "convite" && <Button block variant="destrutivo" onClick={() => { setRevoking(pick.invite); setPick(undefined); }}>Revogar convite</Button>}
          </div>
        </Sheet>
      )}
      {adding && (
        <Sheet title="Novo convite" onClose={() => setAdding(false)}>
          <form className="app-stack-sm" onSubmit={(e) => { e.preventDefault(); void create(); }} noValidate>
            <Field label="Nome do convite" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} placeholder="Ex.: Bar, Família da noiva" error={formError} />
            <Button type="submit" block>Criar convite</Button>
          </form>
          <Stepper label="Mesas com cartão" value={event.tables} min={0} max={60} decrementLabel="Menos uma mesa" incrementLabel="Mais uma mesa" format={(n) => String(n)} onChange={async (n) => { await updateSettings(repos, event.id, { tables: n }); await refresh(); }} />
        </Sheet>
      )}
      {revoking && (
        <ConfirmSheet title={`Revogar ${revoking.label}?`} body="Quem ainda não entrou por esse link deixa de poder usá-lo. Quem já entrou continua na festa." confirmLabel="Revogar convite"
          onCancel={() => setRevoking(undefined)} onConfirm={async () => { await repos.invitations.remove(revoking.id); setRevoking(undefined); await load(); }} />
      )}
    </>
  );
}
