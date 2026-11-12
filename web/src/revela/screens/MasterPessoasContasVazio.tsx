/* Master-pessoas-contas--vazio.html: estado "vazio" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasContasVazio() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="contas" variant="empty" counts={REF_COUNTS} /></MasterFrame>;
}
