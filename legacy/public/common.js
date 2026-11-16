// Utilitários compartilhados entre as páginas.
const eventId = () => location.pathname.split('/').filter(Boolean)[1];
const $ = (s) => document.querySelector(s);

async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || 'Algo deu errado.');
  return data;
}

// Imagem que exige credencial: o token vai no cabeçalho, nunca na URL (log,
// histórico e Referer não devem guardar a credencial). Devolve um object URL.
async function imgAutenticada(url, headers) {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  } catch { return null; }
}

function duracao(ms) {
  if (ms <= 0) return '0m';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(mi).padStart(2, '0')}m`;
  return `${mi}m`;
}

// Corrige a diferença de relógio entre o aparelho e o servidor.
function relogio(agoraServidor) {
  const delta = new Date(agoraServidor).getTime() - Date.now();
  return () => Date.now() + delta;
}

const guestKey = (id) => `memo:${id}:guest`;
const getGuest = (id) => { try { return JSON.parse(localStorage.getItem(guestKey(id))); } catch { return null; } };
const setGuest = (id, g) => localStorage.setItem(guestKey(id), JSON.stringify(g));
// Cabeçalho de autenticação do convidado: o id sozinho não basta, vai o token junto.
const guestHdr = (id) => { const g = getGuest(id); return g && g.guestToken ? { 'x-guest-token': g.guestToken } : {}; };
const hostKey = (id) => `memo:${id}:host`;

// Trilha de navegação: crumbs([{t:'Início', href:'/'}, {t:'Câmera'}])
function crumbs(items, el = $('#crumbs')) {
  if (!el) return;
  el.textContent = '';
  el.setAttribute('aria-label', 'Você está em');
  items.forEach((it, i) => {
    if (i) { const s = document.createElement('span'); s.textContent = '›'; s.className = 'sep'; s.setAttribute('aria-hidden', 'true'); el.append(s); }
    const n = document.createElement(it.href ? 'a' : 'span');
    n.textContent = it.t;
    if (it.href) n.href = it.href; else n.setAttribute('aria-current', 'page');
    el.append(n);
  });
}

// Páginas do convidado: carrega o evento e exige que a pessoa tenha entrado.
// A reentrada pelo mesmo aparelho (localStorage) recupera a sessão e o saldo de fotos.
async function reentrarConvidado(id, guest) {
  try {
    return await api(`/api/events/${id}/sessao`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...guestHdr(id) },
      body: JSON.stringify({ guestId: guest.guestId }),
    });
  } catch { return null; }
}

async function carregaConvidado() {
  const id = eventId();
  const guest = getGuest(id);
  if (!guest || !guest.guestToken) { location.replace(`/e/${id}`); return new Promise(() => {}); }
  prepararPwa(id);
  let info;
  try { info = await api(`/api/events/${id}`); }
  catch { location.replace(`/e/${id}`); return new Promise(() => {}); }
  const sessao = await reentrarConvidado(id, guest);
  if (!sessao) { localStorage.removeItem(guestKey(id)); location.replace(`/e/${id}`); return new Promise(() => {}); }
  return { id, guest, info, sessao };
}
const dataBr = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

// ── PWA e push (jornada do convidado)
function prepararPwa(id) {
  if (!document.querySelector('link[rel=manifest]')) {
    const m = document.createElement('link'); m.rel = 'manifest'; m.href = `/e/${id}/manifest.webmanifest`; document.head.append(m);
    const t = document.createElement('meta'); t.name = 'theme-color'; t.content = '#14110E'; document.head.append(t);
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = '/icons/apple-touch-icon.png'; document.head.append(a);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}
let _promptInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _promptInstalar = e; window.dispatchEvent(new Event('memo:podeinstalar')); });
const ehPwa = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ehIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
async function instalarPwa() { if (!_promptInstalar) return false; _promptInstalar.prompt(); const r = await _promptInstalar.userChoice; _promptInstalar = null; return r.outcome === 'accepted'; }
const urlB64 = (b) => Uint8Array.from(atob((b + '='.repeat((4 - b.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function pushDisponivel() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
async function ativarPush(id, guestId) {
  if (!(await pushDisponivel())) throw new Error('Este aparelho não suporta notificações. No iPhone, instale o app na Tela de Início primeiro.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão negada. Você pode liberar nas configurações do navegador.');
  const reg = await navigator.serviceWorker.ready;
  const cfg = await api('/api/config');
  if (!cfg.pushAtivo) throw new Error('As notificações estão desativadas no momento.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(cfg.vapidPublicKey) });
  await api(`/api/events/${id}/push/subscribe`, { method: 'POST', headers: { 'content-type': 'application/json', ...guestHdr(id) }, body: JSON.stringify({ guestId, subscription: sub.toJSON() }) });
  localStorage.setItem(`memo:${id}:push`, '1');
}
