/* Master-pessoas-convites--sem-permissao.html: estado "sem permissao" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvitesSemPermissao() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convites" variant="denied" counts={REF_COUNTS} /></MasterFrame>;
}
