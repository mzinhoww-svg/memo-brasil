// Testes de API, de isolamento entre casamentos (tenants) e de uploads seguros. Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// NODE_ENV=test liga o relógio injetável (src/clock.js). Em produção ele é
// ignorado por completo: a revelação volta a depender só do relógio real.
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-test-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const clock = require('../src/clock');
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
// Envia uma foto autenticando pelos cabeçalhos x-guest-id e x-guest-token
// (nunca por campo do corpo). `opts.token`/`opts.guestId` permitem forjar
// credencial para os testes de rejeição.
async function foto(ev, opts = {}) {
  const token = opts.token !== undefined ? opts.token : ev.gtoken;
  const guestId = opts.guestId !== undefined ? opts.guestId : ev.guest;
  const fd = new FormData();
  fd.append('foto', new Blob([opts.buf || JPG], { type: opts.type || 'image/jpeg' }), opts.name || 'f.jpg');
  const headers = {};
  if (guestId) headers['x-guest-id'] = guestId;
  if (token) headers['x-guest-token'] = token;
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
  const H = { 'x-guest-id': a.guest, 'x-guest-token': a.gtoken };
  assert.equal((await post(`/api/events/${a.id}/push/subscribe`, { guestId: a.guest, subscription: { endpoint: 'http://x' } }, H)).status, 400);
  const ok = await post(`/api/events/${a.id}/push/subscribe`, { guestId: a.guest, subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } }, H);
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

test('upload exige credencial: sem token 403, token desconhecido/estranho 403, nada é gravado', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await foto(a, { token: '' })).status, 403);
  assert.equal((await foto(a, { token: 'nao-existe' })).status, 403);
  assert.equal((await foto({ ...a, gtoken: b.gtoken })).status, 403);
  assert.equal((await foto(a, { guestId: 'id-adivinhado' })).status, 403);
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
  const r = await fetch(`${B}/api/events/${a.id}/photos`, { method: 'POST', headers: { 'x-guest-id': a.guest, 'x-guest-token': a.gtoken }, body: fd });
  assert.equal(r.status, 201);
  const rafa = await (await get(`/api/events/${a.id}/guests/${a.guest}`, { 'x-guest-id': a.guest, 'x-guest-token': a.gtoken })).json();
  const b = await (await get(`/api/events/${a.id}/guests/${bia.guestId}`, { 'x-guest-id': bia.guestId, 'x-guest-token': bia.guestToken })).json();
  assert.equal(rafa.fotosUsadas, 1);
  assert.equal(b.fotosUsadas, 0);
  // Rafa estoura a cota (2) e é barrado; a Bia, autenticada, ainda pode enviar.
  assert.equal((await foto(a)).status, 201);
  assert.equal((await foto(a)).status, 409);
  assert.equal((await foto(a, { guestId: bia.guestId, token: bia.guestToken })).status, 201);
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
// helpers adicionais para os cenários do item 1
async function criarComReveal(titulo, revealAtISO) {
  const r = await (await post('/api/events', { titulo, revealAt: revealAtISO, fotosPorConvidado: 2 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId, gtoken: g.guestToken };
}
const passado = () => new Date(Date.now() - 3600e3).toISOString();

test('criação de evento: valida campos e devolve id e token do organizador', async () => {
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' }, body: JSON.stringify({ criacaoAberta: true }) });
  const ok = await post('/api/events', { titulo: 'Casamento Teste', revealAt: futuro() });
  assert.equal(ok.status, 201);
  const j = await ok.json();
  assert.match(j.id, /^[A-Za-z0-9_-]+$/);
  assert.match(j.hostToken, /^[A-Za-z0-9_-]+$/);
  const pub = await (await get(`/api/events/${j.id}`)).json();
  assert.equal(pub.titulo, 'Casamento Teste');
  assert.equal((await post('/api/events', { titulo: '', revealAt: futuro() })).status, 400);
  assert.equal((await post('/api/events', { titulo: 'X' })).status, 400);
  assert.equal((await post('/api/events', { titulo: 'X', revealAt: 'nao-e-data' })).status, 400);
});

test('entrada de convidado: cria convidado e consulta saldo; id inexistente', async () => {
  const ev = await criar('Entrada');
  const r = await post(`/api/events/${ev.id}/guests`, { nome: 'Maria' });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.ok(j.guestId);
  const info = await (await get(`/api/events/${ev.id}/guests/${j.guestId}`, { 'x-guest-token': j.guestToken })).json();
  assert.equal(info.nome, 'Maria');
  assert.equal(info.fotosRestantes, 2);
  // Sem token o id sozinho não revela existência: 403 (não 404).
  assert.equal((await get(`/api/events/${ev.id}/guests/inexistente`)).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/guests/${j.guestId}`)).status, 403);
});

test('upload de foto: funciona antes da revelação e valida tipo e credencial', async () => {
  const ev = await criar('Upload');
  const r = await foto(ev);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.ok(j.id);
  assert.equal(j.restantes, 1);
  // Tipo falso (texto com nome de imagem), mas autenticado: 400.
  const fd = new FormData();
  fd.append('foto', new Blob(['x'], { type: 'text/plain' }), 'x.txt');
  const bad = await fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', headers: { 'x-guest-id': ev.guest, 'x-guest-token': ev.gtoken }, body: fd });
  assert.equal(bad.status, 400);
  // Sem credencial: 403, o corpo nem é lido.
  const fd2 = new FormData();
  fd2.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const noGuest = await fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd2 });
  assert.equal(noGuest.status, 403);
});

test('limite por convidado bloqueia upload excedente', async () => {
  const ev = await criar('Limite');
  assert.equal((await foto(ev)).status, 201);
  assert.equal((await foto(ev)).status, 201);
  assert.equal((await foto(ev)).status, 409);
});

test('foto bloqueada antes da revelação e liberada depois; token do organizador acessa antes', async () => {
  const ev = await criar('Bloqueio');
  const up = await (await foto(ev)).json();
  const id = up.id;
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`)).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`, { 'x-host-token': 'token-invalido' })).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`, { 'x-host-token': ev.tk })).status, 200);
  const p = await fetch(`${B}/api/events/${ev.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-host-token': ev.tk }, body: JSON.stringify({ revealAt: new Date(Date.now() - 1000).toISOString() }) });
  assert.equal(p.status, 200);
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`)).status, 200);
  const lista = await (await get(`/api/events/${ev.id}/photos`)).json();
  assert.equal(lista.revelado, true);
  assert.ok(lista.fotos[0].url);
});

