import type { Metadata } from "next";
import { LegalPage } from "@/features/consent/LegalPage";
import { TERMS_TEXT } from "@/lib/legal-text";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Termos() {
  return <LegalPage title="Termos de uso" kind="terms" sections={TERMS_TEXT} />;
}
