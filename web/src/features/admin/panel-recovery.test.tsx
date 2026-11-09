import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Convite from '@/app/e/[code]/page';
import GuestLayout from '@/app/e/[code]/(app)/layout';
import PainelLayout from '@/app/painel/[id]/layout';
import Downloads from '@/app/painel/[id]/downloads/page';
import Configuracoes from '@/app/painel/[id]/configuracoes/page';
const m = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), signIn: vi.fn(), join: vi.fn(), zip: vi.fn(), download: vi.fn(), error: undefined as string | undefined, access: 'convite' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ code: 'ABCDEFGH', id: 'event' }), usePathname: () => '/e/ABCDEFGH/agora', useRouter: () => ({ push: m.push, replace: vi.fn() }) }));
vi.mock('@/features/app/provider', () => ({ useApp: () => ({ ready: true, user: null, signIn: m.signIn, repos: {}, now: () => 0, backend: 'local', ensureSession: async () => {}, authority: {}, scheduler: {}, canCreate: true }) }));
vi.mock('@/features/app/hooks', () => ({ useEventData: () => ({ loading: false, error: m.error, access: m.error ? 'inexistente' : m.access, preview: m.error || m.access === 'inexistente' ? undefined : { title: 'Festa', hostName: 'Ana', startAt: 100, status: 'ativo', timezone: 'UTC', revealStatus: 'desativada' }, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 }, refresh: m.refresh }), useClock: () => ({ now: 0, sync: vi.fn() }), useOnline: () => true, formatDate: () => '01/01', formatTime: () => '01h00', isUuid: () => true }));
vi.mock('@/features/studio/useBrandImages', () => ({ useBrandImages: () => ({}) }));
vi.mock('@/features/participants/service', () => ({ joinEvent: m.join }));
vi.mock('@/features/admin/export', () => ({ zipAlbum: m.zip, download: m.download, guestsCsv: vi.fn() }));
vi.mock('@/features/admin/context', () => ({ useAdmin: () => ({ event: { id: 'e', title:'Festa',hostName:'Ana',startAt:0,durationHours:3,revealEnabled:true,revealAt:10_800_000,revealAnchor:'fim',revealOffsetDays:0,timezone:'UTC',everyoneSeesAll:false,capacity:null,shotsPerPerson:null }, now:0,participants:[], photos: [{ status: 'visivel' }] }), AdminProvider: ({ children }: {children: React.ReactNode}) => children }));
vi.mock('@/features/admin/PlanInfo', () => ({usePlanInfo:() => ({loaded:false,plans:[]})}));
vi.mock('@/features/events/RevealSettings', () => ({RevealSettings:() => null}));
vi.mock('@/features/app/backend-notice', () => ({ BackendNotice: () => null }));
beforeEach(() => { vi.clearAllMocks(); m.error = undefined; m.access = 'convite'; m.signIn.mockResolvedValue({ id: 'u' }); m.join.mockResolvedValue({ ok: true }); });
/** 20b → 20d: nome e e-mail no formulário; os aceites ficam no diálogo "Antes de fotografar". */
const nome = () => screen.getByLabelText('Seu nome');
const entrar = () => fireEvent.click(screen.getByRole('button', { name: /Entrar e fotografar/ }));
function aceitar() {
 const d = screen.getByRole('dialog');
 for (const box of within(d).getAllByRole('checkbox')) fireEvent.click(box);
 fireEvent.click(within(d).getByRole('button', { name: 'Aceitar' }));
}
it('nome em branco pode ser corrigido sem iniciar sessão e mantém os aceites', async () => {
 render(<Convite />);
 fireEvent.change(nome(), { target: { value: '   ' } });
 entrar();
 expect(m.signIn).not.toHaveBeenCalled();
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(nome()).toHaveAttribute('aria-invalid', 'true');
 fireEvent.change(nome(), { target: { value: ' Ana ' } });
 entrar();
 aceitar();
 await waitFor(() => expect(m.push).toHaveBeenCalledWith('/e/ABCDEFGH/postar'));
 expect(m.signIn).toHaveBeenCalledWith('Ana');
});
it('sem os dois aceites o diálogo não deixa entrar', async () => {
 render(<Convite />);
 fireEvent.change(nome(), { target: { value: 'Ana' } });
 entrar();
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aceitar' }));
 expect(screen.getByRole('alert')).toHaveTextContent(/Aceite os Termos/);
 expect(m.signIn).not.toHaveBeenCalled();
});
it.each([GuestLayout, PainelLayout])('leitura inicial de rede oferece repetir sem alegar código/evento inexistente', async (Layout) => {
 m.error = 'unavailable'; render(<Layout>conteúdo</Layout>);
 expect(screen.queryByText(/Código não confere|Não achamos este evento/)).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
 expect(m.refresh).toHaveBeenCalled();
});
it('falha ao preparar ZIP libera nova tentativa', async () => {
 m.zip.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ saved: 1, missing: 0, blob: new Blob(), filename: 'a.zip' });
 render(<Downloads />); fireEvent.click(screen.getByRole('button', { name: 'Baixar o álbum (ZIP)' }));
 await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar o álbum (ZIP)' })).toBeEnabled());
 expect(screen.getByRole('alert')).toHaveTextContent(/Tente de novo/);
 fireEvent.click(screen.getByRole('button', { name: 'Baixar o álbum (ZIP)' }));
 await waitFor(() => expect(m.download).toHaveBeenCalled());
});

