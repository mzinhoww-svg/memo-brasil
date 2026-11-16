// Auditoria dos comandos de linha de comando e lista de exclusões para reaplicar
// depois de um restore. Só ids e metadados: nunca nome, e-mail, motivo de denúncia ou imagem.
const fs = require('fs');
const path = require('path');

function registrarAuditoria(dataDir, { quem = 'cli', evento = null, acao, detalhe = {} } = {}) {
  const linha = JSON.stringify({ t: new Date().toISOString(), quem, evento, acao, ...detalhe });
  fs.appendFileSync(path.join(dataDir, 'audit.log'), linha + '\n');
  return linha;
}

// Túmulo da exclusão: um restore de backup não pode ressuscitar o que foi apagado.
// O operador reaplica esta lista depois de restaurar (ver docs/lgpd.md).
function registrarExclusao(dataDir, { id, motivo = 'desconhecido', em = new Date().toISOString() }) {
  if (!id) return null;
  const linha = JSON.stringify({ id, motivo, em });
  fs.appendFileSync(path.join(dataDir, 'excluidos.log'), linha + '\n');
  return linha;
}

module.exports = { registrarAuditoria, registrarExclusao };
