import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";
import { SCREENS } from "@/revela/registry";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DevRevela() {
  if (!devToolsEnabled() || process.env.VERCEL_ENV === "production") notFound();
  return (
    <main style={{ padding: 24 }}>
      <h1 className="rv-title-lg">Telas de referência</h1>
      <ul>{SCREENS.map((s) => <li key={s.id}><Link href={`/dev/revela/${s.html}`}>{s.id} · {s.title}</Link></li>)}</ul>
    </main>
  );
}
