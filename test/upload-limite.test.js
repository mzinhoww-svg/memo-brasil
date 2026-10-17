// Limite por IP das tentativas inválidas de credencial no upload (rota pública).
// Arquivo próprio para nascer com um teto pequeno (GUEST_MAX_TENTATIVAS), sem
// afetar os outros arquivos (o runner isola cada arquivo em um processo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-limite-'));
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.GUEST_MAX_TENTATIVAS = '2';
process.env.GUEST_JANELA_MS = '60000'; // janela longa: não expira no teste
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
async function criar(titulo) {
  const r = await (await post('/api/events', { titulo, revealAt: new Date(Date.now() + 3600e3).toISOString(), fotosPorConvidado: 5 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, guest: g.guestId, gtoken: g.guestToken };
}
function enviar(ev, token) {
  const fd = new FormData();
  fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const headers = { 'x-guest-id': ev.guest };
  if (token) headers['x-guest-token'] = token;
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', headers, body: fd });
}

test('tentativas inválidas em sequência bloqueiam o IP com 429 e nada é gravado', async () => {
  const a = await criar('Limite de tentativas');
  assert.equal((await enviar(a, 'token-errado-1')).status, 403);
  assert.equal((await enviar(a, 'token-errado-2')).status, 403);
  // A partir do limite, o IP é bloqueado antes de autenticar — 429 até para válido.
  assert.equal((await enviar(a, 'token-errado-3')).status, 429);
  assert.equal((await enviar(a, a.gtoken)).status, 429);
  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 0);
});
