"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useApp } from "@/features/app/provider";
import { seedDemoEvent } from "@/features/demo/seed";

function Run() {
  const { repos, ready, user, signIn, now } = useApp();
  const router = useRouter();
  const reveal = useSearchParams().get("reveal") === "pendente" ? "pendente" : "desativada";
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void (async () => {
      const u = user ?? (await signIn("Emy"));
      const e = await seedDemoEvent(repos, u, now(), { reveal });
      router.replace(`/e/${e.code}/agora`);
    })();
  }, [ready, repos, user, signIn, now, reveal, router]);
  return <main className="app-col"><p className="app-screen app-muted" role="status">Preparando a festa de homologação…</p></main>;
}

export function Seeder() {
  return <Suspense fallback={null}><Run /></Suspense>;
}
