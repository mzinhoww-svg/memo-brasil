"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/revela/master-kit";
import { AUDIT_ALL_EVENTS } from "@/revela/screens/MasterAuditoriaFiltros";
import { auditHref, type AuditCategory } from "@/lib/master/audit";

/** Campo "Evento" (`.mfield`): escreva e escolha um evento da lista; "Todos os eventos" limpa o filtro. A lista vem do servidor (eventos com registro na trilha). */
export function AuditEventFilter({ events, selected, cat }: { events: { id: string; title: string }[]; selected: string | null; cat: AuditCategory }) {
  const router = useRouter();
  const list = useId();
  const current = events.find((e) => e.id === selected)?.title ?? AUDIT_ALL_EVENTS;
  const [value, setValue] = useState(current);
  const go = (text: string) => {
    setValue(text);
    const hit = events.find((e) => e.title === text);
    if (text === AUDIT_ALL_EVENTS || text === "") { if (selected) router.push(auditHref({ cat })); return; }
    if (hit && hit.id !== selected) router.push(auditHref({ cat, evento: hit.id }));
  };
  return (
    <label className="mfield" style={{ width: "100%", maxWidth: "260px" }}>
      <i>Evento</i>
      <input value={value} list={list} aria-label="Filtrar por evento" onFocus={(e) => e.currentTarget.select()} onChange={(e) => go(e.target.value)} onBlur={() => setValue(current)} />
      <datalist id={list}>
        <option value={AUDIT_ALL_EVENTS} />
        {events.map((e) => <option key={e.id} value={e.title} />)}
      </datalist>
      <Ico n="chevron" />
    </label>
  );
}
