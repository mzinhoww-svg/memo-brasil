"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { Sheet } from "@/components/revela";
import { MNote } from "@/revela/master-kit";
import { MasterLgpdView, type LgpdRow, type RetencaoRow } from "@/revela/screens/MasterLgpd";
export function RetentionDetails({rows,retention,pager}:{rows:LgpdRow[];retention:RetencaoRow[];pager?:ReactNode}){
 const [selected,setSelected]=useState<RetencaoRow>();
 return <><MasterLgpdView rows={rows} retention={retention} pager={pager} onRetention={setSelected}/>{selected&&<Sheet title={selected.label} onClose={()=>setSelected(undefined)}><MNote>{selected.value}. Consulta da política vigente; esta tela não altera os prazos de retenção.</MNote></Sheet>}</>;
}
