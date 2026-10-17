'use strict';
// Anti-spam da criação aberta de eventos: Turnstile opcional + rate limit por
// hash de IP e por e-mail. Sem chaves em desenvolvimento, o Turnstile fica
// desligado; em produção, a configuração é exigida (falha ao subir sem ela).
const { createTurnstile } = require('./turnstile');
const { createLimites } = require('./limites');

function producao(env = process.env) {
  return env.NODE_ENV === 'production' || /^https:\/\//i.test(env.PUBLIC_URL || '');
}

function createAntispam({ env = process.env, agora, fetchImpl, config, turnstile } = {}) {
  const siteKey = env.TURNSTILE_SITE_KEY || '';
  const secret = env.TURNSTILE_SECRET || '';
  const t = turnstile || createTurnstile({ siteKey, secret, fetchImpl });
  const limites = createLimites({ env, agora, config });

  const checar = (req, body = {}) => limites.checar({ ip: req && req.ip, email: body && body.contato });
  const registrar = (chaves) => limites.registrar(chaves);
  const verificarToken = (token, ip) => t.verificar(token, ip);

  function exigirConfigProducao() {
    if (!producao(env)) return;
    if (!siteKey || !secret)
      throw new Error('Anti-spam: em produção defina TURNSTILE_SITE_KEY e TURNSTILE_SECRET (o cadastro aberto exige anti-robô).');
    if (!/^https:\/\//i.test(t.url))
      throw new Error('Anti-spam: a verificação do Turnstile precisa de um endpoint https.');
  }

  return {
    checar, registrar, verificarToken, exigirConfigProducao,
    siteKey: siteKey || null, turnstileAtivo: t.enabled,
  };
}

module.exports = { createAntispam, producao };
