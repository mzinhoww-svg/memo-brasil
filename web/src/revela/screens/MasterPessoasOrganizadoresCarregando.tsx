/* Master-pessoas-organizadores--carregando.html: estado "carregando" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasOrganizadoresCarregando() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="organizadores" variant="loading" counts={REF_COUNTS} /></MasterFrame>;
}
