"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, RowsSkeleton } from "@/components/revela";
import { useApp } from "@/features/app/provider";
import { HostTabs } from "@/revela/HostTabs";
import { usePrintedAlbumEnabled } from "./flag";
import { cancelPrintOrder, listMyPrintOrders, printErrorText } from "./api";
import { orderSummary, PRODUCTS, STATUS_LABEL, type PrintOrder } from "./model";

const day = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Cuiaba" }).replace(".", "");

/** Você · Álbuns impressos: pedidos de impressão do anfitrião (os dele e os de convidados do evento) com o status. */
export function OrdersPage() {
  const { user, ready, now } = useApp();
  const printed = usePrintedAlbumEnabled();
  const [orders, setOrders] = useState<PrintOrder[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState<string | undefined>();
  const userId = user?.id;
  const load = useCallback(() => {
    if (!userId) return Promise.resolve();
    return listMyPrintOrders(userId).then((o) => { setOrders(o); setFailed(false); }, () => setFailed(true));
  }, [userId]);
  useEffect(() => {
    if (!ready || !userId) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [ready, userId, load]);

  async function cancel(o: PrintOrder) {
    if (!userId || !window.confirm("Cancelar este pedido?")) return;
    try { await cancelPrintOrder(userId, o.id, now()); setMsg(undefined); await load(); } catch (e) { setMsg(printErrorText(e)); }
  }

  // sem a chave `printed_album` a página não existe para o anfitrião
  if (printed === false) return <div className="scr"><div className="safe"><h1 className="rv-title-lg">Não achamos esta página.</h1><p className="rv-body muted" style={{ margin: "10px 0 16px" }}>Ela não existe ou não está disponível.</p><Link className="app-link" href="/eventos">Voltar aos eventos</Link></div><HostTabs current="voce" /><div className="home-ind" /><div className="grain" /></div>;
  return (
    <div className="scr">
      <div className="safe" style={{ paddingBottom: "92px" }}>
        <h1 className="rv-title-lg">Álbuns impressos</h1>
        <p className="rv-body muted" style={{ margin: "10px 0 16px" }}>Seus pedidos de impressão. O valor e o prazo chegam por contato, antes de qualquer pagamento.</p>
        {msg && <p className="rv-field-erro" role="alert">{msg}</p>}
        {!ready || (userId && !orders && !failed) ? <RowsSkeleton label="Carregando seus pedidos…" />
          : !userId ? <p className="rv-body muted">Entre para ver seus pedidos.</p>
          : failed ? <p className="rv-body muted" role="alert">Não deu para carregar. Confira a conexão e abra de novo.</p>
          : !orders?.length ? <p className="rv-body muted">Nenhum pedido ainda. Abra um evento revelado e escolha “O álbum da festa, em papel”.</p>
          : (
            <div className="rv-group" aria-label="Pedidos">
              {orders.map((o) => (
                <div className="rv-row" key={o.id} data-testid="print-order">
                  <div className="rv-row__text">
                    {PRODUCTS[o.product].label} · {o.eventTitle}
                    <span className="rv-row__meta">{orderSummary(o)} · {day(o.createdAt)}{o.mine ? "" : ` · pedido de ${o.contactName}`}</span>
                  </div>
                  <span className="rv-row__end">
                    {STATUS_LABEL[o.status]}
                    {o.status === "solicitado" && <Button variant="texto" small onClick={() => void cancel(o)}>Cancelar</Button>}
                  </span>
                </div>
              ))}
            </div>
          )}
        <div className="grow" />
        <Link href="/eventos/revelados" className="rv-btn rv-btn--block">Ver revelados</Link>
      </div>
      <HostTabs current="voce" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
  );
}
