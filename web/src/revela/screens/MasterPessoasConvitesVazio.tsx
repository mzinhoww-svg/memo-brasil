/* Master-pessoas-convites--vazio.html: estado "vazio" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvitesVazio() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convites" variant="empty" counts={REF_COUNTS} /></MasterFrame>;
}
