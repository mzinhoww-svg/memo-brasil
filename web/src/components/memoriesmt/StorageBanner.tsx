"use client";

import { useState } from "react";
import { useApp } from "@/features/app/provider";
import { Icon } from "./Icon";

/** Aviso global quando uma gravação local falha (cota cheia, modo privado, bloqueio). */
export function StorageBanner() {
  const { storageError } = useApp();
  const [closed, setClosed] = useState(false);
  if (!storageError || closed) return null;
  return (
    <div role="alert" className="app-banner" style={{ margin: "var(--space-4)", maxWidth: 480, marginInline: "auto" }}>
      <Icon name="sem-sinal" decorative size={22} />
      <span>Não deu para guardar neste aparelho. Libere espaço ou saia do modo privado e tente de novo.</span>
      <button type="button" className="mm-btn mm-btn--texto" onClick={() => setClosed(true)}>Fechar</button>
    </div>
  );
}
