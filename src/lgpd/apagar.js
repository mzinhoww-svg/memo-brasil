// Exclusão de um evento em cascata pelo Store (SQLite): banco + arquivos de foto.
// Exige confirmação pelo próprio id (feita pelo script) e nunca toca em outro evento.
const { resumoEvento } = require('./dados');

function apagarEvento({ store, id, confirmar }) {
  if (!id) return { ok: false, motivo: 'sem-id' };
  if (confirmar !== id) return { ok: false, motivo: 'confirmacao-invalida' };
  const ev = store.db.events[id];
  if (!ev) return { ok: false, motivo: 'nao-encontrado' };
  const resumo = resumoEvento(ev);
  // deleteEvent faz o DELETE no SQLite (FK/trigger em cascata nas linhas filhas)
  // e remove o diretório de fotos do evento.
  if (!store.deleteEvent(id)) return { ok: false, motivo: 'nao-encontrado' };
  return { ok: true, resumo };
}

module.exports = { apagarEvento };
