/* Master-pessoas-contas--erro.html: estado "erro" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasContasErro() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="contas" variant="error" counts={REF_COUNTS} /></MasterFrame>;
}
