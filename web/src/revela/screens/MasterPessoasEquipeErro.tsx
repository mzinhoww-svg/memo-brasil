/* Master-pessoas-equipe--erro.html: estado "erro" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasEquipeErro() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="equipe" variant="error" counts={REF_COUNTS} /></MasterFrame>;
}
