/* Master-pessoas-convites--carregando.html: estado "carregando" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvitesCarregando() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convites" variant="loading" counts={REF_COUNTS} /></MasterFrame>;
}
