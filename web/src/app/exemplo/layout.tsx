import type { Metadata } from "next";

export const metadata: Metadata = { title: "Festa de exemplo", robots: { index: false, follow: false } };

export default function ExemploLayout({ children }: { children: React.ReactNode }) {
  return children;
}
