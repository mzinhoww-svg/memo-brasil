// Testes de API, de isolamento entre casamentos (tenants) e de uploads seguros. Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-test-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
async function criar(titulo) {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 2 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId, gtoken: g.guestToken };
}
// Envia uma foto autenticando pelo cabeçalho x-guest-token (nunca por campo do corpo).
async function foto(ev, opts = {}) {
  const token = opts.token !== undefined ? opts.token : ev.gtoken;
  const fd = new FormData();
  fd.append('foto', new Blob([opts.buf || JPG], { type: opts.type || 'image/jpeg' }), opts.name || 'f.jpg');
  const headers = token ? { 'x-guest-token': token } : {};
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', headers, body: fd });
}
// JPEG válido com um segmento APP1/EXIF contendo coordenadas de GPS.
function jpegComGps() {
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from('GPSLatitude=-23.5505;GPSLongitude=-46.6333;', 'latin1')]);
  const seg = Buffer.alloc(4 + payload.length);
  seg[0] = 0xff; seg[1] = 0xe1;
  seg.writeUInt16BE(2 + payload.length, 2);
  payload.copy(seg, 4);
  return Buffer.concat([JPG.subarray(0, 2), seg, JPG.subarray(2)]);
}
// PNG válido com blocos de texto (tEXt) e EXIF. O CRC não é conferido pelo parser.
function chunkPng(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  return Buffer.concat([len, Buffer.from(tipo, 'latin1'), dados, Buffer.alloc(4)]);
}
const PNG_COM_TEXTO = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunkPng('IHDR', Buffer.alloc(13)),
  chunkPng('tEXt', Buffer.from('Comment\0GPSLatitude=-23.5505')),
  chunkPng('eXIf', Buffer.from('GPSLatitude=-23.5505')),
  chunkPng('IDAT', Buffer.alloc(4)),
  chunkPng('IEND', Buffer.alloc(0)),
]);
const dirFotos = (evId) => path.join(process.env.DATA_DIR, 'photos', evId);

test('álbum é individual: fotos de um casamento não aparecem em outro', async () => {
  const a = await criar('A'), b = await criar('B');
  const up = await (await foto(a)).json();
  assert.ok(up.id);
  const la = await (await get(`/api/events/${a.id}/photos`)).json();
  const lb = await (await get(`/api/events/${b.id}/photos`)).json();
  assert.equal(la.fotos.length, 1);
  assert.equal(lb.fotos.length, 0);
  assert.equal((await get(`/api/events/${b.id}/photos/${up.id}/file`, { 'x-host-token': b.tk })).status, 404);
});

test('convidado de um casamento não fotografa em outro', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await foto({ ...b, gtoken: a.gtoken })).status, 403);
});

test('foto fica bloqueada antes da revelação e o casal de outro evento não a acessa', async () => {
  const a = await criar('A'), b = await criar('B');
  const { id } = await (await foto(a)).json();
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': b.tk })).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': a.tk })).status, 200);
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': 'master-de-teste' })).status, 200);
});

test('painel do casal não abre outro casamento; master abre todos', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': a.tk })).status, 403);
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': 'master-de-teste' })).status, 200);
  assert.equal((await get('/api/master/events', { 'x-master-token': a.tk })).status, 403);
  assert.equal((await get('/api/master/events', { 'x-master-token': 'master-de-teste' })).status, 200);
});

test('limite de fotos por convidado e upload bloqueado após revelação', async () => {
  const a = await criar('A');
  assert.equal((await foto(a)).status, 201);
  assert.equal((await foto(a)).status, 201);
  assert.equal((await foto(a)).status, 409);
});

test('cerimonial não altera equipe', async () => {
  const a = await criar('A');
  const m = await (await post(`/api/events/${a.id}/equipe`, { nome: 'Carla', papel: 'cerimonial' }, { 'x-host-token': a.tk })).json();
  const ct = m.link.split('#t=')[1];
  assert.equal((await get(`/api/events/${a.id}/lista`, { 'x-host-token': ct })).status, 200);
  assert.equal((await post(`/api/events/${a.id}/equipe`, { nome: 'X' }, { 'x-host-token': ct })).status, 403);
});

test('apenasLista exige nome da lista; suspensão bloqueia entrada', async () => {
  const a = await criar('A');
  const H = { 'x-host-token': a.tk };
  await fetch(`${B}/api/events/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...H }, body: JSON.stringify({ config: { apenasLista: true } }) });
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Penetra' })).status, 403);
  await post(`/api/events/${a.id}/lista`, { texto: 'Maria Silva' }, H);
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'maria silva' })).status, 201);
  await fetch(`${B}/api/master/events/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' }, body: JSON.stringify({ suspenso: true }) });
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Maria Silva' })).status, 403);
});

test('variáveis da plataforma: fechar cadastro bloqueia novos eventos', async () => {
  const M = { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' };
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: M, body: JSON.stringify({ criacaoAberta: false }) });
  assert.equal((await post('/api/events', { titulo: 'X', revealAt: futuro() })).status, 403);
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: M, body: JSON.stringify({ criacaoAberta: true }) });
  assert.equal((await post('/api/events', { titulo: 'X', revealAt: futuro() })).status, 201);
});

test('push: inscrição inválida é recusada; manifest é por casamento', async () => {
  const a = await criar('Casamento Z');
  assert.equal((await post(`/api/events/${a.id}/push/subscribe`, { guestId: a.guest, subscription: { endpoint: 'http://x' } })).status, 400);
  const ok = await post(`/api/events/${a.id}/push/subscribe`, { guestId: a.guest, subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } });
  assert.equal(ok.status, 201);
  const m = await (await get(`/e/${a.id}/manifest.webmanifest`)).json();
  assert.equal(m.name, 'Casamento Z');
  assert.equal(m.start_url, `/e/${a.id}/inicio`);
});

