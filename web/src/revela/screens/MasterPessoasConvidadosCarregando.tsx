/* Master-pessoas-convidados--carregando.html: estado "carregando" da aba, com os dados do desenho. */
import { MasterFrame } from "../master-kit";
import { PessoasStatePage, REF_COUNTS } from "./MasterPessoasKit";

export function MasterPessoasConvidadosCarregando() {
  return <MasterFrame current="pessoas"><PessoasStatePage aba="convidados" variant="loading" counts={REF_COUNTS} /></MasterFrame>;
}
