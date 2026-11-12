import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Revelacoes from '@/app/master/revelacoes/page';
const m = vi.hoisted(() => ({rpc:vi.fn()}));
vi.mock('@/app/master/data', () => ({requireMaster:async () => ({}), rpc:m.rpc, num:String, when:(v:string) => v ?? '—'}));
vi.mock('@/app/master/revelacoes/RevealNow', () => ({RevealNow:() => null}));
beforeEach(() => {
 m.rpc.mockReset().mockImplementation(async (_sb, name, args) => {
  const all = Array.from({length:76}, (_,i) => ({userId:`u${i}`,displayName:`Pessoa ${i}`,name:`Pessoa ${i}`,eventTitle:`Evento ${i}`,provider:'google',email:`p${i}@test`,createdAt:'2026-01-01',joinedAt:'2026-01-01',eventsCount:1,activeEvents:0,photos:0,state:'ativo',uses:0,label:`Convite ${i}`}));
  if (name === 'admin_reveals_board') return {state:'ok',data:{items:[{id:'e1',title:'Pendência antiga',revealAt:'2026-01-01T12:00:00Z',revealedAt:null,photos:3,emailOptIns:2,emailsSent:0,emailsFailed:0,emailsQueued:0}]}};
  return {state:'ok',data:{total:76,items:all.slice(args.p_offset,args.p_offset+args.p_limit)}};
 });
});
it('revelações lista as pendentes primeiro (o servidor ordena) e marca a que passou do horário como atrasada', async () => {
 render(await Revelacoes());
 expect(m.rpc).toHaveBeenCalledWith({},'admin_reveals_board',expect.objectContaining({p_limit:100}));
 expect(screen.getByText('Pendência antiga')).toBeInTheDocument();
 expect(screen.getByText('Atrasada')).toBeInTheDocument();
 expect(screen.getByText('2 e-mails')).toBeInTheDocument();
});
