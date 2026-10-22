"use client";

import { useEffect, useState } from "react";
import { getPublicSettings, listPublicPlans } from "@/features/billing/api";
import type { PublicPlan, PublicSettings } from "@/features/billing/types";

export type PublicCatalog = { plans: PublicPlan[] | null; settings: PublicSettings | null; failed: boolean };

/** Catálogo público (planos + configurações) para páginas de marketing. Falha vira `failed` e as telas usam o fallback. */
export function usePublicCatalog(): PublicCatalog {
  const [state, setState] = useState<PublicCatalog>({ plans: null, settings: null, failed: false });
  useEffect(() => {
    let alive = true;
    void Promise.all([listPublicPlans(), getPublicSettings()]).then(
      ([plans, settings]) => { if (alive) setState({ plans, settings, failed: false }); },
      () => { if (alive) setState({ plans: null, settings: null, failed: true }); },
    );
    return () => { alive = false; };
  }, []);
  return state;
}
