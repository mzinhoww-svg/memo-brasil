import type { Metadata } from "next";
import { PrecosView } from "@/features/marketing/PrecosView";

export const metadata: Metadata = { title: "Preços" };

export default function Precos() {
  return <main><PrecosView /></main>;
}
