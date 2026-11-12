/* Master-pessoas-organizadores--erro.html: estado "erro" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasOrganizadoresErro() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="organizadores" variant="error" counts={REF_COUNTS} /></MasterFrame>;
}
