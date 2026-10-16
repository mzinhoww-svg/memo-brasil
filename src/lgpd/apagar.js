// Exclusão de um evento em cascata: arquivos de foto e o registro no banco.
// Exige confirmação pelo próprio id (feita pelo script) e nunca toca em outro evento.
const fs = require('fs');
const { caminhoFotos, resumoEvento } = require('./dados');

function apagarEvento({ db, dataDir, id, confirmar }) {
  if (!id) return { ok: false, motivo: 'sem-id' };
  if (confirmar !== id) return { ok: false, motivo: 'confirmacao-invalida' };
  const eventos = db.events || {};
  const alvo = eventos[id];
  if (!alvo) return { ok: false, motivo: 'nao-encontrado' };
  const resumo = resumoEvento(alvo);
  fs.rmSync(caminhoFotos(dataDir, id), { recursive: true, force: true });
  delete eventos[id];
  return { ok: true, resumo };
}

module.exports = { apagarEvento };
