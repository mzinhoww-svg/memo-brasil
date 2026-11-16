/* Master-pessoas-contas--carregando.html: estado "carregando" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasContasCarregando() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="contas" variant="loading" counts={REF_COUNTS} /></MasterFrame>;
}
