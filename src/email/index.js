// Envio de e-mail do Lume.
//
// Interface: `enviar({ para, assunto, texto, html })` → `{ ok, id, provedor }`.
// Provedores:
//   - console (padrão): registra a mensagem no log e a guarda em memória (útil em dev e em teste).
//   - resend: POST https://api.resend.com/emails usando EMAIL_API_KEY e EMAIL_FROM.
//
// Sem chave em produção o envio NÃO inicia: `criarEmail()` lança ErroEmail com a variável
// que falta, e quem chama registra o erro e segue com o envio desativado (`emailDesativado`).
'use strict';

class ErroEmail extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroEmail';
  }
}

// Token de acesso é segredo: nunca pode aparecer em log (nem no provedor de console).
const TOKEN_NA_URL = /([?&](?:token|t)=|#t=)[A-Za-z0-9_\-%.]+/g;
const redigir = (texto) => String(texto ?? '').replace(TOKEN_NA_URL, '$1***');

function provedorConsole({ log = console.log, agora = () => new Date() } = {}) {
  const enviados = [];
  return {
    nome: 'console',
    enviados,
    async enviar({ para, assunto, texto, html } = {}) {
      if (!para || !assunto) throw new ErroEmail('E-mail sem destinatário ou assunto.');
      const msg = { para, assunto, texto: String(texto ?? ''), html: html || '', enviadoEm: agora().toISOString() };
      enviados.push(msg);
      log(`[email:console] para=${para} assunto=${redigir(assunto)}\n${redigir(msg.texto)}`);
      return { ok: true, id: `console-${enviados.length}`, provedor: 'console' };
    },
  };
}

function provedorResend({
  apiKey, from,
  httpPost = globalThis.fetch,
  endpoint = 'https://api.resend.com/emails',
} = {}) {
  if (!apiKey) throw new ErroEmail('EMAIL_API_KEY ausente: o envio de e-mail não pode iniciar.');
  if (!from) throw new ErroEmail('EMAIL_FROM ausente: o envio de e-mail não pode iniciar.');
  return {
    nome: 'resend',
    async enviar({ para, assunto, texto, html } = {}) {
      if (!para || !assunto) throw new ErroEmail('E-mail sem destinatário ou assunto.');
      const r = await httpPost(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [para], subject: assunto, text: String(texto ?? ''), ...(html ? { html } : {}) }),
      });
      if (!r.ok) {
        const detalhe = typeof r.text === 'function' ? await r.text().catch(() => '') : '';
        throw new ErroEmail(`Resend recusou o e-mail (HTTP ${r.status}): ${String(detalhe).slice(0, 200)}`);
      }
      const dados = typeof r.json === 'function' ? await r.json().catch(() => ({})) : {};
      return { ok: true, id: dados?.id || null, provedor: 'resend' };
    },
  };
}

// Provedor inerte: existe para o resto do sistema seguir rodando com o envio desligado.
function emailDesativado(erro) {
  return {
    nome: 'desativado',
    desativadoPor: erro?.message || String(erro || 'erro desconhecido'),
    async enviar() { throw new ErroEmail(this.desativadoPor); },
  };
}

function criarEmail(env = process.env, opts = {}) {
  const nome = String(env.EMAIL_PROVEDOR || 'console').trim().toLowerCase();
  if (nome === 'console') return provedorConsole(opts);
  if (nome === 'resend') return provedorResend({ apiKey: env.EMAIL_API_KEY, from: env.EMAIL_FROM, ...opts });
  throw new ErroEmail(`Provedor de e-mail desconhecido: "${nome}". Use "console" ou "resend".`);
}

module.exports = { criarEmail, provedorConsole, provedorResend, emailDesativado, redigir, ErroEmail };
