/* eslint-disable @next/next/no-img-element -- fotos locais vêm de blob URLs; next/image não se aplica */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/features/app/provider";
import { useState } from "react";
import { notificationPlan } from "@/domain/notifications";
import { Button, Icon, Progress, Signature } from "@/components/memoriesmt";
import { isRevealed, shotsLeft } from "@/domain/event";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";

export default function Voce() {
  const { event, user, now, photos, isHost } = useGuest();
  const { signOut, scheduler, now: clock } = useApp();
  const [avisos, setAvisos] = useState<string | undefined>();
  const router = useRouter();
  const mine = photos.filter((p) => p.authorId === user.id && p.status !== "removida");
  const urls = usePhotoUrls(isRevealed(event, now) ? mine : []);
  const left = shotsLeft(event, mine.length);
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
          <p className="corpo app-p">Rolo ilimitado. Já são {mine.length.toLocaleString("pt-BR")} fotos.</p>
        ) : (
          <Progress variant="evento" label={`Restam ${left} de ${total}`} status={`${mine.length} usadas`} value={(mine.length / total) * 100} />
        )}
      </section>

      <section className="app-stack-sm" aria-labelledby="minhas">
        <h2 id="minhas" className="titulo-card app-h1">Suas fotos</h2>
        {mine.length === 0 ? (
          <div className="app-empty">
            <Icon name="camera" label="Câmera" size={28} />
            <p className="corpo app-p">Você ainda não postou.</p>
            <p className="app-p">Viu alguma coisa boa? Posta.</p>
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
        {mine.length > 0 && !revealed && <p className="app-p app-muted">Suas fotos estão guardadas no escuro. Elas aparecem na revelação.</p>}
      </section>

      <section className="app-stack-sm" aria-labelledby="avisos">
        <h2 id="avisos" className="titulo-card app-h1">Avisos do evento</h2>
        <p className="app-p app-muted meta">Lembretes de fim e de revelação. Nesta versão funcionam só enquanto o MemoriesMT estiver aberto.</p>
        <Button
          variant="secundario"
          block
          onClick={async () => {
            if (typeof Notification === "undefined") return setAvisos("Este navegador não mostra avisos.");
            const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
            if (p !== "granted") return setAvisos("Avisos bloqueados. Libere nas permissões do navegador.");
            scheduler.schedule(event.id, notificationPlan(event, clock()));
            setAvisos("Avisos ligados neste aparelho.");
          }}
        >
          Ativar avisos
        </Button>
        {avisos && <p className="app-p" role="status">{avisos}</p>}
      </section>

      <div className="app-stack-sm">
        {isHost && <Button href={`/painel/${event.id}`} variant="secundario" block>Abrir o painel do evento</Button>}
        <Link href="/" className="mm-btn mm-btn--texto" style={{ alignSelf: "flex-start" }}>Voltar ao início</Link>
        <div className="app-stack-sm">
          <Button variant="secundario" block onClick={async () => { await signOut(); router.push(`/e/${event.code}`); }}>Entrar como outra pessoa</Button>
          <p className="app-p app-muted">Demonstração: serve para testar a festa com mais de uma pessoa neste aparelho. Você volta para {user.name} pela tela inicial ou pelo convite, na lista Continuar como.</p>
        </div>
      </div>
      <div style={{ marginTop: "auto" }}><Signature /></div>
    </div>
  );
}
