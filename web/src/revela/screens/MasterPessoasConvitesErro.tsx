/* Master-pessoas-convites--erro.html: estado "erro" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvitesErro() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convites" variant="error" counts={REF_COUNTS} /></MasterFrame>;
}
