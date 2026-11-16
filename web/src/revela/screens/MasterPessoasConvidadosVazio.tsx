/* Master-pessoas-convidados--vazio.html: estado "vazio" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvidadosVazio() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convidados" variant="empty" counts={REF_COUNTS} /></MasterFrame>;
}
