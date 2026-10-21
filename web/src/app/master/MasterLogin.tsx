"use client";

import { Button } from "@/components/memoriesmt";
import { useApp } from "@/features/app/provider";

export function MasterLogin() {
  const { signInWithGoogle } = useApp();
  return <Button variant="primario" onClick={() => void signInWithGoogle("/master")}>Entrar com Google</Button>;
}
