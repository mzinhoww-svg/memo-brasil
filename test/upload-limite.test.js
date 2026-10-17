// Limite das tentativas inválidas de credencial no upload (rota pública).
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
process.env.GUEST_MAX_TENTATIVAS = '5';
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
function enviar(ev, guestId, token) {
  const fd = new FormData();
  fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const headers = {};
  if (guestId) headers['x-guest-id'] = guestId;
  if (token) headers['x-guest-token'] = token;
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', headers, body: fd });
}

test('falhas de um convidado não bloqueiam os outros nem a credencial válida (mesmo IP)', async () => {
  const ev = await criar('Limite de tentativas');
  const bia = await (await post(`/api/events/${ev.id}/guests`, { nome: 'Bia' })).json();

  // 5 falhas do par (IP, evento, convidado) do Rafa com token errado: as 4
  // primeiras são 403, a que estoura o teto vira 429.
  const status = [];
  for (let i = 0; i < 5; i++) status.push((await enviar(ev, ev.guest, 'token-errado')).status);
  assert.deepEqual(status, [403, 403, 403, 403, 429]);

  // Outro convidado no MESMO IP continua entrando (chave diferente): 201.
  assert.equal((await enviar(ev, bia.guestId, bia.guestToken)).status, 201);

  // E a credencial VÁLIDA do próprio Rafa também passa: autenticamos antes do
  // limite, então credencial correta nunca recebe 429 (e ainda zera o balde).
  assert.equal((await enviar(ev, ev.guest, ev.gtoken)).status, 201);

  const lista = await (await get(`/api/events/${ev.id}/photos`)).json();
  assert.equal(lista.fotos.length, 2, 'só as duas credenciais válidas gravaram');
});
