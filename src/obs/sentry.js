'use strict';
// Cliente Sentry mínimo, opcional, sem dependência nova.
// Se SENTRY_DSN existir, envia erros não tratados via fetch ao endpoint de
// envelope do Sentry. Se não existir, é no-op. Nunca envia o corpo da
// requisição nem dado pessoal: apenas tipo, mensagem e pilha do erro.
const crypto = require('crypto');

const CLIENTE = 'memo-brasil/1.0.0';

function parseDsn(dsn) {
  if (!dsn || typeof dsn !== 'string') return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, '');
    if (!u.username || !u.host || !projectId) return null;
    const protocolo = u.protocol === 'http:' ? 'http' : 'https';
    return {
      publicKey: decodeURIComponent(u.username),
      projectId,
      envelopeUrl: `${protocolo}://${u.host}/api/${encodeURIComponent(projectId)}/envelope/`,
    };
  } catch { return null; }
}

// Converte a pilha em frames aceitos pelo Sentry (só nomes de arquivo/linha).
function framesDaPilha(stack) {
  if (!stack) return undefined;
  const frames = [];
  for (const linha of String(stack).split('\n').slice(1)) {
    const m = /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(linha.trim());
    if (m) frames.push({ function: m[1] || '<anônimo>', filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) });
  }
  return frames.length ? { frames: frames.reverse() } : undefined;
}

// Nunca enviamos o corpo da requisição. Erros de parsing do corpo (JSON
// malformado) carregam o conteúdo bruto em err.message/err.body — nesses casos
// usamos uma mensagem genérica para não vazar dado pessoal ao Sentry.
function ehErroDeCorpo(err) {
  return !!err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large'
    || Object.prototype.hasOwnProperty.call(err, 'body'));
}
function mensagemSegura(err) {
  if (ehErroDeCorpo(err)) return 'Corpo da requisição inválido (JSON malformado).';
  return String(err && err.message != null ? err.message : (err ?? '')).slice(0, 500);
}

function erroParaEvento(err, { eventId, version, ambiente, tags } = {}) {
  const e = err instanceof Error ? err : new Error(err && err.message ? String(err.message) : String(err));
  const values = [{ type: e.name || 'Error', value: mensagemSegura(e) }];
  const stacktrace = framesDaPilha(e.stack);
  if (stacktrace) values[0].stacktrace = stacktrace;
  return {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    level: 'error',
    platform: 'node',
    logger: 'memo-brasil',
    release: `memo-brasil@${version}`,
    environment: ambiente,
    tags: { app: 'memo-brasil', ...(tags || {}) },
    exception: { values },
  };
}

// Envelope do Sentry: cabeçalho JSON, cabeçalho do item, payload do evento.
function buildEnvelope(dsn, event, eventId) {
  const payload = JSON.stringify(event);
  const cabecalho = JSON.stringify({ event_id: eventId, dsn, sent_at: new Date().toISOString() });
  const item = JSON.stringify({ type: 'event', content_type: 'application/json', length: Buffer.byteLength(payload) });
  return `${cabecalho}\n${item}\n${payload}\n`;
}

function createSentry({
  dsn = process.env.SENTRY_DSN,
  fetchImpl = globalThis.fetch,
  version = '0.0.0',
  ambiente = process.env.NODE_ENV || 'production',
  timeoutMs = 2000,
} = {}) {
  const parsed = parseDsn(dsn);
  const enabled = !!parsed && typeof fetchImpl === 'function';

  async function captureException(err, extra = {}) {
    if (!enabled) return { enviado: false };
    const eventId = crypto.randomBytes(16).toString('hex');
    const corpo = buildEnvelope(dsn, erroParaEvento(err, { eventId, version, ambiente, tags: extra.tags }), eventId);
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      await fetchImpl(parsed.envelopeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=${CLIENTE}`,
        },
        body: corpo,
        signal: ctrl ? ctrl.signal : undefined,
      });
      return { enviado: true, eventId };
    } catch { return { enviado: false, eventId }; }
    finally { if (timer) clearTimeout(timer); }
  }

  // Erros não tratados no processo. Só registra se o Sentry estiver ligado.
  function installProcessHooks() {
    if (!enabled) return () => {};
    const onRejeicao = (motivo) => { void captureException(motivo); };
    const onExcecao = (err) => { void captureException(err).finally(() => process.exit(1)); };
    process.on('unhandledRejection', onRejeicao);
    process.on('uncaughtException', onExcecao);
    return () => { process.off('unhandledRejection', onRejeicao); process.off('uncaughtException', onExcecao); };
  }

  return { enabled, captureException, installProcessHooks };
}

module.exports = { createSentry, parseDsn, buildEnvelope, erroParaEvento, mensagemSegura, ehErroDeCorpo };
