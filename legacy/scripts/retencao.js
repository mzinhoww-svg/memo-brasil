#!/usr/bin/env node
'use strict';
// Retenção (LGPD): expira eventos pelo Store/SQLite, com o servidor parado.
// - Padrão: dry-run (lista o que expiraria e quem seria avisado).
// - --executar: avisa quem está a 30 dias do prazo e apaga os vencidos.
// Contagem sempre a partir de revealAt (nunca de createdAt). Log sem PII.
// Uso: node scripts/retencao.js [--executar]
const fs = require('fs');
const path = require('path');
const createStore = require('../src/store');
const { configRetencao, planoRetencao, avisosRetencao } = require('../src/lgpd/retencao');
const { apagarEvento } = require('../src/lgpd/apagar');
const { registrarAuditoria, registrarExclusao } = require('../src/lgpd/auditoria');
const { exigirServidorParado } = require('../src/lgpd/servidor');
const { enfileirarAviso } = require('../src/lgpd/outbox');

const dirDados = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const executar = process.argv.includes('--executar');

try { exigirServidorParado(dirDados); } catch (e) { console.error(e.message); process.exit(3); }

let settings = {};
try { settings = JSON.parse(fs.readFileSync(path.join(dirDados, 'settings.json'), 'utf8')); } catch {}
const cfg = configRetencao({ settings, env: process.env });

const store = createStore(dirDados);
try {
  const agora = Date.now();
  const plano = planoRetencao(store.db, agora, cfg);
  const avisos = avisosRetencao(store.db, agora, cfg);

  console.log(`Retenção: ${cfg.diasAposRevelacao} dias após a revelação; ${cfg.diasSemRevelacao} dias após revealAt para eventos que não abriram.`);
  console.log(`Vencidos: ${plano.length}; a avisar nos próximos 30 dias: ${avisos.length}.`);

  for (const a of avisos)
    console.log(`${executar ? 'avisando' : 'a avisar'} evento=${a.id} motivo=${a.motivo} diasRestantes=${a.diasRestantes} apagaEm=${a.apagaEm}`);
  for (const item of plano)
    console.log(`${executar ? 'apagando' : 'a apagar'} evento=${item.id} motivo=${item.motivo} idadeDias=${item.idadeDias} apagaEm=${item.apagaEm}`);

  if (!executar) {
    console.log('Dry-run: nada foi alterado. Use --executar para avisar e apagar.');
    process.exit(0);
  }

  const em = new Date().toISOString();
  for (const a of avisos) {
    const ev = store.db.events[a.id];
    if (!ev) continue;
    ev.retencaoAvisoEm = em;
    // Fila de e-mail para o contato do casal (o envio real depende do item de e-mail).
    try {
      enfileirarAviso(dirDados, `retencao-${a.id}.json`, {
        para: ev.contato || '', assunto: `Seu álbum será apagado em ${a.diasRestantes} dias`,
        texto: `O álbum do evento ${a.id} será apagado em ${a.apagaEm} pela política de retenção. Se quiser guardar as fotos, exporte antes dessa data.`,
        criadoEm: em,
      });
    } catch (e) { console.error(`Falha ao enfileirar aviso do evento ${a.id}: ${e.message}`); }
    registrarAuditoria(dirDados, { quem: 'cli', evento: a.id, acao: 'retencao.aviso', detalhe: { diasRestantes: a.diasRestantes, apagaEm: a.apagaEm } });
  }
  // Persiste o aviso ANTES de apagar: deleteEvent atualiza o shadow do Store.
  if (avisos.length) store.save();

  let apagados = 0;
  for (const item of plano) {
    const r = apagarEvento({ store, id: item.id, confirmar: item.id });
    if (!r.ok) { console.error(`Não foi possível apagar o evento ${item.id} (${r.motivo}).`); continue; }
    apagados++;
    registrarAuditoria(dirDados, { quem: 'cli', evento: item.id, acao: 'evento.expirado', detalhe: { motivo: item.motivo, idadeDias: item.idadeDias, resumo: r.resumo } });
    registrarExclusao(dirDados, { id: item.id, motivo: `retencao:${item.motivo}`, em });
  }
  console.log(`Apagados ${apagados} de ${plano.length} evento(s) vencido(s); avisados ${avisos.length}.`);
} finally {
  store.close();
}
