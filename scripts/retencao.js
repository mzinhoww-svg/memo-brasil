#!/usr/bin/env node
'use strict';
// Retenção (LGPD): lista os eventos vencidos e, só com --executar, apaga em cascata.
// Padrão é dry-run. O log não tem PII: só id, motivo e idade em dias.
// Uso: node scripts/retencao.js [--executar]
const fs = require('fs');
const path = require('path');
const { carregarDb, salvarDb, registrarAuditoria } = require('../src/lgpd/db-json');
const { configRetencao, planoRetencao } = require('../src/lgpd/retencao');
const { apagarEvento } = require('../src/lgpd/apagar');

const dirDados = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const executar = process.argv.includes('--executar');

const db = carregarDb(dirDados);
let settings = {};
try { settings = JSON.parse(fs.readFileSync(path.join(dirDados, 'settings.json'), 'utf8')); } catch {}
const cfg = configRetencao({ settings, env: process.env });
const plano = planoRetencao(db, Date.now(), cfg);

console.log(`Retenção: ${cfg.diasAposRevelacao} dias após a revelação; ${cfg.diasSemRevelacao} dias para eventos nunca revelados.`);
if (!plano.length) { console.log('Nada a expirar.'); process.exit(0); }

for (const item of plano)
  console.log(`${executar ? 'apagando' : 'a apagar'} evento=${item.id} motivo=${item.motivo} idadeDias=${item.idadeDias} revelado=${item.revelado}`);

if (!executar) { console.log(`Dry-run: ${plano.length} evento(s) vencido(s). Use --executar para apagar.`); process.exit(0); }

let apagados = 0;
for (const item of plano) {
  const r = apagarEvento({ db, dataDir: dirDados, id: item.id, confirmar: item.id });
  if (!r.ok) { console.error(`Não foi possível apagar o evento ${item.id} (${r.motivo}).`); continue; }
  apagados++;
  registrarAuditoria(dirDados, { quem: 'cli', evento: item.id, acao: 'evento.expirado', detalhe: { motivo: item.motivo, idadeDias: item.idadeDias, resumo: r.resumo } });
}
salvarDb(dirDados, db);
console.log(`Apagados ${apagados} de ${plano.length} evento(s) vencido(s).`);
