#!/usr/bin/env node
'use strict';
// Exclui um evento em cascata pelo Store/SQLite (banco + fotos), de forma auditada.
// NUNCA roda sem --confirmar=<id> e exige o servidor PARADO (lock em DATA_DIR/server.lock).
// Uso: node scripts/apagar-evento.js <id> --confirmar=<id>
const path = require('path');
const createStore = require('../src/store');
const { apagarEvento } = require('../src/lgpd/apagar');
const { registrarAuditoria, registrarExclusao } = require('../src/lgpd/auditoria');
const { exigirServidorParado } = require('../src/lgpd/servidor');

const dirDados = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

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

try { exigirServidorParado(dirDados); } catch (e) { console.error(e.message); process.exit(3); }

const store = createStore(dirDados);
try {
  const r = apagarEvento({ store, id, confirmar });
  if (!r.ok) {
    if (r.motivo === 'confirmacao-invalida') uso('A confirmação não bate com o id. Nada foi apagado.');
    console.error(`Evento ${id} não encontrado.`);
    process.exit(1);
  }
  const em = new Date().toISOString();
  registrarAuditoria(dirDados, { quem: 'cli', evento: id, acao: 'evento.excluido', detalhe: { origem: 'script', resumo: r.resumo } });
  registrarExclusao(dirDados, { id, motivo: 'apagar-evento', em });
  console.log(`Evento ${id} excluído. Fotos: ${r.resumo.fotos}, convidados: ${r.resumo.convidados}, denúncias: ${r.resumo.denuncias}, registros de consentimento: ${r.resumo.consentimentos}.`);
} finally {
  store.close();
}
