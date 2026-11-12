import { Skeleton } from "@/components/revela/Skeleton";

/** Esqueleto enquanto a seção chega (estas seções usam a casca antiga do painel, com menu lateral). */
export default function Loading() {
  return <Skeleton label="Abrindo o painel…" />;
}
