import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Usuarios from '@/app/master/usuarios/page';
import Organizadores from '@/app/master/organizadores/page';
import Participantes from '@/app/master/participantes/page';
import Revelacoes from '@/app/master/revelacoes/page';
const m = vi.hoisted(() => ({rpc:vi.fn()}));
vi.mock('@/app/master/data', () => ({requireMaster:async () => ({}), rpc:m.rpc, num:String, when:(v:string) => v ?? '—'}));
beforeEach(() => {
 m.rpc.mockReset().mockImplementation(async (_sb, name, args) => {
  const all = Array.from({length:76}, (_,i) => ({userId:`u${i}`,displayName:`Pessoa ${i}`,name:`Pessoa ${i}`,eventTitle:`Evento ${i}`,provider:'google',email:`p${i}@test`,createdAt:'2026-01-01',joinedAt:'2026-01-01',eventsCount:1,activeEvents:0,photos:0,state:'ativo',uses:0,label:`Convite ${i}`}));
  if (name === 'admin_list_reveals') return {state:'ok',data:{total:1,items:[{title:'Pendência antiga',hostName:'Ana',revealState:'atrasada',revealAt:'2026-01-01'}]}};
  return {state:'ok',data:{total:76,items:all.slice(args.p_offset,args.p_offset+args.p_limit)}};
 });
});
it.each([['usuários',Usuarios,'admin_search_users'],['organizadores',Organizadores,'admin_list_organizers']])('%s acessa registros após os primeiros 50 mantendo busca', async (_label, Page, rpcName) => {
 render(await Page({searchParams:Promise.resolve({p:'3',q:'Pessoa'})}));
 expect(m.rpc).toHaveBeenCalledWith({},rpcName,expect.objectContaining({p_offset:50,p_limit:25,p_search:'Pessoa'}));
 expect(screen.getByText(/Página 3 de 4/)).toBeInTheDocument();
 expect(screen.getByRole('link',{name:/Próxima/})).toHaveAttribute('href',expect.stringContaining('p=4'));
});
it('participantes e convites têm paginação independente e busca no servidor', async () => {
 render(await Participantes({searchParams:Promise.resolve({p:'3',i:'2',q:'Pessoa'})}));
 expect(m.rpc).toHaveBeenCalledWith({},'admin_search_participants',expect.objectContaining({p_offset:50,p_search:'Pessoa'}));
 expect(m.rpc).toHaveBeenCalledWith({},'admin_search_invites',expect.objectContaining({p_offset:25,p_search:'Pessoa'}));
 expect(screen.getByText('Pessoa 50')).toBeInTheDocument();
});
it('revelações consulta pendências antes do limite em vez de filtrar primeira página geral', async () => {
 render(await Revelacoes({searchParams:Promise.resolve({})}));
 expect(m.rpc).toHaveBeenCalledWith({},'admin_list_reveals',expect.objectContaining({p_limit:25,p_offset:0}));
 expect(screen.getByText('Pendência antiga')).toBeInTheDocument();
});
