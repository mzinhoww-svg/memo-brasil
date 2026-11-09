"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { moderationQueue } from "@/domain/photo";
import { AUTO_HIDE_REPORTS, moderateComment, useModerationComments, type CommentAction } from "@/features/admin/comments";
import { moderate, unblockGuest, type ModerationAction } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";
import { plural } from "@/lib/plural";
import { PainelModeracao, type ModTab, type ModcItem } from "@/revela/screens/PainelModeracao";
import { useFlash } from "@/revela/painel-ui";

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "Convidado sem nome";

/** Moderação (17i): fotos denunciadas, comentários denunciados ou escondidos e pessoas bloqueadas. */
export default function Moderacao() {
  const router = useRouter();
  const { repos } = useApp();
  const { event, photos, participants, refresh } = useAdmin();
  const { comments, failed, reload } = useModerationComments(event.id);
  const [tab, setTab] = useState<ModTab>("fotos");
  const [toast, flash] = useFlash();
  const live = useMemo(() => photos.filter((p) => p.status !== "removida"), [photos]);
  const reported = useMemo(() => moderationQueue(live).filter((p) => p.status === "visivel"), [live]);
  const queue = comments.filter((c) => c.hidden || c.reports > 0);
  const toReview = queue.filter((c) => !c.hidden).length;
  const blocked = participants.filter((p) => p.blockedAt !== undefined);
  const shown = useMemo(() => {
    const ids = new Set([...reported.map((p) => p.id), ...queue.map((c) => c.photoId)]);
    return live.filter((p) => ids.has(p.id));
  }, [live, reported, queue]);
  const urls = usePhotoUrls(shown, "thumb");

  async function run(task: () => Promise<void>) {
    try { await task(); } catch { flash("Não foi possível concluir. Tente de novo."); }
  }
  const photoAct = (id: string, a: ModerationAction) => run(async () => { await moderate(repos, id, a); await refresh(); });
  const commentAct = (id: string, a: CommentAction) => run(async () => { await moderateComment(id, a); await reload(); });

  let items: ModcItem[] = [];
  let empty = "";
  if (tab === "fotos") {
    empty = "Nenhuma foto denunciada. Quando alguém denunciar, ela aparece aqui.";
    items = reported.map((p) => ({
      id: p.id, img: urls[p.id], name: firstName(p.authorName), flag: `${p.reports} ${plural(p.reports, "denúncia", "denúncias")}`, text: p.caption ?? "Foto denunciada",
      actions: [{ label: "Manter", onClick: () => void photoAct(p.id, "mostrar") }, { label: "Esconder", danger: true, onClick: () => void photoAct(p.id, "ocultar") }],
    }));
  } else if (tab === "comentarios") {
    empty = failed ? "Não deu para carregar os comentários. Tente atualizar a página." : "Nenhum comentário denunciado ou escondido.";
    items = queue.map((c) => ({
      id: c.id, img: urls[c.photoId], name: c.authorName || "Convidado sem nome",
      flag: c.hidden ? `escondido${c.hiddenBy === "denuncias" ? " por denúncias" : ""}` : `${c.reports} ${plural(c.reports, "denúncia", "denúncias")}`, text: c.body,
      actions: c.hidden
        ? [{ label: "Mostrar", onClick: () => void commentAct(c.id, "mostrar") }, { label: "Remover", danger: true, onClick: () => void commentAct(c.id, "remover") }]
        : [{ label: "Manter", onClick: () => void commentAct(c.id, "mostrar") }, { label: "Esconder", danger: true, onClick: () => void commentAct(c.id, "esconder") }],
    }));
  } else {
    empty = "Ninguém bloqueado nesta festa.";
    items = blocked.map((p) => ({
      id: p.userId, name: p.name, text: "Não entra nem posta até você desbloquear.",
      actions: [{ label: "Desbloquear", onClick: () => void run(async () => { await unblockGuest(repos, event.id, p.userId); await refresh(); }) }],
    }));
  }

  return (
    <>
      <PainelModeracao
        tab={tab} onTab={setTab}
        counts={{ fotos: reported.length, comentarios: toReview, bloqueados: blocked.length }}
        items={items} empty={empty}
        toggles={[
          { label: "Comentários ligados", on: event.reactionsEnabled, onClick: () => void run(async () => { await updateSettings(repos, event.id, { reactionsEnabled: !event.reactionsEnabled }); await refresh(); }) },
          { label: `Esconder ao receber ${AUTO_HIDE_REPORTS} denúncias`, on: true },
        ]}
        onBack={() => router.push(`/painel/${event.id}`)}
      />
      {toast}
    </>
  );
}
