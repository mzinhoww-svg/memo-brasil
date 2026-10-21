"use client";

import { useState } from "react";
import { Button, Chip, Chips, Sheet } from "@/components/memoriesmt";
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
export function MoreSheet({ onReport, onClose }: { onReport: () => Promise<void>; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <Sheet title="Mais opções" onClose={onClose}>
      {sent ? <p className="corpo app-p">Pedido enviado. O anfitrião vai analisar.</p> : <p className="corpo app-p app-muted">Essa foto não deveria estar aqui? Peça para remover.</p>}
      <div className="app-stack-sm">
        {!sent && <Button variant="destrutivo" block onClick={async () => { await onReport(); setSent(true); }}>Pedir para remover</Button>}
        <Button variant="secundario" block onClick={onClose}>{sent ? "Fechar" : "Voltar"}</Button>
      </div>
    </Sheet>
  );
}
