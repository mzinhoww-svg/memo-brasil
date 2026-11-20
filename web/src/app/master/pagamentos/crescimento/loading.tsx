import { MasterStatePage } from "@/revela/master";

/** Skeleton da GF-01 durante busca da RPC; mantém a página responsiva. */
export default function Loading() {
  return <MasterStatePage area="Funil de crescimento" variant="loading" cols={5} rows={8} />;
}
