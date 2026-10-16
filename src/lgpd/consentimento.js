// Registro do consentimento do convidado (LGPD, art. 8º, §2º).
// Guarda o mínimo necessário para provar o aceite: versão do texto, data/hora (UTC)
// e o que foi aceito, sempre ligado ao id anônimo do convidado. Nunca guarda IP.
const VERSAO_PADRAO = 'consentimento-convidado v0.1';
const MAX_REGISTROS_POR_EVENTO = 20000;

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
// undefined/null viram null ("não informado") para não presumir consentimento.
const booleano = (v) => (v === undefined || v === null ? null : !!v);

function registrarConsentimento(ev, guest, entrada, agora = new Date()) {
  const c = entrada && typeof entrada === 'object' ? entrada : {};
  const registro = {
    guestId: guest.id,
    versao: texto(c.versao, 80) || VERSAO_PADRAO,
    fotos: booleano(c.fotos),
    avisos: booleano(c.avisos),
    em: agora.toISOString(),
  };
  guest.consentimento = registro;
  if (!Array.isArray(ev.consentimentos)) ev.consentimentos = [];
  ev.consentimentos.push(registro);
  if (ev.consentimentos.length > MAX_REGISTROS_POR_EVENTO)
    ev.consentimentos.splice(0, ev.consentimentos.length - MAX_REGISTROS_POR_EVENTO);
  return registro;
}

module.exports = { VERSAO_PADRAO, MAX_REGISTROS_POR_EVENTO, registrarConsentimento };
