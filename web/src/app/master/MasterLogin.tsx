"use client";

import { GoogleButton } from "@/components/revela";
import { useApp } from "@/features/app/provider";

export function MasterLogin() {
  const { signInWithGoogle } = useApp();
  return <GoogleButton onClick={() => void signInWithGoogle("/master")} />;
}
