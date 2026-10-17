'use strict';
// QR Code do convite com "moldura de placa", em PNG, sem dependências novas:
// os módulos do QR (pacote `qrcode`, já no projeto) viram pixels de uma imagem
// em escala de cinza codificada à mão (zlib nativo). A moldura é um traço
// duplo, para o QR parecer uma plaquinha de mesa quando impresso ou baixado.
const zlib = require('zlib');
const QRCode = require('qrcode');

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tam, corpo, crc]);
}

// escala: pixels por módulo do QR · margem: módulos em branco ao redor.
function criarQrPng(link, { escala = 16, margem = 5 } = {}) {
  const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const lado = (n + margem * 2) * escala;
  const img = Buffer.alloc(lado * lado, 255); // branco
  const barra = (x0, y0, x1, y1) => {
    const ax = Math.max(0, x0), ay = Math.max(0, y0);
    const bx = Math.min(lado - 1, x1), by = Math.min(lado - 1, y1);
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) img[y * lado + x] = 0;
  };
  // Moldura: traço externo grosso + traço interno fino (recuo em pixels).
  const t1 = Math.round(escala * 0.5), m1 = escala;
  const t2 = Math.max(1, Math.round(escala * 0.22)), m2 = Math.round(escala * 1.7);
  for (const [m, t] of [[m1, t1], [m2, t2]]) {
    barra(m, m, lado - 1 - m, m + t - 1);
    barra(m, lado - m - t, lado - 1 - m, lado - 1 - m);
    barra(m, m, m + t - 1, lado - 1 - m);
    barra(lado - m - t, m, lado - 1 - m, lado - 1 - m);
  }
  // QR centralizado.
  const off = margem * escala;
  for (let lin = 0; lin < n; lin++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.data[lin * n + col]) continue;
      barra(off + col * escala, off + lin * escala, off + (col + 1) * escala - 1, off + (lin + 1) * escala - 1);
    }
  }
  // Linhas com filtro 0 (cada linha começa com o byte de filtro).
  const raw = Buffer.alloc((lado + 1) * lado);
  for (let y = 0; y < lado; y++) img.copy(raw, y * (lado + 1) + 1, y * lado, (y + 1) * lado);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8 bits por pixel, escala de cinza (colorType 0)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', zlib.deflateSync(raw)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { criarQrPng };
