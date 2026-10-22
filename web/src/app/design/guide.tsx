"use client";

import { useState } from "react";
import {
  AdminNav, Button, Chip, Chips, Cover, CountBadge, DataList, EventHeader, EventTheme, Field, Icon, LiveIndicator, Logo, Notice, OptionGroup, PostCard,
  Progress, Signature, StatGrid, StatTile, Stepper, TabBar, TableCard, Tabs, ThemeToggle, VisionGrid, VisionTile, panelId, tabId, type IconName,
} from "@/components/memoriesmt";
import { PALETTES } from "@/lib/event-theme";
import type { PaletteId } from "@/domain/event";

const ICONS: IconName[] = ["camera", "agora", "explorar", "voce", "casal", "favoritos", "moderar", "baixar", "fechar", "sem-sinal", "mais"];
const TOKENS = ["fundo", "neutro", "tinta", "apoio", "borda", "divisor", "acao", "on-acao", "rec", "rec-texto", "desabilitado", "evento-superficie", "evento-grafismo", "evento-controle", "evento-texto", "evento-profundo"];
const QR = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#fff"/><path d="M0 0h3v3H0zM5 0h3v3H5zM0 5h3v3H0zM4 4h1v1H4zM6 5h2v1H6zM5 7h3v1H5z" fill="#1C1917"/></svg>');

