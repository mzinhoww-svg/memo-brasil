/* eslint-disable @next/next/no-img-element -- fotos locais vêm de blob URLs; next/image não se aplica */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/features/app/provider";
import { useState } from "react";
import { notificationPlan } from "@/domain/notifications";
import { Button, Icon, Progress, Signature } from "@/components/revela";
import { isRevealed, shotsLeft } from "@/domain/event";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";
import { devToolsEnabled } from "@/lib/dev-tools";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";

export default function Voce() {
  const { event, user, now, photos, counts, isHost } = useGuest();
  const { signOut, scheduler, now: clock, canSwitchIdentity } = useApp();
  const [avisos, setAvisos] = useState<string | undefined>();
  const router = useRouter();
  const mine = photos.filter((p) => p.authorId === user.id && p.status !== "removida");
  const urls = usePhotoUrls(isRevealed(event, now) ? mine : [], "thumb");
  const left = shotsLeft(event, counts.mine);
  const revealed = isRevealed(event, now);
  const total = event.shotsPerPerson;

  return (
    <div className="app-screen">
      <div className="app-stack-sm">
        <p className="eyebrow app-eyebrow">Você está dentro, {user.name}.</p>
        <h1 className="titulo-tela app-h1">Você</h1>
      </div>

      <section className="app-stack-sm" aria-labelledby="rolo">
        <h2 id="rolo" className="titulo-card app-h1">Seu rolo</h2>
        {total === null ? (
          <p className="corpo app-p">Rolo ilimitado. {counts.mine === 1 ? "Já é 1 foto." : `Já são ${counts.mine.toLocaleString("pt-BR")} fotos.`}</p>
        ) : (
          <Progress variant="evento" label={`Restam ${left} de ${total}`} status={`${counts.mine} usadas`} value={(counts.mine / total) * 100} />
        )}
      </section>

      <section className="app-stack-sm" aria-labelledby="minhas">
        <h2 id="minhas" className="titulo-card app-h1">Suas fotos</h2>
        {counts.mine === 0 ? (
          <div className="app-empty">
            <Icon name="camera" label="Câmera" size={28} />
            <p className="corpo app-p">Você ainda não postou.</p>
            <p className="app-p">Viu alguma coisa boa? Posta.</p>
          </div>
        ) : !revealed ? (
          // antes da revelação a lista vem vazia (ITG-101): só a contagem chega, e cada foto é um marcador sem conteúdo
          <div className="app-grid-3">
            {Array.from({ length: Math.min(counts.mine, 60) }, (_, i) => (
              <div key={i} className="app-thumb"><span className="app-thumb-badge">Guardada</span></div>
            ))}
          </div>
        ) : (
          <div className="app-grid-3">
            {mine.map((p) => (
              <div key={p.id} className="app-thumb">
                {urls[p.id] && <img src={urls[p.id]} alt={`Sua foto, momento ${p.moment}`} />}
                <span className="app-thumb-badge">{p.status === "oculta" ? "Oculta" : revealed ? "Publicada" : "Guardada"}</span>
              </div>
            ))}
          </div>
        )}
        {counts.mine > 0 && !revealed && <p className="app-p app-muted">Suas fotos estão guardadas no escuro. Elas aparecem na revelação.</p>}
      </section>

      <section className="app-stack-sm" aria-labelledby="avisos">
        <h2 id="avisos" className="titulo-card app-h1">Avisos do evento</h2>
        <p className="app-p app-muted meta">Lembretes de fim e de revelação. Nesta versão funcionam só enquanto o Revela estiver aberto.</p>
        <Button
          variant="secundario"
          block
          onClick={async () => {
            if (typeof Notification === "undefined") return setAvisos("Este navegador não mostra avisos.");
            const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
            if (p !== "granted") return setAvisos("Avisos bloqueados. Libere nas permissões do navegador.");
            scheduler.schedule(event.id, notificationPlan(event, clock()));
            setAvisos(copyFor(backendMode()).noticeOn);
          }}
        >
          Ativar avisos
        </Button>
        {avisos && <p className="app-p" role="status">{avisos}</p>}
      </section>

      <div className="app-stack-sm">
        {isHost && <Button href={`/painel/${event.id}`} variant="secundario" block>Abrir o painel do evento</Button>}
        <Link href="/" className="rv-btn rv-btn--texto" style={{ alignSelf: "flex-start" }}>Voltar ao início</Link>
        {canSwitchIdentity && devToolsEnabled() && (
        <div className="app-stack-sm">
            <Button variant="secundario" block onClick={async () => { await signOut(); router.push(`/e/${event.code}`); }}>Entrar como outra pessoa</Button>
            <p className="app-p app-muted">Demonstração: serve para testar a festa com mais de uma pessoa neste aparelho. Você volta para {user.name} pela tela inicial ou pelo convite, na lista Continuar como.</p>
          </div>
        )}
      </div>
      <div style={{ marginTop: "auto" }}><Signature /></div>
    </div>
  );
}
