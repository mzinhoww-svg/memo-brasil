import {fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import {ModeratePhoto} from "./moderacao/ModeratePhoto";
import {RetryEmails} from "./revelacoes/RetryEmails";
const m=vi.hoisted(()=>({rpc:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:m.refresh})}));
vi.mock("@/lib/supabase/client",()=>({browserSupabase:()=>({rpc:m.rpc})}));
beforeEach(()=>{m.rpc.mockReset();m.rpc.mockResolvedValue({error:null});m.refresh.mockClear();});
it.each(["Manter","Esconder","Remover"])("%s foto usa motivo e só chama a RPC de metadados",async action=>{
 render(<ModeratePhoto id="photo1" event="Festa"/>);fireEvent.click(screen.getByRole("button",{name:action}));
 const sheet=screen.getByRole("dialog");fireEvent.click(within(sheet).getByRole("button",{name:new RegExp(action+" a foto")}));
 expect(m.rpc).not.toHaveBeenCalled();fireEvent.change(within(sheet).getByLabelText(/Motivo/),{target:{value:"Solicitação documentada de moderação"}});
 fireEvent.click(within(sheet).getByRole("button",{name:new RegExp(action+" a foto")}));
 await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith("admin_master_moderate_photo",{p_photo:"photo1",p_action:action==="Manter"?"mostrar":action.toLowerCase(),p_reason:"Solicitação documentada de moderação"}));
 expect(m.rpc).toHaveBeenCalledTimes(1);await waitFor(()=>expect(m.refresh).toHaveBeenCalledOnce());
});
it("reenvia somente pela fila e mantém erro de permissão no Sheet",async()=>{
 m.rpc.mockResolvedValue({error:{code:"MM004",message:"forbidden"}});render(<RetryEmails event={{id:"e1",title:"Festa"}}/>);
 fireEvent.click(screen.getByRole("button",{name:"Reenviar falhas"}));const sheet=screen.getByRole("dialog");
 fireEvent.change(within(sheet).getByLabelText(/Motivo/),{target:{value:"Reprocessar falhas verificadas de envio"}});fireEvent.click(within(sheet).getByRole("button",{name:"Reenviar falhas"}));
 await waitFor(()=>expect(within(sheet).getByRole("alert")).toHaveTextContent("Sem permissão"));
 expect(m.rpc).toHaveBeenCalledWith("admin_master_retry_reveal_emails",{p_event:"e1",p_reason:"Reprocessar falhas verificadas de envio"});expect(m.refresh).not.toHaveBeenCalled();
});
