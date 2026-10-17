#!/usr/bin/env node
'use strict';
// Exporta os dados de um evento (LGPD): um .zip com dados.json (sem tokens) e as fotos.
// Lê do Store/SQLite (memo.db), o mesmo banco do servidor. Não imprime PII.
// Uso: node scripts/exportar-evento.js <id> [--saida=arquivo.zip]
const fs = require('fs');
const path = require('path');
const createStore = require('../src/store');
const { exportarEvento } = require('../src/lgpd/exportar');

const dirDados = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

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
  const store = createStore(dirDados);
  try {
    const ev = store.db.events[id];
    if (!ev) { console.error(`Evento ${id} não encontrado.`); process.exit(1); }
    const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
    const destino = saidaArg
      ? saidaArg.slice('--saida='.length)
      : path.join(process.env.EXPORT_DIR || path.join(process.cwd(), 'exportacoes'), `evento-${id}-${carimbo}.zip`);
    if (!saidaArg) {
      const dir = path.dirname(destino);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      try { fs.chmodSync(dir, 0o700); } catch {}
    }
    const { arquivo, entradas } = await exportarEvento({ ev, dataDir: dirDados, destino });
    console.log(`Evento ${id}: exportado ${entradas.length} arquivo(s) em ${arquivo}`);
    console.log('Este arquivo contém dados pessoais. Guarde com cuidado e apague depois de entregar ao titular.');
  } finally {
    store.close();
  }
})().catch((e) => { console.error('Falha ao exportar:', e.message); process.exit(1); });
