"use client";

import { GoogleButton } from "@/components/revela";
import { useApp } from "@/features/app/provider";

/** Ação de entrada do M00: o operador entra com a conta Google; o servidor concede o papel. */
export function MasterLoginAction() {
  const { signInWithGoogle } = useApp();
  return <GoogleButton onClick={() => void signInWithGoogle("/master")} />;
}
