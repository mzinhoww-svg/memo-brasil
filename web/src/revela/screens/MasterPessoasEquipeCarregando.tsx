/* Master-pessoas-equipe--carregando.html: estado "carregando" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasEquipeCarregando() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="equipe" variant="loading" counts={REF_COUNTS} /></MasterFrame>;
}
