// Testes unitários da validação por conteúdo e da remoção de metadados. Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { preparar, sniff, limparJpeg, limparPng, limparWebp, ErroImagem } = require('../src/image.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

function chunkPng(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  return Buffer.concat([len, Buffer.from(tipo, 'latin1'), dados, Buffer.alloc(4)]);
}
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunkPng('IHDR', Buffer.alloc(13)),
  chunkPng('tEXt', Buffer.from('Comment\0GPSLatitude=-23.5505')),
  chunkPng('eXIf', Buffer.from('GPSLatitude=-23.5505')),
  chunkPng('IDAT', Buffer.alloc(4)),
  chunkPng('IEND', Buffer.alloc(0)),
]);
function chunkWebp(tipo, dados) {
  const head = Buffer.alloc(8);
  head.write(tipo, 0, 'latin1');
  head.writeUInt32LE(dados.length, 4);
  return Buffer.concat([head, dados, dados.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
const WEBP = (() => {
  const corpo = Buffer.concat([
    chunkWebp('VP8X', Buffer.alloc(10)),
    chunkWebp('EXIF', Buffer.from('GPSLatitude=-23.5505')),
    chunkWebp('XMP ', Buffer.from('<x:xmpmeta>gps</x:xmpmeta>')),
    chunkWebp('VP8L', Buffer.alloc(10)),
  ]);
  const out = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), corpo]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
})();
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(12)]);
const captura = (fn) => { try { fn(); return null; } catch (e) { return e; } };

test('sniff reconhece o tipo pelo conteúdo e ignora bytes desconhecidos', () => {
  assert.equal(sniff(JPG), 'jpeg');
  assert.equal(sniff(PNG), 'png');
  assert.equal(sniff(WEBP), 'webp');
  assert.equal(sniff(HEIC), 'heic');
  assert.equal(sniff(Buffer.from('nao e imagem')), null);
  assert.equal(sniff(Buffer.alloc(0)), null);
  assert.equal(sniff(Buffer.from([0xff, 0xd8])), null); // curto demais
});

test('preparar devolve o tipo real, não o que o cliente diz', () => {
  const r = preparar(PNG);
  assert.equal(r.tipo, 'png');
  assert.equal(r.ext, 'png');
  assert.equal(r.mime, 'image/png');
});

test('preparar recusa HEIC (415) e conteúdo não-imagem (400)', () => {
  const heic = captura(() => preparar(HEIC));
  assert.ok(heic instanceof ErroImagem);
  assert.equal(heic.status, 415);
  const falso = captura(() => preparar(Buffer.from('texto puro')));
  assert.ok(falso instanceof ErroImagem);
  assert.equal(falso.status, 400);
});

test('limparJpeg remove APPn (EXIF/GPS) e preserva o fluxo da imagem', () => {
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from('GPSLatitude=-23.5505', 'latin1')]);
  const seg = Buffer.alloc(4 + payload.length);
  seg[0] = 0xff; seg[1] = 0xe1;
  seg.writeUInt16BE(2 + payload.length, 2);
  payload.copy(seg, 4);
  const comGps = Buffer.concat([JPG.subarray(0, 2), seg, JPG.subarray(2)]);
  const limpo = limparJpeg(comGps);
  assert.ok(!limpo.includes(Buffer.from('Exif')));
  assert.ok(!limpo.includes(Buffer.from('GPS')));
  assert.ok(limpo.length < comGps.length);
  assert.deepEqual(limpo.subarray(-20), comGps.subarray(-20));
  assert.equal(limpo[0], 0xff); assert.equal(limpo[1], 0xd8);
  assert.equal(limpo[limpo.length - 1], 0xd9);
});

test('limparPng descarta tEXt/eXIf/tIME e mantém os blocos estruturais', () => {
  const out = limparPng(PNG);
  assert.ok(!out.includes(Buffer.from('tEXt')));
  assert.ok(!out.includes(Buffer.from('eXIf')));
  assert.ok(!out.includes(Buffer.from('GPS')));
  assert.ok(out.includes(Buffer.from('IHDR')));
  assert.ok(out.includes(Buffer.from('IDAT')));
  assert.ok(out.includes(Buffer.from('IEND')));
});

test('limparWebp descarta EXIF/XMP, mantém os chunks de imagem e recalcula o RIFF', () => {
  const out = limparWebp(WEBP);
  assert.ok(!out.includes(Buffer.from('EXIF')));
  assert.ok(!out.includes(Buffer.from('XMP ')));
  assert.ok(!out.includes(Buffer.from('GPS')));
  assert.ok(out.includes(Buffer.from('VP8X')));
  assert.ok(out.includes(Buffer.from('VP8L')));
  assert.equal(out.toString('latin1', 0, 4), 'RIFF');
  assert.equal(out.toString('latin1', 8, 12), 'WEBP');
  assert.equal(out.readUInt32LE(4), out.length - 8);
});

test('estruturas inválidas são recusadas, não gravadas', () => {
  assert.throws(() => limparJpeg(Buffer.from('nao e jpeg')), ErroImagem);
  assert.throws(() => limparPng(Buffer.from('nao e png')), ErroImagem);
  assert.throws(() => limparWebp(Buffer.from('nao e webp')), ErroImagem);
  // JPEG truncado (sem SOS)
  assert.throws(() => limparJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02])), ErroImagem);
});
