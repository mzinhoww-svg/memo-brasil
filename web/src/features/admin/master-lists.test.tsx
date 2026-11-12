import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Usuarios from '@/app/master/usuarios/page';
import Organizadores from '@/app/master/organizadores/page';
import Participantes from '@/app/master/participantes/page';
import Storage from '@/app/master/storage/page';
import Analytics from '@/app/master/analytics/page';
import Pessoas from '@/app/master/pessoas/page';
import Revelacoes from '@/app/master/revelacoes/page';
const m=vi.hoisted(()=>({rpc:vi.fn(),access:vi.fn(),redirect:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(href:string)=>{m.redirect(href);throw new Error('redirect');}}));
vi.mock('@/app/master/data',()=>({requireMaster:async()=>{m.access();return{};},rpc:m.rpc,num:String,when:(v:string)=>v??'—'}));
vi.mock('@/app/master/ExportButton',()=>({ExportButton:()=>null}));
vi.mock('@/app/master/revelacoes/RevealNow',()=>({RevealNow:()=>null}));
beforeEach(()=>{m.rpc.mockReset();m.access.mockClear();m.redirect.mockClear();m.rpc.mockImplementation(async(_sb,name,args)=>name==='admin_master_list'&&args?.p_kind==='revelacoes'?{state:'ok',data:{total:1,items:[{id:'e1',title:'Pendência antiga',revealAt:'2026-01-01T12:00:00Z',revealedAt:null,photos:3,emailOptIns:2,emailsSent:0,emailsFailed:0,emailsQueued:0}]}}:{state:'ok',data:{total:76,organizersTotal:76,guestsTotal:76,teamTotal:76,items:[{userId:'u50',displayName:'Pessoa 50',name:'Pessoa 50',email:'p@test',createdAt:'2026-01-01',firstEventAt:'2026-01-01',provider:'google',eventsCount:1,spentCents:1452900}]}});});
it.each([[Usuarios,'/master/pessoas?aba=equipe'],[Organizadores,'/master/pessoas?aba=organizadores'],[Participantes,'/master/pessoas?aba=convidados'],[Storage,'/master/saude'],[Analytics,'/master']])('rota antiga revalida acesso antes de redirecionar',async(Page,href)=>{await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow('redirect');expect(m.access).toHaveBeenCalledOnce();expect(m.redirect).toHaveBeenCalledWith(href);expect(m.rpc).not.toHaveBeenCalled();});
it.each(['organizadores','convidados','equipe'])('%s busca e pagina antes do recorte de 25',async aba=>{render(await Pessoas({searchParams:Promise.resolve({aba,p:'3',q:'Pessoa'})}));expect(m.rpc).toHaveBeenCalledWith({},'admin_master_people',{p_tab:aba,p_limit:25,p_offset:50,p_search:'Pessoa'});expect(screen.getByText(/Página 3 de 4/)).toBeVisible();expect(screen.getByRole('link',{name:/Próxima/})).toHaveAttribute('href',expect.stringContaining('p=4'));});
it('MM004 não vira lista vazia',async()=>{m.rpc.mockResolvedValue({state:'denied'});render(await Pessoas({searchParams:Promise.resolve({})}));expect(screen.getByText('Sem permissão para ver estes dados.')).toBeVisible();});
it('usa gasto agregado e chevron do desenho sem recorte de pagamentos no cliente',async()=>{render(await Pessoas({searchParams:Promise.resolve({})}));expect(screen.getByText(/14.529/)).toBeVisible();expect(screen.getByRole('link',{name:'Ver eventos de Pessoa 50'})).toHaveAttribute('href','/master/eventos?q=Pessoa%2050');expect(m.rpc).toHaveBeenCalledTimes(1);});
it('revelações lista as pendentes primeiro (o servidor ordena) e marca a que passou do horário como atrasada', async () => {
 render(await Revelacoes({}));
 expect(m.rpc).toHaveBeenCalledWith({},'admin_master_list',{p_kind:'revelacoes',p_offset:0,p_search:null});
 expect(screen.getByText('Pendência antiga')).toBeInTheDocument();
 expect(screen.getByText('Atrasada')).toBeInTheDocument();
 expect(screen.getByText('2 e-mails')).toBeInTheDocument();
});

it.each([Usuarios,Organizadores,Participantes])('redireciona preservando busca e página sem inventar aba de convites',async Page=>{await expect(Page({searchParams:Promise.resolve({q:'Pessoa & Ana',p:'3',i:'4'} as {q:string;p:string})})).rejects.toThrow('redirect');const href=m.redirect.mock.calls[0][0];expect(href).toContain('q=Pessoa+%26+Ana');expect(href).toContain('p=3');expect(href).not.toContain('i=');});
