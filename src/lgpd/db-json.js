// Acesso ao db.json do servidor pelos scripts de linha de comando (exportar, apagar, retenção).
// Mantém o mesmo formato de auditoria usado pelo servidor: { t, quem, evento, acao, ... }.
const fs = require('fs');
const path = require('path');
const { normalizarEvento } = require('./dados');

function carregarDb(dataDir) {
  const arquivo = path.join(dataDir, 'db.json');
  let db = { events: {} };
  try { db = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { db = { events: {} }; }
  db.events = db.events || {};
  for (const ev of Object.values(db.events)) normalizarEvento(ev);
  return db;
}

function salvarDb(dataDir, db) {
  const arquivo = path.join(dataDir, 'db.json');
  const tmp = arquivo + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, arquivo);
}

function registrarAuditoria(dataDir, { quem = 'cli', evento = null, acao, detalhe = {} } = {}) {
  const linha = JSON.stringify({ t: new Date().toISOString(), quem, evento, acao, ...detalhe });
  fs.appendFileSync(path.join(dataDir, 'audit.log'), linha + '\n');
  return linha;
}

module.exports = { carregarDb, salvarDb, registrarAuditoria };
