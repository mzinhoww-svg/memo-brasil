"use client";
import { createContext, useContext } from "react";

/** Direção da última troca de passo do assistente ("next" ao avançar, "back" ao voltar); `undefined` no primeiro passo. */
export const WizardDirection = createContext<"next" | "back" | undefined>(undefined);
export const useWizardDirection = () => useContext(WizardDirection);
