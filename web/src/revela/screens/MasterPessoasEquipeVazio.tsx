/* Master-pessoas-equipe--vazio.html: estado "vazio" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasEquipeVazio() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="equipe" variant="empty" counts={REF_COUNTS} /></MasterFrame>;
}
