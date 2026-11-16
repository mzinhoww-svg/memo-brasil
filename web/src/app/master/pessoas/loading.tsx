"use client";

import { useSearchParams } from "next/navigation";
import { parseAba } from "@/lib/master/people";
import { PessoasStatePage } from "@/revela/screens/MasterPessoasKit";

/** Estado "carregando" das cinco abas (M15.c a M19.c): o esqueleto da tabela da aba que está abrindo. */
export default function Loading() {
  const aba = parseAba(useSearchParams().get("aba") ?? undefined);
  return <PessoasStatePage aba={aba} variant="loading" live disabledActions />;
}
