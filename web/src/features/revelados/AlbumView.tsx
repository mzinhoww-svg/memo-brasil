"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useEventData, usePhotoUrls } from "@/features/app/hooks";
import { pickGallery } from "./pick";
import { ReveladosAlbum } from "@/revela/screens/ReveladosAlbum";
import { useApp } from "@/features/app/provider";
import { listMyPrintOrders } from "@/features/print-orders/api";
import { PrintOrderSheet } from "@/features/print-orders/PrintOrderSheet";
import type { PrintOrder } from "@/features/print-orders/model";
import { GoHome, HostNote, LoadingNote } from "./use-revealed";

/** "14 · 03 · 2027" no fuso do evento. */
export function albumDate(ts: number, tz = "America/Cuiaba"): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(ts))) p[x.type] = x.value;
  return `${p.day} · ${p.month} · ${p.year}`;
}

/** 19b · Álbum impresso: a oferta do álbum em papel com as fotos do evento. */
export function AlbumView({ id }: { id: string }) {
  const data = useEventData({ id });
  const { event, photos, reactions } = data;
  const ready = useMemo(() => photos.filter((p) => p.status !== "removida" && p.uploadStatus === "pronta"), [photos]);
  const picks = useMemo(() => pickGallery(ready, reactions, { n: 2 }), [ready, reactions]);
  const urls = usePhotoUrls(picks);
  const { user } = useApp();
  const [choosing, setChoosing] = useState(false);
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    listMyPrintOrders(userId, id).then((o) => { if (live) setOrders(o); }, () => undefined);
    return () => { live = false; };
  }, [userId, id]);
  const choices = useMemo(() => pickGallery(ready, reactions, { n: 120 }), [ready, reactions]);
  const choiceUrls = usePhotoUrls(choosing ? choices : [], "thumb");
  if (data.loading) return <LoadingNote />;
  if (!event || data.access !== "organizador") return <HostNote title="Não achamos este álbum." text="Ele não existe ou não é de um evento seu." action={<GoHome />} />;
  const chosen = ready.filter((p) => p.highlighted).length || Math.min(60, ready.length);
  const covers = picks.map((p) => urls[p.id]).filter(Boolean);
  const open = orders.filter((o) => o.status !== "cancelado").length;
  return (
    <>
    <ReveladosAlbum
      title={event.title} date={albumDate(event.startAt, event.timezone)}
      covers={covers.length >= 2 ? [covers[0], covers[1]] : undefined}
      lead={`${chosen} ${chosen === 1 ? "foto escolhida" : "fotos escolhidas"} por você, capa dura de linho, entregue em casa.`}
      closeHref={`/eventos/revelados/${event.id}`} chooseHref={`/painel/${event.id}/conteudo`} onChoose={() => setChoosing(true)}
      extra={orders.length > 0 ? <p className="rv-caption center" style={{ marginTop: "6px" }}><Link href="/eventos/pedidos" className="app-link">{open === 1 ? "1 pedido seu" : `${open} pedidos seus`} · ver status</Link></p> : undefined}
    />
    {choosing && <PrintOrderSheet eventId={event.id} eventTitle={event.title} photos={choices} urls={choiceUrls} onClose={() => setChoosing(false)} onDone={(o) => setOrders((x) => [o, ...x])} />}
    </>
  );
}
