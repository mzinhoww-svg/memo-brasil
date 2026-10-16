#!/usr/bin/env node
'use strict';
// Exclui um evento em cascata (arquivos de foto + registro no banco), de forma auditada.
// NUNCA roda sem --confirmar=<id> e a confirmação precisa bater com o id. Não imprime PII.
// Uso: node scripts/apagar-evento.js <id> --confirmar=<id>
const path = require('path');
const { carregarDb, salvarDb, registrarAuditoria } = require('../src/lgpd/db-json');
const { apagarEvento } = require('../src/lgpd/apagar');

const dirDados = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function uso(msg) {
  if (msg) console.error(msg);
  console.error('Uso: node scripts/apagar-evento.js <id> --confirmar=<id>');
  process.exit(2);
}

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const confirmar = (args.find((a) => a.startsWith('--confirmar=')) || '').slice('--confirmar='.length);
if (!id) uso('Informe o id do evento.');
if (!confirmar) uso('Falta --confirmar=<id>. Sem essa confirmação nada é apagado.');

const db = carregarDb(dirDados);
const r = apagarEvento({ db, dataDir: dirDados, id, confirmar });
if (!r.ok) {
  if (r.motivo === 'confirmacao-invalida') uso('A confirmação não bate com o id. Nada foi apagado.');
  console.error(`Evento ${id} não encontrado.`);
  process.exit(1);
}
salvarDb(dirDados, db);
registrarAuditoria(dirDados, { quem: 'cli', evento: id, acao: 'evento.excluido', detalhe: { origem: 'script', resumo: r.resumo } });
console.log(`Evento ${id} excluído. Fotos: ${r.resumo.fotos}, convidados: ${r.resumo.convidados}, denúncias: ${r.resumo.denuncias}, registros de consentimento: ${r.resumo.consentimentos}.`);