/** Guia vivo dos componentes: serve de referência para a validação visual contra o kit. */
export function DesignGuide() {
  const [tab, setTab] = useState("a");
  const [opt, setOpt] = useState<number | null>(24);
  const [step, setStep] = useState(8);
  const [pal, setPal] = useState<PaletteId>("salvia");
  return (
    <main className="app-fluid" style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
      <header className="app-between"><h1 className="titulo-pagina app-h1">Guia de componentes</h1><ThemeToggle /></header>

      <section aria-labelledby="g-marca" className="app-stack">
        <h2 id="g-marca" className="titulo-card app-h1">Marca</h2>
        <Cover />
        <div className="app-row"><Logo variant="wordmark" size={160} /><Logo variant="selo" size={48} /><Logo variant="icone-app" size={64} /><Logo variant="icone-app-ao-vivo" size={64} /></div>
        <Signature />
      </section>

      <section aria-labelledby="g-cor" className="app-stack">
        <h2 id="g-cor" className="titulo-card app-h1">Cores</h2>
        <div className="app-row">
          {TOKENS.map((t) => (
            <div key={t} style={{ width: 96 }}>
              <div style={{ height: 48, borderRadius: "var(--radius-md)", background: `var(--${t})`, border: "1px solid var(--borda)" }} />
              <span className="meta">{t}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="g-tipo" className="app-stack-sm">
        <h2 id="g-tipo" className="titulo-card app-h1">Tipografia</h2>
        <p className="display app-h1">Display 40</p>
        <p className="titulo-tela app-h1">Título de tela 28</p>
        <p className="corpo app-p">Corpo 17. A festa vista por todo mundo.</p>
        <p className="eyebrow app-eyebrow">Eyebrow 12</p>
        <p className="emocao app-emocao">Sua visão entrou na história.</p>
        <EventTheme palette="salvia" font="birthstone"><p className="nome-evento app-h1" style={{ color: "var(--evento-profundo)" }}>Emy &amp; Igor</p></EventTheme>
      </section>

      <section aria-labelledby="g-btn" className="app-stack">
        <h2 id="g-btn" className="titulo-card app-h1">Botões</h2>
        <div className="app-row">
          <Button>Entrar na festa</Button><Button variant="secundario">Ver no Agora</Button><Button variant="pequeno">Salvar</Button><Button variant="secundario" small>Ver mais</Button><Button variant="texto">Agora não</Button><Button variant="destrutivo" small>Remover</Button><Button disabled>Postar</Button>
        </div>
        <Button variant="cta" icon="camera">Postar daqui</Button>
        <Button variant="cta-xl" icon="camera">Tirar foto</Button>
      </section>

      <section aria-labelledby="g-form" className="app-stack" style={{ maxWidth: 343 }}>
        <h2 id="g-form" className="titulo-card app-h1">Campos e opções</h2>
        <Field label="Como te chamam na festa?" defaultValue="Ana" help="Ao postar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento." />
        <Field label="Código da festa" code defaultValue="NFVARBQX" error="Código não confere. Confira no card da mesa." />
        <OptionGroup<number | null> label="Fotos por pessoa" value={opt} onChange={setOpt} options={[{ value: 10, label: "10" }, { value: 16, label: "16" }, { value: 24, label: "24" }, { value: null, label: "Ilimitadas" }]} />
        <Stepper label="Mesa" value={step} min={1} max={20} onChange={setStep} decrementLabel="Mesa anterior" incrementLabel="Próxima mesa" />
        <Chips label="Chips"><Chip pressed count={24}>Amei</Chip><Chip count={11}>Esse momento</Chip><Chip variant="filtro" pressed>{`Pôr do sol · 318`}</Chip><Chip variant="sugestao">Quem viu, viu.</Chip></Chips>
      </section>

      <section aria-labelledby="g-ev" className="app-stack">
        <h2 id="g-ev" className="titulo-card app-h1">Camada do evento</h2>
        <Chips label="Paleta">{(Object.keys(PALETTES) as PaletteId[]).map((p) => <Chip key={p} variant="filtro" pressed={pal === p} onClick={() => setPal(p)}>{PALETTES[p].label}</Chip>)}</Chips>
        <EventTheme palette={pal} font="birthstone">
          <div className="app-stack" style={{ maxWidth: 375 }}>
            <EventHeader meta="12 · 12 · 2026 · Chalés Taíba, CE" name="Emy & Igor" />
            <Notice text="Pôr do sol na areia em 10 minutos. Todo mundo para a praia." eyebrow="Aviso · cerimonial" />
            <LiveIndicator />
            <Progress label="Foto 2" status="62%" value={62} />
            <Progress variant="evento" label="Pôr do sol" status="318" value={77} />
            <VisionGrid><VisionTile name="Visão da Mesa 8" onSelect={() => undefined} /><VisionTile name="Visão do bar" onSelect={() => undefined} /></VisionGrid>
            <PostCard vision="Visão da Mesa 8" meta="Pôr do sol · há 2 min" avatar="M8" alt="Foto de exemplo" caption="Alguém precisava registrar isso." tag="Escolha dos noivos" reactions={<Chips label="Reações"><Chip pressed count={24}>Amei</Chip><Chip count={11}>Esse momento</Chip></Chips>} />
            <TableCard eyebrow="Mesa 08" qrSrc={QR} eventName="Emy & Igor" />
          </div>
        </EventTheme>
      </section>

      <section aria-labelledby="g-adm" className="app-stack">
        <h2 id="g-adm" className="titulo-card app-h1">Painel</h2>
        <Tabs base="g" label="Filas" value={tab} onChange={setTab} tabs={[{ id: "a", label: "Pedidos de remoção", count: 3 }, { id: "b", label: "Ocultas" }]} />
        <div role="tabpanel" id={panelId("g", tab)} aria-labelledby={tabId("g", tab)}><p className="app-p app-muted">{tab === "a" ? "Nenhum pedido de remoção em aberto." : "Nenhuma foto oculta."}</p></div>
        <StatGrid><StatTile value="1.284" label="fotos" /><StatTile value="112" label="convidados postaram" /><StatTile value="3.960" label="reações" /><StatTile value="18 de 20" label="mesas participando" /></StatGrid>
        <DataList head={["QR do evento", "Acessos"]} rows={[{ key: "a", name: "Convite digital", kind: "WhatsApp", value: "203" }, { key: "b", name: "Mesa 12", kind: "mesa", value: "12", alert: true }]} note="Mesa 12 participando menos. Vale um aviso." />
        <div className="app-row" style={{ alignItems: "flex-start" }}><AdminNav eventName="Emy e Igor" eventState="12.12.2026 · ao vivo" switchHref="/" items={[{ href: "#a", label: "Visão geral" }, { href: "#b", label: "Conteúdo", current: true, count: 3 }, { href: "#c", label: "Convidados" }]} /><CountBadge count={3} /></div>
      </section>

      <section aria-labelledby="g-ico" className="app-stack">
        <h2 id="g-ico" className="titulo-card app-h1">Ícones</h2>
        <div className="app-row">{ICONS.map((n) => <span key={n} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, width: 72 }}><Icon name={n} label={n} size={28} /><span className="meta">{n}</span></span>)}</div>
        <div style={{ maxWidth: 375 }}><TabBar cta={{ href: "#postar", label: "Postar daqui" }} items={[{ href: "#a", label: "Agora", icon: "agora", current: true }, { href: "#e", label: "Explorar", icon: "explorar" }, { href: "#v", label: "Você", icon: "voce" }]} /></div>
      </section>
    </main>
  );
}