test('ZIP do álbum só depois da revelação e só do próprio casamento', async () => {
  const a = await criar('A');
  assert.equal((await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': a.tk })).status, 409);
  const M = { 'x-host-token': 'master-de-teste' };
  const r = await get(`/api/events/${a.id}/fotos.zip`, M);
  assert.equal(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.slice(0, 2).toString(), 'PK');
  const b = await criar('B');
  assert.equal((await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': b.tk })).status, 403);
});

// ───── Uploads seguros (APR-029, itens 7 e 11)

test('upload exige credencial: sem token 401, token desconhecido/estranho 403, nada é gravado', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await foto(a, { token: '' })).status, 401);
  assert.equal((await foto(a, { token: 'nao-existe' })).status, 403);
  assert.equal((await foto({ ...a, gtoken: b.gtoken })).status, 403);
  const l = await (await get(`/api/events/${a.id}/photos`)).json();
  assert.equal(l.fotos.length, 0);
});

test('tipo é validado pelo conteúdo: texto disfarçado de .jpg é recusado', async () => {
  const a = await criar('A');
  const r = await foto(a, { buf: Buffer.from('isto nao e uma imagem, e so texto'), name: 'golpe.jpg', type: 'image/jpeg' });
  assert.equal(r.status, 400);
  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 0);
});

test('arquivo vazio é recusado', async () => {
  const a = await criar('A');
  assert.equal((await foto(a, { buf: Buffer.alloc(0) })).status, 400);
});

test('HEIC/HEIF (reconhecido por magic bytes) é recusado com mensagem clara', async () => {
  const a = await criar('A');
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(12)]);
  const r = await foto(a, { buf: heic, name: 'foto.heic', type: 'image/heic' });
  assert.equal(r.status, 415);
});

test('foto acima do limite do evento é recusada com 413 e não grava', async () => {
  const a = await criar('A');
  const M = { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' };
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: M, body: JSON.stringify({ tamanhoMaxFotoMB: 1 }) });
  try {
    const grande = Buffer.concat([JPG, Buffer.alloc(1024 * 1024 + 512)]);
    assert.equal((await foto(a, { buf: grande })).status, 413);
  } finally {
    await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: M, body: JSON.stringify({ tamanhoMaxFotoMB: 10 }) });
  }
  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 0);
});

test('a cota conta pelo convidado autenticado, não pelo guestId do formulário', async () => {
  const a = await criar('A');
  const bia = await (await post(`/api/events/${a.id}/guests`, { nome: 'Bia' })).json();
  // Corpo diz que é a Bia, mas o token autentica o Rafa: a foto é do Rafa.
  const fd = new FormData();
  fd.append('guestId', bia.guestId);
  fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const r = await fetch(`${B}/api/events/${a.id}/photos`, { method: 'POST', headers: { 'x-guest-token': a.gtoken }, body: fd });
  assert.equal(r.status, 201);
  const rafa = await (await get(`/api/events/${a.id}/guests/${a.guest}`)).json();
  const b = await (await get(`/api/events/${a.id}/guests/${bia.guestId}`)).json();
  assert.equal(rafa.fotosUsadas, 1);
  assert.equal(b.fotosUsadas, 0);
  // Rafa estoura a cota (2) e é barrado; a Bia, autenticada, ainda pode enviar.
  assert.equal((await foto(a)).status, 201);
  assert.equal((await foto(a)).status, 409);
  assert.equal((await foto({ ...a, gtoken: bia.guestToken })).status, 201);
});

test('nome do arquivo é gerado pelo servidor (ignora path traversal do cliente)', async () => {
  const a = await criar('A');
  const r = await foto(a, { name: '../../evil.jpg' });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.deepEqual(fs.readdirSync(dirFotos(a.id)), [`${id}.jpg`]);
  assert.ok(!fs.existsSync(path.join(process.env.DATA_DIR, 'photos', 'evil.jpg')));
});

test('EXIF e GPS são removidos do JPEG gravado, sem reencodar a imagem', async () => {
  const a = await criar('A');
  const comGps = jpegComGps();
  assert.ok(comGps.includes(Buffer.from('GPSLatitude')), 'a fixture precisa conter GPS');
  const r = await foto(a, { buf: comGps });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const gravado = fs.readFileSync(path.join(dirFotos(a.id), `${id}.jpg`));
  assert.ok(!gravado.includes(Buffer.from('Exif')), 'EXIF deve sumir');
  assert.ok(!gravado.includes(Buffer.from('GPS')), 'GPS deve sumir');
  assert.equal(gravado[0], 0xff); assert.equal(gravado[1], 0xd8);
  assert.equal(gravado[gravado.length - 2], 0xff); assert.equal(gravado[gravado.length - 1], 0xd9);
  assert.deepEqual(gravado.subarray(-20), comGps.subarray(-20), 'dados da imagem intactos');
  // E a foto continua acessível pela organização (bloqueio antes da revelação mantido).
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': a.tk })).status, 200);
});

test('extensão e mimetype do cliente são ignorados: PNG disfarçado de .jpg vira .png e perde metadados', async () => {
  const a = await criar('A');
  const r = await foto(a, { buf: PNG_COM_TEXTO, name: 'mentira.jpg', type: 'image/jpeg' });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const gravado = fs.readFileSync(path.join(dirFotos(a.id), `${id}.png`));
  assert.ok(!gravado.includes(Buffer.from('tEXt')));
  assert.ok(!gravado.includes(Buffer.from('eXIf')));
  assert.ok(!gravado.includes(Buffer.from('GPS')));
});
