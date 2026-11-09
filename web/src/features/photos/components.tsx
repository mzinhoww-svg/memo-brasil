"use client";

import { useState } from "react";
import { Button, Chip, Chips, Sheet } from "@/components/revela";
import { REACTION_LABEL, type Photo, type Reaction, type ReactionKind } from "@/domain/photo";

const KINDS = Object.keys(REACTION_LABEL) as ReactionKind[];

/** Reações do kit (rótulos em texto, sem emoji). Uma por pessoa e foto. */
export function PhotoReactions({ photo, reactions, userId, onReact }: { photo: Photo; reactions: Reaction[]; userId: string; onReact: (photoId: string, kind: ReactionKind) => void }) {
  const mine = reactions.find((r) => r.photoId === photo.id && r.authorId === userId)?.kind;
  return (
    <Chips label="Reações">
      {KINDS.map((k) => (
        <Chip key={k} pressed={mine === k} count={reactions.filter((r) => r.photoId === photo.id && r.kind === k).length} onClick={() => onReact(photo.id, k)}>
          {REACTION_LABEL[k]}
        </Chip>
      ))}
    </Chips>
  );
}

/** "Mais opções, incluindo pedir para remover". O pedido vai para a fila de moderação do anfitrião. */
export function MoreSheet({ onReport, onClose, onDownload, editHref, reactors }: { onReport: () => Promise<void>; onClose: () => void; onDownload?: () => Promise<boolean>; editHref?: string; reactors?: { name: string; label: string }[] }) {
  const [sent, setSent] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [saved, setSaved] = useState<"ok" | "falhou" | undefined>();
  return (
    <Sheet title="Mais opções" onClose={onClose}>
      {reactors && (
        <section className="app-stack-sm" aria-labelledby="quem">
          <h3 id="quem" className="nome app-h1">Quem reagiu</h3>
          {reactors.length === 0 ? <p className="app-p app-muted">Ninguém reagiu a esta foto ainda.</p> : <ul className="app-stack-sm" style={{ margin: 0, padding: 0, listStyle: "none" }}>{reactors.map((r) => <li key={r.name + r.label} className="app-between"><span>{r.name}</span><span className="app-muted">{r.label}</span></li>)}</ul>}
        </section>
      )}
      {editHref && <Button variant="secundario" href={editHref} block>Editar foto</Button>}
      {onDownload && <Button variant="secundario" icon="baixar" block onClick={async () => setSaved((await onDownload().catch(() => false)) ? "ok" : "falhou")}>Baixar foto</Button>}
      <p className="app-p" role="status">{saved === "ok" ? "Foto baixada." : saved === "falhou" ? "Não deu para baixar essa foto. Tente de novo." : ""}</p>
      {sent ? <p className="corpo app-p">Pedido enviado. O anfitrião vai analisar.</p> : <p className="corpo app-p app-muted">Essa foto não deveria estar aqui? Peça para remover.</p>}
      {reportError && <p className="app-p" role="alert">Não deu para enviar o pedido. Tente de novo.</p>}
      <div className="app-stack-sm">
        {!sent && <Button variant="destrutivo" block disabled={reporting} onClick={async () => {
          if (reporting) return;
          setReporting(true); setReportError(false);
          try { await onReport(); setSent(true); }
          catch { setReportError(true); }
          finally { setReporting(false); }
        }}>{reporting ? "Enviando pedido…" : "Pedir para remover"}</Button>}
        <Button variant="secundario" block onClick={onClose}>{sent ? "Fechar" : "Voltar"}</Button>
      </div>
    </Sheet>
  );
}
