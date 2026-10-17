'use strict';
// Validação de imagens pelo CONTEÚDO (magic bytes) e remoção de metadados
// (EXIF, GPS, XMP, IPTC, comentários) antes de gravar no disco.
//
// Por que não usar `sharp`: ele depende de binários nativos (libvips) por
// plataforma, o que incha o deploy, exige build toolchain e arrisca o CI.
// Aqui só precisamos (a) reconhecer o tipo real do arquivo e (b) descartar os
// segmentos de metadados. Isso é manipulação de contêiner: removemos os blocos
// de metadados sem reencodar a imagem — sem perda de qualidade, sem CPU
// relevante e sem dependência nativa. O que `sharp` faria de diferente é
// decodificar e recodificar a imagem; não é o que este produto precisa.

const MB = 1024 * 1024;

// Tipos reconhecidos pelo conteúdo. HEIC é reconhecido mas não aceito (os
// navegadores não exibem HEIC e remover metadados dele exigiria o mesmo
// toolchain nativo que estamos evitando) — ver `preparar`.
const TIPOS = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  heic: { mime: 'image/heic', ext: 'heic' },
};

class ErroImagem extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.name = 'ErroImagem';
    this.status = status;
  }
}

const comecaCom = (buf, bytes, off = 0) =>
  buf.length >= off + bytes.length && bytes.every((b, i) => buf[off + i] === b);

// Descobre o tipo pelo conteúdo, ignorando extensão e mimetype do cliente.
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (comecaCom(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const marca = buf.toString('latin1', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(marca)) return 'heic';
  }
  return null;
}

// JPEG: percorre os segmentos até o SOS e descarta APP0-APP15 e COM. Todo o
// EXIF/GPS/XMP/vídeo embutido/thumbnail vive em APPn, então some junto. A
// partir do SOS (dados da imagem) o restante é copiado literalmente.
function limparJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new ErroImagem('JPEG inválido.');
  const saida = [buf.subarray(0, 2)];
  let i = 2;
  let achouVarredura = false;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) throw new ErroImagem('JPEG inválido.');
    let m = buf[i + 1];
    while (m === 0xff && i + 2 < buf.length) { i += 1; m = buf[i + 1]; } // preenchimento
    if (m === 0xd9) { saida.push(buf.subarray(i, i + 2)); i += 2; break; } // EOI
    if (m === 0xda) {
      // SOS: os dados da imagem vêm a seguir. Copiamos até o primeiro EOI e
      // descartamos qualquer lixo depois dele (nada de metadado escondido no fim).
      const eoi = buf.indexOf(Buffer.from([0xff, 0xd9]), i + 2);
      if (eoi < 0) throw new ErroImagem('JPEG truncado.');
      saida.push(buf.subarray(i, eoi + 2));
      achouVarredura = true;
      i = buf.length;
      break;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { // marcadores sem comprimento
      saida.push(buf.subarray(i, i + 2)); i += 2; continue;
    }
    if (i + 4 > buf.length) throw new ErroImagem('JPEG truncado.');
    const tam = buf.readUInt16BE(i + 2);
    const fim = i + 2 + tam;
    if (tam < 2 || fim > buf.length) throw new ErroImagem('JPEG truncado.');
    const metadado = (m >= 0xe0 && m <= 0xef) || m === 0xfe; // APPn ou comentário
    if (!metadado) saida.push(buf.subarray(i, fim));
    i = fim;
  }
  if (!achouVarredura) throw new ErroImagem('JPEG sem dados de imagem.');
  return Buffer.concat(saida);
}

// PNG: mantém os blocos estruturais e de cor; descarta texto (tEXt/zTXt/iTXt),
// EXIF (eXIf), carimbo de tempo (tIME) e o chunk privado de GPS (gPS).
const PNG_DESCARTAR = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'gPS ']);
function limparPng(buf) {
  if (!comecaCom(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) throw new ErroImagem('PNG inválido.');
  const saida = [buf.subarray(0, 8)];
  let i = 8;
  let achouIhdr = false;
  let achouIend = false;
  while (i + 8 <= buf.length) {
    const tam = buf.readUInt32BE(i);
    const tipo = buf.toString('latin1', i + 4, i + 8);
    const fim = i + 12 + tam;
    if (fim > buf.length) throw new ErroImagem('PNG truncado.');
    if (tipo === 'IHDR') achouIhdr = true;
    if (tipo === 'IEND') { saida.push(buf.subarray(i, fim)); achouIend = true; i = fim; break; }
    if (!PNG_DESCARTAR.has(tipo)) saida.push(buf.subarray(i, fim));
    i = fim;
  }
  if (!achouIhdr || !achouIend) throw new ErroImagem('PNG inválido.');
  return Buffer.concat(saida);
}

// WebP: descarta os chunks EXIF e XMP e recalcula o tamanho do RIFF. Os chunks
// de imagem (VP8/VP8L/VP8X) e o perfil de cor (ICCP) permanecem.
const WEBP_DESCARTAR = new Set(['EXIF', 'XMP ']);
function limparWebp(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') throw new ErroImagem('WebP inválido.');
  const saida = [buf.subarray(0, 12)];
  // Respeita o tamanho declarado no RIFF: ignora qualquer byte depois dele.
  const fimRiff = Math.min(buf.length, 8 + buf.readUInt32LE(4));
  let i = 12;
  let achouImagem = false;
  while (i + 8 <= fimRiff) {
    const tipo = buf.toString('latin1', i, i + 4);
    const tam = buf.readUInt32LE(i + 4);
    const fim = i + 8 + tam + (tam % 2); // chunks são alinhados em 2 bytes
    if (fim > fimRiff) throw new ErroImagem('WebP truncado.');
    if (tipo === 'VP8 ' || tipo === 'VP8L' || tipo === 'VP8X') achouImagem = true;
    if (!WEBP_DESCARTAR.has(tipo)) saida.push(buf.subarray(i, fim));
    i = fim;
  }
  if (!achouImagem) throw new ErroImagem('WebP sem dados de imagem.');
  const out = Buffer.concat(saida);
  out.writeUInt32LE(out.length - 8, 4); // novo tamanho do RIFF
  return out;
}

// Valida pelo conteúdo e devolve os bytes já sem metadados.
function preparar(buffer) {
  const tipo = sniff(buffer);
  if (!tipo) throw new ErroImagem('Envie uma imagem JPEG, PNG ou WebP.');
  if (tipo === 'heic') throw new ErroImagem('Arquivos HEIC/HEIF ainda não são aceitos. Converta a foto para JPEG, PNG ou WebP.', 415);
  const limpo = tipo === 'jpeg' ? limparJpeg(buffer) : tipo === 'png' ? limparPng(buffer) : limparWebp(buffer);
  return { tipo, mime: TIPOS[tipo].mime, ext: TIPOS[tipo].ext, buffer: limpo };
}

module.exports = {preparar, sniff, limparJpeg, limparPng, limparWebp, ErroImagem, TIPOS, MB };
