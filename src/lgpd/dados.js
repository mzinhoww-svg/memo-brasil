// Utilitários de dados usados pelos comandos de LGPD (exportar, apagar, retenção).
// Os scripts rodam contra o mesmo DATA_DIR do servidor e nunca imprimem dados pessoais.
const path = require('path');

// Chaves que nunca podem sair em uma exportação nem entrar em log.
// hostToken e o token da equipe dão acesso ao painel; push/sub/keys são inscrições do aparelho.
const CHAVES_SENSIVEIS = new Set([
  'hostToken', 'hostTokenHash', 'token', 'tokenHash', 'guestToken', 'guestTokenHash',
  'push', 'sub', 'subscription', 'keys', 'p256dh', 'auth',
  'endpoint', 'privateKey', 'senha', 'password', 'session',
]);

// Eventos gravados por versões antigas ganham os campos novos antes de qualquer uso.
function normalizarEvento(ev) {
  Object.assign(ev, {
    guests: ev.guests || [], photos: ev.photos || [], lista: ev.lista || [],
    recados: ev.recados || [], equipe: ev.equipe || [], push: ev.push || [],
    avisos: ev.avisos || [], denuncias: ev.denuncias || [],
    consentimentos: ev.consentimentos || [], limites: ev.limites || {},
    cronograma: ev.cronograma || [], config: ev.config || {},
  });
  return ev;
}

// Cópia profunda sem nenhum segredo (tokens, inscrições push, chaves).
function limparSegredos(valor) {
  if (Array.isArray(valor)) return valor.map(limparSegredos);
  if (valor && typeof valor === 'object') {
    const saida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (CHAVES_SENSIVEIS.has(k)) continue;
      saida[k] = limparSegredos(v);
    }
    return saida;
  }
  return valor;
}

const caminhoFotos = (dataDir, id) => path.join(dataDir, 'photos', id);

// Contagens sem PII, para log e para a linha de auditoria da exclusão.
function resumoEvento(ev) {
  return {
    fotos: (ev.photos || []).length,
    convidados: (ev.guests || []).length,
    lista: (ev.lista || []).length,
    recados: (ev.recados || []).length,
    equipe: (ev.equipe || []).length,
    denuncias: (ev.denuncias || []).length,
    consentimentos: (ev.consentimentos || []).length,
    push: (ev.push || []).length,
  };
}

module.exports = { CHAVES_SENSIVEIS, normalizarEvento, limparSegredos, caminhoFotos, resumoEvento };
