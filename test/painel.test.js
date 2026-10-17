// Painel (item 6): QR em PNG/PDF, remoção de convidado e controle da revelação.
// Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('node:zlib');
const QRCode = require('qrcode');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-painel-test-'));
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.PUBLIC_URL = 'https://convite.test';
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
const AUDIT = path.join(process.env.DATA_DIR, 'audit.log');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const patch = (p, body, h = {}) => fetch(B + p, { method: 'PATCH', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const del = (p, h = {}) => fetch(B + p, { method: 'DELETE', headers: h });
const futuro = (ms = 3600e3) => new Date(Date.now() + ms).toISOString();

async function criar(titulo) {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 3 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId };
}
async function foto(ev) {
  const fd = new FormData(); fd.append('guestId', ev.guest); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd });
}
// Auditoria é appendFile assíncrono; espera a linha aparecer.
async function auditaram(acao, ms = 2000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try { if (fs.readFileSync(AUDIT, 'utf8').includes(`"acao":"${acao}"`)) return true; } catch {}
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}
async function cerimonial(ev, nome = 'Carla') {
  const m = await (await post(`/api/events/${ev.id}/equipe`, { nome, papel: 'cerimonial' }, { 'x-host-token': ev.tk })).json();
  return m.link.split('#t=')[1];
}
// Lê o PNG em escala de cinza gerado pelo servidor (filtro 0) e dá acesso aos pixels.
function lerPngCinza(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert.equal(buf[24], 8, 'PNG de 8 bits');
  assert.equal(buf[25], 0, 'PNG em escala de cinza');
  let off = 8; const partes = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tipo = buf.toString('ascii', off + 4, off + 8);
    if (tipo === 'IDAT') partes.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(partes));
  return { w, h, px: (x, y) => raw[y * (w + 1) + 1 + x] };
}

// ───── QR Code
test('QR PNG do convite só sai para a organização do próprio casamento', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await get(`/api/events/${a.id}/qr.png`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/qr.png`, { 'x-host-token': b.tk })).status, 403);
  const ok = await get(`/api/events/${a.id}/qr.png`, { 'x-host-token': a.tk });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type') || '', /image\/png/);
  const buf = Buffer.from(await ok.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString('hex'), '89504e47');
  const { w, h, px } = lerPngCinza(buf);
  assert.equal(w, h, 'PNG quadrado');
  assert.ok(w >= 400, `PNG grande o suficiente para imprimir (${w}px)`);
  assert.equal(px(17, 17), 0, 'moldura de placa escura no canto');
  const meio = Math.floor(w / 2);
  let escuros = 0;
  for (let y = meio - 60; y < meio + 60; y++) for (let x = meio - 60; x < meio + 60; x++) if (px(x, y) === 0) escuros++;
  assert.ok(escuros > 200, 'QR presente no centro da placa');
  // Os módulos desenhados têm de bater com o QR do link do convite.
  const qr = QRCode.create(`https://convite.test/e/${a.id}`, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size, esc = 16, off = 5 * esc;
  let iguais = 0;
  for (let lin = 0; lin < n; lin++) for (let col = 0; col < n; col++) {
    const escuro = px(off + col * esc + esc / 2, off + lin * esc + esc / 2) === 0;
    if (escuro === !!qr.modules.data[lin * n + col]) iguais++;
  }
  assert.equal(iguais, n * n, 'os módulos do QR batem com o link do convite');
  assert.equal((await get(`/api/events/${a.id}/qr.png`, { 'x-host-token': 'master-de-teste' })).status, 200);
});

test('QR PDF é A5 válido, com o título do evento e instruções em pt-BR', async () => {
  const a = await criar('Casamento José e Ana');
  assert.equal((await get(`/api/events/${a.id}/qr.pdf`)).status, 403);
  const ok = await get(`/api/events/${a.id}/qr.pdf`, { 'x-host-token': a.tk });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type') || '', /application\/pdf/);
  const pdf = Buffer.from(await ok.arrayBuffer());
  const txt = pdf.toString('latin1');
  assert.equal(txt.slice(0, 5), '%PDF-');
  assert.ok(txt.trimEnd().endsWith('%%EOF'), 'PDF deve terminar em %%EOF');
  assert.match(txt, /\/MediaBox \[0 0 420 595\]/); // A5 em pontos
  assert.match(txt, /re S/, 'moldura de placa no PDF');
  assert.ok(pdf.length > 4000, `PDF com conteúdo (${pdf.length} bytes)`);
  assert.ok(txt.includes('Casamento José e Ana'), 'título do evento no PDF');
  assert.ok(/c[aâ]mera/i.test(txt) && /revela/i.test(txt), 'instruções curtas em pt-BR');
  assert.ok(txt.includes(`/e/${a.id}`), 'o link do convite aparece no PDF');
});

