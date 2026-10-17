// Testes do provedor de e-mail: SMTP (Brevo), console (dev) e Resend.
// Nenhum valor real: transporte falso e HTTP falso.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  criarEmail, provedorConsole, provedorSmtp, emailDesativado,
  mascararEmail, mascararEmails, redigir, ErroEmail,
} = require('../src/email');

test('console é o provedor padrão em dev/teste e guarda o que foi enviado', async () => {
  const linhas = [];
  const email = criarEmail({}, { log: (l) => linhas.push(l) });
  assert.equal(email.nome, 'console');
  const r = await email.enviar({ para: 'noivos@exemplo.com', assunto: 'Oi', texto: 'Corpo do e-mail', html: '<p>Corpo</p>' });
  assert.equal(r.ok, true);
  assert.equal(email.enviados.length, 1);
  assert.equal(email.enviados[0].para, 'noivos@exemplo.com');
  assert.equal(linhas.length, 1);
});

test('console é recusado em produção (fail-closed), salvo autorização explícita', () => {
  assert.throws(() => criarEmail({ NODE_ENV: 'production' }), (e) => e instanceof ErroEmail && /console/i.test(e.message));
  assert.throws(() => criarEmail({ NODE_ENV: 'production', EMAIL_PROVIDER: 'console' }), ErroEmail);
  const liberado = criarEmail({ NODE_ENV: 'production', EMAIL_CONSOLE_PERMITIDO: 'sim' }, { log: () => {} });
  assert.equal(liberado.nome, 'console');
});

test('log nunca mostra endereço completo (PII) nem link com token', async () => {
  const linhas = [];
  const email = criarEmail({}, { log: (l) => linhas.push(l) });
  await email.enviar({
    para: 'rafaela.souza@exemplo.com',
    assunto: 'Painel',
    texto: 'Abra http://lume.app/painel/abc#t=SEGREDO123 e http://lume.app/api?token=OUTROSEGREDO.',
    html: '<a href="http://lume.app/painel/abc#t=SEGREDO123">painel</a>',
  });
  const saida = linhas.join('\n');
  assert.ok(!saida.includes('rafaela.souza@exemplo.com'), 'endereço completo não pode ir para o log');
  assert.ok(saida.includes('ra**@e**.com'), `esperava endereço mascarado, veio: ${saida}`);
  assert.ok(!saida.includes('SEGREDO123') && !saida.includes('OUTROSEGREDO'));
  assert.ok(saida.includes('token=***'));
  // O que foi entregue de fato continua íntegro; só o log é redigido.
  assert.equal(email.enviados[0].para, 'rafaela.souza@exemplo.com');
  assert.ok(email.enviados[0].texto.includes('SEGREDO123'));
});

test('mascararEmail e mascararEmails protegem o endereço em qualquer texto', () => {
  assert.equal(mascararEmail('rafa@exemplo.com'), 'ra**@e**.com');
  assert.equal(mascararEmail('a@b.co'), 'a**@b**.co');
  assert.equal(mascararEmail('sem-arroba'), '***');
  assert.equal(mascararEmail(''), '');
  assert.equal(mascararEmails('falha ao entregar para rafa@exemplo.com (550)'), 'falha ao entregar para ra**@e**.com (550)');
});

test('redigir mascara token= e #t= sem mexer no resto do texto', () => {
  assert.equal(redigir('veja http://x/painel/1#t=AbC-123_fim ok'), 'veja http://x/painel/1#t=*** ok');
  assert.equal(redigir('/api/events/1/photos/2/file?token=Zz9'), '/api/events/1/photos/2/file?token=***');
  assert.equal(redigir('sem token aqui'), 'sem token aqui');
});

test('SMTP (Brevo) envia com STARTTLS na 587 e credenciais próprias', async () => {
  const chamadas = [];
  let opcoesTransporte = null;
  const env = {
    EMAIL_PROVIDER: 'smtp', SMTP_USER: 'usuario-de-teste', SMTP_PASS: 'senha-de-teste',
    EMAIL_FROM: 'Lume <ola@exemplo.com>',
  };
  const email = criarEmail(env, {
    criarTransporte: (opcoes) => {
      opcoesTransporte = opcoes;
      return { sendMail: async (msg) => { chamadas.push(msg); return { messageId: 'smtp-1' }; } };
    },
  });
  assert.equal(email.nome, 'smtp');
  assert.equal(opcoesTransporte.host, 'smtp-relay.brevo.com');
  assert.equal(opcoesTransporte.port, 587);
  assert.equal(opcoesTransporte.secure, false, '587 usa STARTTLS, não TLS direto');
  assert.equal(opcoesTransporte.requireTLS, true);
  assert.deepEqual(opcoesTransporte.auth, { user: 'usuario-de-teste', pass: 'senha-de-teste' });

  const r = await email.enviar({ para: 'noivos@exemplo.com', assunto: 'Seu álbum', texto: 't', html: '<p>t</p>' });
  assert.equal(r.id, 'smtp-1');
  assert.equal(r.provedor, 'smtp');
  assert.deepEqual(chamadas[0], { from: 'Lume <ola@exemplo.com>', to: 'noivos@exemplo.com', subject: 'Seu álbum', text: 't', html: '<p>t</p>' });
});

