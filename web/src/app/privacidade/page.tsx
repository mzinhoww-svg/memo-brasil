import type { Metadata } from "next";
import { LegalPage } from "@/features/consent/LegalPage";
import { PRIVACY_TEXT } from "@/lib/legal-text";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return <LegalPage title="Política de privacidade" kind="privacy" sections={PRIVACY_TEXT} />;
}