test('upload após revelação é bloqueado', async () => {
  const ev = await criarComReveal('Depois', passado());
  assert.equal((await foto(ev)).status, 409);
});

test('token do organizador: inválido não acessa; master acessa todos', async () => {
  const a = await criar('TokenOrg');
  const b = await criar('TokenOrg2');
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': a.tk })).status, 403);
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': 'qualquer' })).status, 403);
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': 'master-de-teste' })).status, 200);
});

test('ids inexistentes retornam 404', async () => {
  assert.equal((await get('/api/events/naoexiste')).status, 404);
  assert.equal((await get('/api/events/naoexiste/photos')).status, 404);
  assert.equal((await get('/api/events/naoexiste/photos/x/file')).status, 404);
  assert.equal((await get('/api/events/naoexiste/guests/y')).status, 404);
  assert.equal((await post('/api/events/naoexiste/guests', { nome: 'X' })).status, 404);
});

test('master: token inválido não lista casamentos', async () => {
  assert.equal((await get('/api/master/events', { 'x-master-token': 'errado' })).status, 403);
  assert.equal((await get('/api/master/events', { 'x-master-token': 'master-de-teste' })).status, 200);
});

test('listagem pré-revelação não expõe nenhuma foto (sem url, miniatura ou autor)', async () => {
  const a = await criar('ListaPre');
  const bia = await (await post(`/api/events/${a.id}/guests`, { nome: 'Bia' })).json();
  const f1 = await (await foto(a)).json();
  const f2 = await (await foto(a, { guestId: bia.guestId, token: bia.guestToken })).json();

  const r = await get(`/api/events/${a.id}/photos`);
  assert.equal(r.status, 200); // o álbum precisa responder para desenhar os cadeados
  const lista = await r.json();
  assert.equal(lista.revelado, false);
  assert.equal(lista.fotos.length, 2);

  // Nada de foto no corpo: sem url/miniatura, sem autor, sem caminho de arquivo.
  const corpo = JSON.stringify(lista);
  assert.equal(corpo.includes('/file'), false);
  assert.equal(corpo.includes('Rafa'), false);
  assert.equal(corpo.includes('Bia'), false);

  for (const p of lista.fotos) {
    assert.deepEqual(Object.keys(p).sort(), ['bloqueada', 'id', 'minha']);
    assert.equal(p.bloqueada, true);
    // Mesmo sabendo o id, o arquivo (que é também a miniatura do álbum) não sai.
    assert.equal((await get(`/api/events/${a.id}/photos/${p.id}/file`)).status, 403);
  }
  assert.equal((await get(`/api/events/${a.id}/photos/${f1.id}/file`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${f2.id}/file`)).status, 403);
  // ZIP do casal antes da revelação: 409; sem token: 403.
  assert.equal((await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': a.tk })).status, 409);
  assert.equal((await get(`/api/events/${a.id}/fotos.zip`)).status, 403);

  // Depois da revelação, a mesma listagem expõe url e autor de propósito.
  await fetch(`${B}/api/events/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-host-token': a.tk }, body: JSON.stringify({ revealAt: passado() }) });
  const depois = await (await get(`/api/events/${a.id}/photos`)).json();
  assert.equal(depois.revelado, true);
  assert.equal(depois.fotos.length, 2);
  for (const p of depois.fotos) assert.equal(p.url, `/api/events/${a.id}/photos/${p.id}/file`);
});

test('nome vazio é recusado na entrada de convidado; saldo decresce após upload', async () => {
  const ev = await criar('Saldo');
  assert.equal((await post(`/api/events/${ev.id}/guests`, { nome: '' })).status, 400);
  const antes = await (await get(`/api/events/${ev.id}/guests/${ev.guest}`, { 'x-guest-id': ev.guest, 'x-guest-token': ev.gtoken })).json();
  assert.equal(antes.fotosRestantes, 2);
  await foto(ev);
  const depois = await (await get(`/api/events/${ev.id}/guests/${ev.guest}`, { 'x-guest-id': ev.guest, 'x-guest-token': ev.gtoken })).json();
  assert.equal(depois.fotosUsadas, 1);
  assert.equal(depois.fotosRestantes, 1);
});

test('evento suspenso bloqueia upload de fotos', async () => {
  const ev = await criar('Suspenso');
  await fetch(`${B}/api/master/events/${ev.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' }, body: JSON.stringify({ suspenso: true }) });
  assert.equal((await foto(ev)).status, 403);
});

// ───── Relógio injetável (src/clock.js) ─────────────────────────────────────
// O bloqueio da revelação é decidido pelo "agora" do servidor. Estes testes
// trocam esse "agora" sem esperar horas: só valem com NODE_ENV=test.

test('ponta a ponta: criar, entrar, fotografar — bloqueado antes da revelação e aberto depois', async () => {
  clock.setNow('2026-11-20T20:00:00.000Z');
  try {
    // criar evento -> entrar -> fotografar
    const r = await (await post('/api/events', { titulo: 'Revelacao com relogio', revealAt: new Date(clock.nowMs() + 3600e3).toISOString(), fotosPorConvidado: 2 })).json();
    const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
    const ev = { id: r.id, tk: r.hostToken, guest: g.guestId, gtoken: g.guestToken };
    const up = await foto(ev);
    assert.equal(up.status, 201);
    const { id } = await up.json();
    const H = { 'x-host-token': ev.tk };

    // ANTES da revelação, para quem não é a organização: tudo bloqueado.
    // URL do arquivo (e miniatura, que é a mesma rota usada como img src):
    assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`)).status, 403);
    assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file?token=invalido`)).status, 403);
    // Listagem: responde 200 (o álbum precisa mostrar os cadeados), mas sem
    // vazar miniatura, url ou autor.
    const antes = await (await get(`/api/events/${ev.id}/photos`)).json();
    assert.equal(antes.revelado, false);
    assert.equal(antes.fotos.length, 1);
    assert.equal(antes.fotos[0].bloqueada, true);
    assert.equal('url' in antes.fotos[0], false);
    assert.equal('autor' in antes.fotos[0], false);
    // ZIP: nem sem token (403) nem com o link do casal (409, "só depois da revelação").
    assert.equal((await get(`/api/events/${ev.id}/fotos.zip`)).status, 403);
    assert.equal((await get(`/api/events/${ev.id}/fotos.zip`, H)).status, 409);

    // Avança o relógio para depois da revelação.
    clock.advance(2 * 3600e3);

    // DEPOIS: o mesmo fluxo devolve 200.
    assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`)).status, 200);
    const depois = await (await get(`/api/events/${ev.id}/photos`)).json();
    assert.equal(depois.revelado, true);
    assert.equal(depois.fotos[0].bloqueada, undefined);
    assert.equal(depois.fotos[0].url, `/api/events/${ev.id}/photos/${id}/file`);
    const zip = await get(`/api/events/${ev.id}/fotos.zip`, H);
    assert.equal(zip.status, 200);
    const buf = Buffer.from(await zip.arrayBuffer());
    assert.equal(buf.slice(0, 2).toString(), 'PK');
  } finally {
    clock.reset(); // devolve o relógio real para os outros testes
  }
});