test('SMTP aceita MAIL_FROM, host/porta por variável e 465 como TLS direto', async () => {
  let opcoes = null;
  criarEmail(
    { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.outro.com', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'a@b.co' },
    { criarTransporte: (o) => { opcoes = o; return { sendMail: async () => ({ messageId: 'x' }) }; } },
  );
  assert.equal(opcoes.host, 'smtp.outro.com');
  assert.equal(opcoes.port, 465);
  assert.equal(opcoes.secure, true);
  assert.equal(opcoes.requireTLS, false);
});

test('SMTP sem credencial não inicia, com erro claro; erro de SMTP não vaza o endereço', async () => {
  assert.throws(() => criarEmail({ EMAIL_PROVIDER: 'smtp', SMTP_PASS: 'p', EMAIL_FROM: 'a@b.co' }), /SMTP_USER/);
  assert.throws(() => criarEmail({ EMAIL_PROVIDER: 'smtp', SMTP_USER: 'u', EMAIL_FROM: 'a@b.co' }), /SMTP_PASS/);
  assert.throws(() => criarEmail({ EMAIL_PROVIDER: 'smtp', SMTP_USER: 'u', SMTP_PASS: 'p' }), /EMAIL_FROM/);

  const email = criarEmail(
    { EMAIL_PROVIDER: 'smtp', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_FROM: 'a@b.co' },
    { criarTransporte: () => ({ sendMail: async () => { throw new Error('550 recusado: noivos@exemplo.com'); } }) },
  );
  await assert.rejects(() => email.enviar({ para: 'noivos@exemplo.com', assunto: 'x', texto: 'y' }), (e) => {
    assert.match(e.message, /SMTP recusou/);
    assert.ok(!e.message.includes('noivos@exemplo.com'), 'endereço não pode aparecer no erro logado');
    return true;
  });
});

test('EMAIL_PROVEDOR (nome antigo) e "brevo" continuam aceitos', () => {
  const criar = (env) => criarEmail(env, { criarTransporte: () => ({ sendMail: async () => ({}) }) });
  assert.equal(criar({ EMAIL_PROVIDER: 'brevo', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_FROM: 'a@b.co' }).nome, 'smtp');
  assert.equal(criar({ EMAIL_PROVEDOR: 'smtp', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_FROM: 'a@b.co' }).nome, 'smtp');
  assert.equal(criar({ EMAIL_PROVEDOR: 'console' }).nome, 'console');
});

test('Resend (alternativa HTTP) envia com EMAIL_API_KEY e EMAIL_FROM', async () => {
  const chamadas = [];
  const email = criarEmail(
    { EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'chave-de-teste', EMAIL_FROM: 'Lume <ola@lume.app>' },
    { httpPost: async (url, init) => { chamadas.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: 'msg_1' }) }; } },
  );
  assert.equal(email.nome, 'resend');
  const r = await email.enviar({ para: 'noivos@exemplo.com', assunto: 'Seu álbum', texto: 't', html: '<p>t</p>' });
  assert.equal(r.id, 'msg_1');
  const { url, init } = chamadas[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.headers.authorization, 'Bearer chave-de-teste');
  const corpo = JSON.parse(init.body);
  assert.deepEqual(corpo.to, ['noivos@exemplo.com']);
  assert.equal(corpo.from, 'Lume <ola@lume.app>');
});

test('sem chave ou remetente o envio não inicia, com erro claro', () => {
  assert.throws(
    () => criarEmail({ NODE_ENV: 'production', EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'a@b.c' }),
    (e) => e instanceof ErroEmail && /EMAIL_API_KEY/.test(e.message),
  );
  assert.throws(
    () => criarEmail({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k' }),
    (e) => e instanceof ErroEmail && /EMAIL_FROM/.test(e.message),
  );
});

test('provedor desconhecido não inicia', () => {
  assert.throws(() => criarEmail({ EMAIL_PROVIDER: 'pombo-correio' }), /desconhecido/i);
});

test('erro do Resend vira ErroEmail com o status e sem endereço completo', async () => {
  const email = criarEmail(
    { EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k', EMAIL_FROM: 'a@b.c' },
    { httpPost: async () => ({ ok: false, status: 422, text: async () => 'destinatário inválido: rafa@exemplo.com' }) },
  );
  await assert.rejects(() => email.enviar({ para: 'x@y.z', assunto: 'y', texto: 'z' }), (e) => {
    assert.match(e.message, /422/);
    assert.ok(!e.message.includes('rafa@exemplo.com'));
    return true;
  });
});

test('console recusa mensagem sem destinatário; provedor desativado falha com o motivo', async () => {
  const email = provedorConsole({ log: () => {} });
  await assert.rejects(() => email.enviar({ assunto: 'sem para', texto: 't' }), ErroEmail);
  const desligado = emailDesativado(new ErroEmail('SMTP_USER ausente.'));
  assert.equal(desligado.nome, 'desativado');
  await assert.rejects(() => desligado.enviar({ para: 'a@b.co', assunto: 'x', texto: 'y' }), /SMTP_USER/);
});

test('provedorSmtp recusa destinatário vazio antes de falar com o servidor', async () => {
  const email = provedorSmtp({ user: 'u', pass: 'p', from: 'a@b.co', criarTransporte: () => ({ sendMail: async () => ({}) }) });
  await assert.rejects(() => email.enviar({ assunto: 'x', texto: 'y' }), ErroEmail);
});