// ───── Remover convidado (acesso da câmera)
test('organização remove convidado: acesso cai e as fotos só somem com apagarFotos=1', async () => {
  const a = await criar('A');
  assert.equal((await foto(a)).status, 201);
  const H = { 'x-host-token': a.tk };
  assert.equal((await del(`/api/events/${a.id}/convidados/nao-existe`, H)).status, 404);
  assert.equal((await del(`/api/events/${a.id}/convidados/${a.guest}`, H)).status, 200);
  // Sem apagarFotos, a foto continua no evento (moderação intacta) mas o acesso acabou.
  const mod = await (await get(`/api/events/${a.id}/moderacao`, H)).json();
  assert.equal(mod.fotos.length, 1);
  assert.equal((await foto(a)).status, 403); // não está mais no evento
  assert.ok(await auditaram('convidado.removido'));

  // Com apagarFotos=1, as fotos do convidado saem do registro e do disco.
  const b = await criar('B');
  assert.equal((await foto(b)).status, 201);
  const { id: pid } = await (await (await get(`/api/events/${b.id}/moderacao`, { 'x-host-token': b.tk })).json()).fotos[0];
  const r = await (await del(`/api/events/${b.id}/convidados/${b.guest}?apagarFotos=1`, { 'x-host-token': b.tk })).json();
  assert.equal(r.fotosApagadas, 1);
  assert.equal((await get(`/api/events/${b.id}/photos/${pid}/file`, { 'x-host-token': b.tk })).status, 404);
  assert.equal((await (await get(`/api/events/${b.id}/moderacao`, { 'x-host-token': b.tk })).json()).fotos.length, 0);
});

test('remoção de convidado: cerimonial pode, e outro casamento recebe 403', async () => {
  const a = await criar('A'), b = await criar('B');
  const ct = await cerimonial(a);
  assert.equal((await del(`/api/events/${a.id}/convidados/${a.guest}`, { 'x-host-token': b.tk })).status, 403);
  assert.equal((await del(`/api/events/${b.id}/convidados/${b.guest}`, { 'x-host-token': a.tk })).status, 403);
  assert.equal((await del(`/api/events/${a.id}/convidados/${a.guest}`, { 'x-host-token': ct })).status, 200);
});

// ───── Revelação: estender e encerrar
test('estender a revelação é só do casal, exige data futura e fica auditado', async () => {
  const a = await criar('A'), b = await criar('B');
  const ct = await cerimonial(a);
  const H = { 'x-host-token': a.tk };
  const nova = futuro(7200e3);
  assert.equal((await patch(`/api/events/${a.id}/revelacao`, { revealAt: nova }, { 'x-host-token': ct })).status, 403);
  assert.equal((await patch(`/api/events/${a.id}/revelacao`, { revealAt: nova }, { 'x-host-token': b.tk })).status, 403);
  assert.equal((await patch(`/api/events/${a.id}/revelacao`, { revealAt: 'ontem' }, H)).status, 400);
  assert.equal((await patch(`/api/events/${a.id}/revelacao`, { revealAt: new Date(Date.now() - 1000).toISOString() }, H)).status, 400);
  const ok = await patch(`/api/events/${a.id}/revelacao`, { revealAt: nova }, H);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).revealAt, nova);
  assert.ok(await auditaram('revelacao.estendida'));
});

test('o PATCH geral só muda a revelação para o casal e fica auditado', async () => {
  const a = await criar('A');
  const ct = await cerimonial(a);
  const antes = (await (await get(`/api/events/${a.id}/host`, { 'x-host-token': a.tk })).json()).revealAt;
  assert.equal((await patch(`/api/events/${a.id}`, { revealAt: futuro(9999e3) }, { 'x-host-token': ct })).status, 403);
  assert.equal((await (await get(`/api/events/${a.id}/host`, { 'x-host-token': a.tk })).json()).revealAt, antes);
  assert.equal((await patch(`/api/events/${a.id}`, { revealAt: 'nada' }, { 'x-host-token': a.tk })).status, 400);
  assert.equal((await patch(`/api/events/${a.id}`, { revealAt: futuro(9999e3) }, { 'x-host-token': a.tk })).status, 200);
  assert.ok(await auditaram('revelacao.alterada'));
});

test('encerrar a revelação revela agora, é só do casal, auditado e idempotente', async () => {
  const a = await criar('A');
  const H = { 'x-host-token': a.tk };
  assert.equal((await foto(a)).status, 201);
  const ct = await cerimonial(a);
  assert.equal((await post(`/api/events/${a.id}/revelacao/encerrar`, {}, { 'x-host-token': ct })).status, 403);
  const b = await criar('B');
  assert.equal((await post(`/api/events/${a.id}/revelacao/encerrar`, {}, { 'x-host-token': b.tk })).status, 403);
  const ok = await post(`/api/events/${a.id}/revelacao/encerrar`, {}, H);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).revelado, true);
  // Convidado passa a ver o álbum.
  const album = await (await get(`/api/events/${a.id}/photos`)).json();
  assert.equal(album.revelado, true);
  assert.equal(album.fotos.length, 1);
  assert.ok(await auditaram('revelacao.encerrada'));
  assert.equal((await post(`/api/events/${a.id}/revelacao/encerrar`, {}, H)).status, 409);
});
