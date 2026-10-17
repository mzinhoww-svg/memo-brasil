// Envio de e-mail do Lume.
//
// Interface única (usada pelo link mágico do organizador e pelo aviso de revelação):
//   `enviar({ para, assunto, texto, html })` → `{ ok, id, provedor }`
//
// Provedores (`EMAIL_PROVIDER`, aceitando também o antigo `EMAIL_PROVEDOR`):
//   - smtp (produção): Brevo via SMTP em smtp-relay.brevo.com:587 com STARTTLS,
//     com SMTP_USER/SMTP_PASS e remetente em EMAIL_FROM (ou MAIL_FROM).
//   - console (padrão em dev/teste): registra no log e guarda em memória. Em
//     produção é recusado — fail-closed — salvo EMAIL_CONSOLE_PERMITIDO=sim.
//   - resend: alternativa por HTTP (EMAIL_API_KEY/EMAIL_FROM).
//
// Sem credencial o envio NÃO inicia: `criarEmail()` lança ErroEmail dizendo qual
// variável falta; quem chama registra o erro e segue com `emailDesativado`.
//
// PII: log nunca mostra endereço completo nem link com token de acesso.
'use strict';

const nodemailer = require('nodemailer');

class ErroEmail extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroEmail';
  }
}

// ───── PII: mascara endereço antes de qualquer log ──────────────────────────
// "rafa@exemplo.com" → "ra**@e**.com"
function mascararEmail(endereco) {
  const s = String(endereco || '').trim();
  const i = s.lastIndexOf('@');
  if (i <= 0) return s ? '***' : '';
  const local = s.slice(0, i);
  const dominio = s.slice(i + 1);
  const partes = dominio.split('.');
  const dominioMascarado = partes.map((p, k) => (k === partes.length - 1 ? p : `${p.slice(0, 1)}**`)).join('.');
  return `${local.slice(0, 2)}**@${dominioMascarado}`;
}

// Mascara todo endereço que apareça num texto (erros de SMTP costumam citar o destinatário).
const mascararEmails = (texto) =>
  String(texto ?? '').replace(/[^\s<>()"'`,;:]+@[^\s<>()"'`,;:]+/g, (achado) => mascararEmail(achado));

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
      log(`[email:console] para=${mascararEmail(para)} assunto=${redigir(assunto)}\n${redigir(msg.texto)}`);
      return { ok: true, id: `console-${enviados.length}`, provedor: 'console' };
    },
  };
}

function provedorSmtp({
  host = 'smtp-relay.brevo.com',
  port = 587,
  user,
  pass,
  from,
  timeoutMs = 10000,
  criarTransporte = (opcoes) => nodemailer.createTransport(opcoes),
} = {}) {
  if (!user) throw new ErroEmail('SMTP_USER ausente: o envio de e-mail não pode iniciar.');
  if (!pass) throw new ErroEmail('SMTP_PASS ausente: o envio de e-mail não pode iniciar.');
  if (!from) throw new ErroEmail('EMAIL_FROM (ou MAIL_FROM) ausente: o envio de e-mail não pode iniciar.');

  const porta = Number(port) || 587;
  const transporte = criarTransporte({
    host: host || 'smtp-relay.brevo.com',
    port: porta,
    secure: porta === 465,          // 465 = TLS direto; 587 = STARTTLS obrigatório
    requireTLS: porta !== 465,
    auth: { user, pass },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });

  return {
    nome: 'smtp',
    transporte,
    async enviar({ para, assunto, texto, html } = {}) {
      if (!para || !assunto) throw new ErroEmail('E-mail sem destinatário ou assunto.');
      try {
        const r = await transporte.sendMail({
          from, to: para, subject: assunto, text: String(texto ?? ''), ...(html ? { html } : {}),
        });
        return { ok: true, id: r?.messageId || null, provedor: 'smtp' };
      } catch (e) {
        // A mensagem de erro pode citar o destinatário: sai mascarada do log.
        throw new ErroEmail(`SMTP recusou o e-mail: ${mascararEmails(e?.message || e).slice(0, 200)}`);
      }
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
        throw new ErroEmail(`Resend recusou o e-mail (HTTP ${r.status}): ${mascararEmails(detalhe).slice(0, 200)}`);
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
  const nome = String(env.EMAIL_PROVIDER || env.EMAIL_PROVEDOR || 'console').trim().toLowerCase();
  const producao = String(env.NODE_ENV || '').toLowerCase() === 'production';

  if (nome === 'console') {
    // Fail-closed: em produção o console não entrega nada; recusar é melhor que
    // fingir que enviou. Só passa com autorização explícita (ex.: ensaio de deploy).
    if (producao && env.EMAIL_CONSOLE_PERMITIDO !== 'sim') {
      throw new ErroEmail('Em produção o provedor console é recusado: use EMAIL_PROVIDER=smtp (ou EMAIL_CONSOLE_PERMITIDO=sim para ensaio).');
    }
    return provedorConsole(opts);
  }
  if (nome === 'smtp' || nome === 'brevo') {
    return provedorSmtp({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.EMAIL_FROM || env.MAIL_FROM,
      timeoutMs: Number(env.SMTP_TIMEOUT_MS) || undefined,
      ...opts,
    });
  }
  if (nome === 'resend') {
    return provedorResend({ apiKey: env.EMAIL_API_KEY, from: env.EMAIL_FROM || env.MAIL_FROM, ...opts });
  }
  throw new ErroEmail(`Provedor de e-mail desconhecido: "${nome}". Use "smtp", "console" ou "resend".`);
}

module.exports = {
  criarEmail, provedorConsole, provedorSmtp, provedorResend, emailDesativado,
  redigir, mascararEmail, mascararEmails, ErroEmail,
};
