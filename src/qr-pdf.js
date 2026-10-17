'use strict';
// Gera o cartaz A5 do QR Code sem adicionar dependências: o QR (do pacote
// `qrcode`, que já está no projeto) vira retângulos vetoriais e o texto usa as
// fontes nativas Helvetica (PDF base-14, codificação WinAnsi/latin1). O PDF
// fica minúsculo, imprime em qualquer tamanho e não depende de fonte externa.
const QRCode = require('qrcode');

const A5 = { largura: 420, altura: 595 }; // 148x210 mm em pontos
const MARGEM = 40;
const LARGURA_TEXTO = A5.largura - MARGEM * 2;

// Aproximação de largura das fontes Helvetica (fração do tamanho). Serve para
// quebrar linhas; não é métrica tipográfica fina.
const fatorEm = (negrito) => (negrito ? 0.556 : 0.5);
const largura = (texto, tamanho, negrito) => String(texto).length * tamanho * fatorEm(negrito);

function quebrar(texto, tamanho, negrito, maxLargura, maxLinhas = 4) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const candidato = atual ? `${atual} ${p}` : p;
    if (atual && largura(candidato, tamanho, negrito) > maxLargura) { linhas.push(atual); atual = p; }
    else atual = candidato;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, maxLinhas);
}

// WinAnsi cobre os acentos do pt-BR; qualquer outra coisa vira "?" para o PDF
// continuar válido sem fontes embutidas.
const soWinAnsi = (s) => String(s).replace(/[\u0000-\u001F\u007F-\u009F\u0100-\uFFFF]/g, '?');
const escapar = (s) => soWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const texto = (x, y, str, { tamanho = 11, negrito = false } = {}) =>
  `BT /${negrito ? 'F1' : 'F2'} ${tamanho} Tf 0 g 1 0 0 1 ${x} ${y} Tm (${escapar(str)}) Tj ET`;

function streamQr(link, { x, y, tamanho }) {
  const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const passo = tamanho / n;
  const partes = ['0 0 0 rg'];
  for (let lin = 0; lin < n; lin++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.data[lin * n + col]) continue;
      const px = (x + col * passo).toFixed(2);
      const py = (y + (n - 1 - lin) * passo).toFixed(2);
      partes.push(`${px} ${py} ${passo.toFixed(2)} ${passo.toFixed(2)} re`);
    }
  }
  partes.push('f');
  return partes.join('\n');
}

// Monta o arquivo PDF com tabela xref correta (em bytes latin1).
function montarPdf(corpos) {
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  corpos.forEach((corpo, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${corpos.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${corpos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function criarQrPdf({ titulo, link, instrucoes = [] }) {
  const cmds = [];
  let y = A5.altura - 70;
  for (const l of quebrar(titulo, 19, true, LARGURA_TEXTO, 2)) { cmds.push(texto(MARGEM, y, l, { tamanho: 19, negrito: true })); y -= 24; }
  cmds.push(texto(MARGEM, y, 'Aponte a câmera do celular para o QR Code e entre no convite.', { tamanho: 11 }));

  const qrTamanho = 250;
  const qrY = 175;
  cmds.push(streamQr(link, { x: (A5.largura - qrTamanho) / 2, y: qrY, tamanho: qrTamanho }));

  let iy = qrY - 30;
  for (const inst of instrucoes) for (const l of quebrar(inst, 11, false, LARGURA_TEXTO, 2)) { cmds.push(texto(MARGEM, iy, l)); iy -= 15; }

  let fy = 46;
  for (const l of quebrar(link, 8, false, LARGURA_TEXTO, 2)) { cmds.push(texto(MARGEM, fy, l, { tamanho: 8 })); fy -= 11; }

  const conteudo = cmds.join('\n') + '\n';
  return montarPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A5.largura} ${A5.altura}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]);
}

module.exports = { criarQrPdf };
