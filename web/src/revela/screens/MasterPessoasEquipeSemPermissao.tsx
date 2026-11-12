/* Master-pessoas-equipe--sem-permissao.html: estado "sem permissao" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasEquipeSemPermissao() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="equipe" variant="denied" counts={REF_COUNTS} /></MasterFrame>;
}
