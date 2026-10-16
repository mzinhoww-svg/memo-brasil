#!/usr/bin/env node
'use strict';
// Exporta os dados de um evento (LGPD): um .zip com dados.json (sem tokens) e as fotos.
// Nunca imprime dados pessoais; só o id do evento e o caminho do arquivo gerado.
// Uso: node scripts/exportar-evento.js <id> [--saida=arquivo.zip]
const path = require('path');
const { carregarDb } = require('../src/lgpd/db-json');
const { exportarEvento } = require('../src/lgpd/exportar');

const dirDados = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function uso(msg) {
  if (msg) console.error(msg);
  console.error('Uso: node scripts/exportar-evento.js <id> [--saida=arquivo.zip]');
  process.exit(2);
}

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const saidaArg = args.find((a) => a.startsWith('--saida='));
if (!id) uso('Informe o id do evento.');
if (saidaArg && !saidaArg.slice('--saida='.length)) uso('Informe o caminho depois de --saida=.');

(async () => {
  const db = carregarDb(dirDados);
  const ev = db.events[id];
  if (!ev) { console.error(`Evento ${id} não encontrado.`); process.exit(1); }
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = saidaArg
    ? saidaArg.slice('--saida='.length)
    : path.join(process.env.EXPORT_DIR || path.join(process.cwd(), 'exportacoes'), `evento-${id}-${carimbo}.zip`);
  const { arquivo, entradas } = await exportarEvento({ ev, dataDir: dirDados, destino });
  console.log(`Evento ${id}: exportado ${entradas.length} arquivo(s) em ${arquivo}`);
})().catch((e) => { console.error('Falha ao exportar:', e.message); process.exit(1); });
