/* Master-pessoas-convidados--erro.html: estado "erro" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvidadosErro() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convidados" variant="error" counts={REF_COUNTS} /></MasterFrame>;
}
