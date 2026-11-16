"use client";

import { useParams } from "next/navigation";
import { Gallery } from "@/features/revelados/Gallery";

/** 18 · galeria de um evento revelado específico. */
export default function ReveladosEvento() {
  const { id } = useParams<{ id: string }>();
  return <Gallery id={id} />;
}
