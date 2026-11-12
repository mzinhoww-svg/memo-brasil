/* Master-pessoas-organizadores--sem-permissao.html: estado "sem permissao" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasOrganizadoresSemPermissao() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="organizadores" variant="denied" counts={REF_COUNTS} /></MasterFrame>;
}