test('TEST_NOW é o instante em que o relógio do servidor começa', async () => {
  assert.equal(clock.emTeste(), true);
  const base = clock.setNow('2030-05-05T12:00:00.000Z');
  const inicio = Date.parse('2030-05-05T12:00:00.000Z');
  const tolerancia = 10e3; // o relógio injetado começa em TEST_NOW e segue andando
  try {
    assert.ok(base.getTime() >= inicio);
    assert.ok(clock.nowMs() >= inicio && clock.nowMs() < inicio + tolerancia, `agora=${clock.iso()}`);
    // O relógio injetado governa o que o servidor publica como "agora".
    const a = await (await post('/api/events', { titulo: 'Relogio', revealAt: new Date(clock.nowMs() + 3600e3).toISOString() })).json();
    const info = await (await get(`/api/events/${a.id}`)).json();
    assert.equal(info.revelado, false);
    const agora = Date.parse(info.agora);
    assert.ok(agora >= inicio && agora < inicio + tolerancia, `agora=${info.agora}`);
  } finally {
    clock.reset();
  }
});

// ───── Concorrência no limite por convidado ─────────────────────────────────
test('dois uploads simultâneos do mesmo convidado no limite: só um passa', async () => {
  const r = await (await post('/api/events', { titulo: 'Corrida no limite', revealAt: futuro(), fotosPorConvidado: 1 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Corredor' })).json();
  const ev = { id: r.id, tk: r.hostToken, guest: g.guestId, gtoken: g.guestToken };

  const [a, b] = await Promise.all([foto(ev), foto(ev)]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]); // exatamente um passa

  const lista = await (await get(`/api/events/${ev.id}/photos`)).json();
  assert.equal(lista.fotos.length, 1);
  const info = await (await get(`/api/events/${ev.id}/guests/${ev.guest}`, { 'x-guest-id': ev.guest, 'x-guest-token': ev.gtoken })).json();
  assert.equal(info.fotosUsadas, 1);
  assert.equal(info.fotosRestantes, 0);
  const host = await (await get(`/api/events/${ev.id}/host`, { 'x-host-token': ev.tk })).json();
  assert.equal(host.momentos, 1);
});

// ───── Reexecução (restart do servidor) sem perda ───────────────────────────
// Sobe o servidor de verdade em outro processo, aponta DATA_DIR para uma pasta
// nova, mata o processo e sobe de novo sobre a mesma pasta.
function subirServidor(dataDir) {
  const boot = [
    "process.env.NODE_ENV = 'test';",
    `process.env.DATA_DIR = ${JSON.stringify(dataDir)};`,
    "process.env.MASTER_TOKEN = 'master-de-teste';",
    `const app = require(${JSON.stringify(path.join(__dirname, '..', 'server.js'))});`,
    "const s = app.listen(0, () => console.log('PORTA ' + s.address().port));",
  ].join('\n');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', boot], { stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '', erro = '';
    const prazo = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`timeout subindo o servidor: ${erro}`)); }, 30000);
    child.stdout.on('data', (d) => {
      saida += d;
      const m = saida.match(/PORTA (\d+)/);
      if (m) { clearTimeout(prazo); resolve({ child, base: `http://127.0.0.1:${m[1]}` }); }
    });
    child.stderr.on('data', (d) => { erro += d; });
    child.on('exit', (c) => { clearTimeout(prazo); reject(new Error(`servidor saiu (código ${c}): ${erro}`)); });
  });
}
const encerrar = (child) => new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGTERM'); });

