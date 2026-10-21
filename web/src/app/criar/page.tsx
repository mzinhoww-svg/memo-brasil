import type { Metadata } from "next";
import { CreateWizard } from "@/features/events/wizard";

export const metadata: Metadata = { title: "Criar evento" };

export default function Criar() {
  return (
    <main className="app-col app-col--card app-fluid">
      <CreateWizard />
    </main>
  );
}
