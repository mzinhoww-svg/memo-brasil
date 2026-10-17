'use strict';
// Limite simples de tentativas por IP, em memória.
//
// Usado para frear quem varre tokens de convidado em rota pública: cada falha
// de credencial conta; passado o limite dentro da janela, respondemos 429 sem
// tocar no store. É por IP do processo (atrás de proxy, configure `trust proxy`
// para `req.ip` refletir o cliente real). Um acerto zera o balde do IP.

function criarLimite({ max = 20, janelaMs = 10 * 60 * 1000, maxIps = 10000 } = {}) {
  const baldes = new Map(); // ip -> { n, ate }

  function atingiu(ip, agora = Date.now()) {
    const b = baldes.get(ip);
    return !!b && agora < b.ate && b.n >= max;
  }

  function falhou(ip, agora = Date.now()) {
    const b = baldes.get(ip);
    if (!b || agora >= b.ate) baldes.set(ip, { n: 1, ate: agora + janelaMs });
    else b.n += 1;
    if (baldes.size > maxIps) {
      for (const [k, v] of baldes) if (agora >= v.ate) baldes.delete(k);
    }
  }

  function limpou(ip) {
    baldes.delete(ip);
  }

  return { atingiu, falhou, limpou, max, janelaMs };
}

module.exports = { criarLimite };