test('restart do servidor não perde evento, convidado nem foto', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-restart-'));
  let srv;
  try {
    srv = await subirServidor(dir);
    const r = await (await fetch(`${srv.base}/api/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: 'Sobrevive ao restart', revealAt: futuro(), fotosPorConvidado: 2 }) })).json();
    const g = await (await fetch(`${srv.base}/api/events/${r.id}/guests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Rafa' }) })).json();
    const fd = new FormData(); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
    const up = await fetch(`${srv.base}/api/events/${r.id}/photos`, { method: 'POST', headers: { 'x-guest-id': g.guestId, 'x-guest-token': g.guestToken }, body: fd });
    assert.equal(up.status, 201);
    const { id: fotoId } = await up.json();

    // Reexecução: mata o processo e sobe outro sobre a mesma DATA_DIR.
    await encerrar(srv.child);
    srv = await subirServidor(dir);

    const info = await (await fetch(`${srv.base}/api/events/${r.id}`)).json();
    assert.equal(info.titulo, 'Sobrevive ao restart');
    assert.equal(info.momentos, 1);
    const lista = await (await fetch(`${srv.base}/api/events/${r.id}/photos`)).json();
    assert.equal(lista.fotos.length, 1);
    assert.equal(lista.fotos[0].id, fotoId);
    // O token do convidado (só o hash no banco) continua valendo após o restart.
    const saldo = await (await fetch(`${srv.base}/api/events/${r.id}/guests/${g.guestId}`, { headers: { 'x-guest-token': g.guestToken } })).json();
    assert.equal(saldo.fotosUsadas, 1);
    assert.equal(saldo.fotosRestantes, 1);
    assert.equal((await fetch(`${srv.base}/api/events/${r.id}/guests/${g.guestId}`)).status, 403);
    // A foto continua no disco e continua protegida antes da revelação.
    assert.equal((await fetch(`${srv.base}/api/events/${r.id}/photos/${fotoId}/file`)).status, 403);
    const file = await fetch(`${srv.base}/api/events/${r.id}/photos/${fotoId}/file`, { headers: { 'x-host-token': r.hostToken } });
    assert.equal(file.status, 200);
    const guardado = Buffer.from(await file.arrayBuffer());
    // O servidor regrava a foto sem metadados (APPn fora), então o arquivo não é
    // byte a byte igual ao enviado — mas continua um JPEG válido, do EOI ao fim.
    assert.equal(guardado[0], 0xff); assert.equal(guardado[1], 0xd8);
    assert.equal(guardado[guardado.length - 2], 0xff); assert.equal(guardado[guardado.length - 1], 0xd9);
    assert.equal(guardado.includes(Buffer.from('Exif')), false);
  } finally {
    if (srv?.child) srv.child.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
