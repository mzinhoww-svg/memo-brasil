// Registro do consentimento do convidado (LGPD, art. 8º, §2º).
// O servidor exige o aceite das fotos e a versão vigente do texto; guardamos o
// mínimo para provar o aceite: versão, data/hora (UTC) e as caixas marcadas,
// ligados ao id anônimo do convidado. Nunca guardamos IP.
const crypto = require('crypto');

const VERSAO_PADRAO = 'consentimento-convidado v0.1';

const texto = (v, max) => String(v ?? '').trim().slice(0, max);

function validarConsentimento(entrada) {
  if (!entrada || typeof entrada !== 'object') {
    return { ok: false, erro: 'Para entrar, aceite o aviso de que suas fotos serão vistas por todos os convidados.' };
  }
  if (entrada.fotos !== true) {
    return { ok: false, erro: 'Para entrar, marque o aceite sobre o uso das suas fotos.' };
  }
  if (texto(entrada.versao, 80) !== VERSAO_PADRAO) {
    return { ok: false, erro: 'O texto do consentimento mudou. Recarregue a página e aceite de novo.' };
  }
  return { ok: true, valor: { versao: VERSAO_PADRAO, fotos: true, avisos: entrada.avisos === true } };
}

function registrarConsentimento(ev, guest, valor, agora = new Date()) {
  const registro = {
    id: crypto.randomBytes(6).toString('base64url'),
    guestId: guest.id,
    versao: valor.versao,
    fotos: valor.fotos === true,
    avisos: valor.avisos === true,
    em: agora.toISOString(),
  };
  guest.consentimento = registro;
  if (!Array.isArray(ev.consentimentos)) ev.consentimentos = [];
  // Prova do aceite: nunca truncar (o registro mais antigo também importa).
  ev.consentimentos.push(registro);
  return registro;
}

module.exports = { VERSAO_PADRAO, validarConsentimento, registrarConsentimento };
