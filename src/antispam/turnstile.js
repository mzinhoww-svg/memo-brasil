'use strict';
// Cloudflare Turnstile opcional, sem dependência nova.
// Verificação server-side por fetch com timeout. Sem chaves (TURNSTILE_SITE_KEY
// e TURNSTILE_SECRET), fica desligado e a verificação é no-op. Fail-closed:
// se a verificação falhar por rede/timeout, a criação é bloqueada.
const URL_PADRAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function createTurnstile({
  siteKey,
  secret,
  fetchImpl = globalThis.fetch,
  url = process.env.TURNSTILE_VERIFY_URL || URL_PADRAO,
  timeoutMs = parseInt(process.env.TURNSTILE_TIMEOUT_MS, 10) || 5000,
} = {}) {
  const enabled = !!(siteKey && secret);
  const endpoint = url || URL_PADRAO;

  async function verificar(token, ip) {
    if (!enabled) return { ok: true, desligado: true };
    if (!token || typeof token !== 'string') return { ok: false, erro: 'Confirme que você não é um robô.' };

    const corpo = new URLSearchParams();
    corpo.set('secret', secret);
    corpo.set('response', token);
    if (ip) corpo.set('remoteip', String(ip).replace(/^::ffff:/, ''));

    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const r = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: corpo,
        signal: ctrl ? ctrl.signal : undefined,
      });
      const dados = await r.json();
      return dados && dados.success
        ? { ok: true }
        : { ok: false, erro: 'Não conseguimos confirmar que você não é um robô. Tente de novo.' };
    } catch {
      return { ok: false, erro: 'Não foi possível validar o anti-robô agora. Tente de novo em instantes.' };
    } finally { if (timer) clearTimeout(timer); }
  }

  return { enabled, verificar, url: endpoint };
}

module.exports = { createTurnstile, URL_PADRAO };