it.each(['session', 'join'])('falha de rede em %s mantém nome e aceites e permite repetir', async (step) => {
 if (step === 'session') m.signIn.mockRejectedValueOnce(new Error('rede'));
 else m.join.mockRejectedValueOnce(new Error('rede'));
 render(<Convite />);
 fireEvent.change(nome(), {target:{value:'Ana'}});
 entrar();
 aceitar();
 await screen.findByText(/Sem conexão agora/);
 expect(nome()).toHaveValue('Ana');
 entrar(); // os aceites continuam valendo: não pergunta de novo
 expect(screen.queryByRole('dialog')).toBeNull();
 await waitFor(() => expect(m.push).toHaveBeenCalledWith('/e/ABCDEFGH/postar'));
});
it('bloqueio de participação explica o impedimento sem alegar sucesso', async () => {
 m.join.mockResolvedValueOnce({ok:false,reason:'bloqueado'});
 render(<Convite />);
 fireEvent.change(nome(),{target:{value:'Ana'}});
 entrar();
 aceitar();
 await screen.findByText(/participação foi bloqueada pelo anfitrião/);
 expect(m.push).not.toHaveBeenCalled();
});
it.each([GuestLayout, PainelLayout])('negação de acesso não é descrita como erro de rede ou inexistente', async (Layout) => {
 m.error = 'forbidden'; render(<Layout>conteúdo</Layout>);
 expect(screen.getByText('Não foi possível confirmar seu acesso.')).toBeInTheDocument();
 expect(screen.queryByText(/Código não confere|Não achamos este evento/)).toBeNull();
});
it.each([GuestLayout, PainelLayout])('ausência confirmada apresenta evento não encontrado', async (Layout) => {
 m.access = 'inexistente'; render(<Layout>conteúdo</Layout>);
 expect(screen.getByText(/Código não confere|Não achamos este evento/)).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Tentar de novo'})).toBeNull();
});
it('ZIP parcial informa incluídas e ausentes; todas ausentes não vira álbum vazio', async () => {
 m.zip.mockResolvedValueOnce({saved:0,missing:2});
 render(<Downloads />);
 fireEvent.click(screen.getByRole('button',{name:'Baixar o álbum (ZIP)'}));
 await screen.findByText(/Nenhuma foto pôde ser incluída; 2 ausentes/);
 expect(m.download).not.toHaveBeenCalled();
});

it('Encerrar agora apresenta consequência real antes de qualquer mutação e foca Cancelar', () => {
 render(<Configuracoes />);
 fireEvent.click(screen.getByRole('button',{name:'Encerrar agora'}));
 expect(screen.getByRole('dialog')).toHaveTextContent(/Ninguém posta mais.*fotos serão reveladas agora.*autor e o anfitrião/);
 expect(screen.getByRole('button',{name:'Cancelar'})).toHaveFocus();
});
it('mudar o fim mostra prévia de revelação antes da confirmação', () => {
 render(<Configuracoes />);
 fireEvent.click(screen.getByRole('button',{name:'1 hora'}));
 expect(screen.getByRole('dialog')).toHaveTextContent(/fotos serão reveladas em.*01h00.*UTC/);
 expect(screen.getByRole('button',{name:'Cancelar'})).toHaveFocus();
});
