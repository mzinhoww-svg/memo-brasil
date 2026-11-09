import { redirect } from "next/navigation";

/** A aba Explorar saiu do desenho (Feed / Minhas / Você): quem chegar por um link antigo cai no Feed. */
export default async function Explorar({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/e/${code}/agora`);
}
