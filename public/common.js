// Utilitários compartilhados entre as páginas.
const eventId = () => location.pathname.split('/').filter(Boolean)[1];
const $ = (s) => document.querySelector(s);

async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || 'Algo deu errado.');
  return data;
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
const hostKey = (id) => `memo:${id}:host`;
