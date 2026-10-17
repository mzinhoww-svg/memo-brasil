'use strict';
// Limites de armazenamento por evento.
// MAX_FOTOS_EVENTO é o teto de fotos por evento (env, padrão 3000). O limite
// configurado (por evento em ev.limites.maxFotos, ou global em
// settings.maxFotosPorEvento) só pode APERTAR esse teto, nunca ultrapassá-lo.
const TETO_PADRAO_FOTOS_EVENTO = 3000;

function tetoFotosEvento(env = process.env) {
  const n = parseInt(env && env.MAX_FOTOS_EVENTO, 10);
  return Number.isFinite(n) && n > 0 ? n : TETO_PADRAO_FOTOS_EVENTO;
}

function limFotosEvento(ev, settings = {}, env = process.env) {
  const teto = tetoFotosEvento(env);
  const configurado = ev && ev.limites && ev.limites.maxFotos != null
    ? ev.limites.maxFotos
    : (settings && settings.maxFotosPorEvento != null ? settings.maxFotosPorEvento : teto);
  const n = parseInt(configurado, 10);
  return Math.max(1, Math.min(Number.isFinite(n) && n > 0 ? n : teto, teto));
}

// Estimativa (pior caso) de disco por evento, em bytes.
function estimativaDiscoBytes(fotos, tamanhoMaxFotoMB) {
  return (Number(fotos) || 0) * (Number(tamanhoMaxFotoMB) || 0) * 1024 * 1024;
}

module.exports = { TETO_PADRAO_FOTOS_EVENTO, tetoFotosEvento, limFotosEvento, estimativaDiscoBytes };
