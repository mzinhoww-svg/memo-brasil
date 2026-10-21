/* eslint-disable @next/next/no-img-element -- fotos locais vêm de blob URLs; next/image não se aplica */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/features/app/provider";
import { Button, Icon, Progress, Signature } from "@/components/memoriesmt";
import { isRevealed, shotsLeft } from "@/domain/event";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";

export default function Voce() {
  const { event, user, now, photos, isHost } = useGuest();
  const { signOut } = useApp();
  const router = useRouter();
  const mine = photos.filter((p) => p.authorId === user.id && p.status !== "removida");
  const urls = usePhotoUrls(mine);
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
                <span className="app-thumb-badge">{p.status === "oculta" ? "Oculta" : revealed ? "Publicada" : "Só você"}</span>
              </div>
            ))}
          </div>
        )}
        {mine.length > 0 && !revealed && event.everyoneSeesAll && <p className="app-p app-muted meta">Só você vê suas fotos por enquanto. Os outros veem quando as fotos forem reveladas.</p>}
      </section>

      <div className="app-stack-sm">
        {isHost && <Button href={`/painel/${event.id}`} variant="secundario" block>Abrir o painel do evento</Button>}
        <Link href="/" className="mm-btn mm-btn--texto" style={{ alignSelf: "flex-start" }}>Voltar ao início</Link>
        <div className="app-stack-sm">
          <Button variant="secundario" block onClick={async () => { await signOut(); router.push(`/e/${event.code}`); }}>Entrar como outra pessoa</Button>
          <p className="mm-field-ajuda">Demonstração: serve para testar a festa com mais de uma pessoa neste aparelho. Suas fotos continuam guardadas.</p>
        </div>
      </div>
      <div style={{ marginTop: "auto" }}><Signature /></div>
    </div>
  );
}
