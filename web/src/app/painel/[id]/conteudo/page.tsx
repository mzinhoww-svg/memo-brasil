"use client";

import { useMemo, useState } from "react";
import { Button, PostCard, Tabs, panelId } from "@/components/memoriesmt";
import { moderationQueue } from "@/domain/photo";
import { moderate, type ModerationAction } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { relativeTime, usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { avatarOf, tagFor, visionName } from "@/features/photos/labels";

type Tab = "pedidos" | "ocultas" | "todas";

export default function Conteudo() {
  const { repos } = useApp();
  const { event, now, photos, refresh } = useAdmin();
  const [tab, setTab] = useState<Tab>("pedidos");
  const live = photos.filter((p) => p.status !== "removida");
  const reported = useMemo(() => moderationQueue(live).filter((p) => p.status === "visivel"), [live]);
  const hidden = live.filter((p) => p.status === "oculta");
  const list = tab === "pedidos" ? reported : tab === "ocultas" ? hidden : live;
  const urls = usePhotoUrls(list);

  async function act(id: string, a: ModerationAction) {
    await moderate(repos, id, a);
    await refresh();
  }

  return (
    <>
      <h1 className="titulo-pagina app-h1">Conteúdo</h1>
      <Tabs base="mod" label="Filas de moderação" value={tab} onChange={(v) => setTab(v as Tab)} tabs={[{ id: "pedidos", label: "Pedidos de remoção", count: reported.length }, { id: "ocultas", label: "Ocultas", count: hidden.length }, { id: "todas", label: "Todas", count: live.length }]} />
      <div role="tabpanel" id={panelId("mod", tab)} aria-labelledby={`mod-tab-${tab}`} className="app-stack" style={{ gap: "var(--space-8)", maxWidth: 480 }}>
        {list.length === 0 ? <p className="app-p app-muted">{tab === "pedidos" ? "Nenhum pedido de remoção. Quando alguém pedir, a foto aparece aqui." : tab === "ocultas" ? "Nenhuma foto oculta." : "Ainda sem fotos."}</p> : null}
        {list.map((p) => (
          <div key={p.id} className="app-stack-sm">
            <PostCard vision={visionName(p)} meta={`${p.moment} · ${relativeTime(p.createdAt, now)}${p.reports ? ` · ${p.reports} ${p.reports === 1 ? "pedido" : "pedidos"}` : ""}`} avatar={avatarOf(p)} imageSrc={urls[p.id]} alt={`Foto de ${visionName(p)}`} caption={p.caption} tag={p.highlighted ? tagFor(event.category) : undefined} />
            <div className="app-row">
              {p.status === "oculta" ? <Button variant="pequeno" onClick={() => act(p.id, "mostrar")}>Mostrar de novo</Button> : <Button variant="pequeno" onClick={() => act(p.id, "ocultar")}>Ocultar</Button>}
              <Button variant="pequeno" onClick={() => act(p.id, "destacar")}>{p.highlighted ? "Tirar destaque" : "Destacar"}</Button>
              <Button variant="destrutivo" small onClick={() => act(p.id, "remover")}>Remover</Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
