/* Master-pessoas-organizadores--vazio.html: estado "vazio" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasOrganizadoresVazio() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="organizadores" variant="empty" counts={REF_COUNTS} /></MasterFrame>;
}
