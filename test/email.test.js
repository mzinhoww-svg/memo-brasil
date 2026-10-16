// Testes do provedor de e-mail: console (padrão) e Resend (HTTP).
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarEmail, provedorConsole, ErroEmail, redigir } = require('../src/email');

test('console é o provedor padrão e guarda o que foi enviado', async () => {
  const linhas = [];
  const email = criarEmail({}, { log: (l) => linhas.push(l) });
  assert.equal(email.nome, 'console');
  const r = await email.enviar({ para: 'noivos@exemplo.com', assunto: 'Oi', texto: 'Corpo do e-mail', html: '<p>Corpo</p>' });
  assert.equal(r.ok, true);
  assert.equal(email.enviados.length, 1);
  assert.equal(email.enviados[0].para, 'noivos@exemplo.com');
  assert.equal(linhas.length, 1);
});

test('console nunca imprime link com token, nem em produção', async () => {
  const linhas = [];
  const email = criarEmail({ NODE_ENV: 'production' }, { log: (l) => linhas.push(l) });
  await email.enviar({
    para: 'noivos@exemplo.com', assunto: 'Painel',
    texto: 'Abra http://lume.app/painel/abc#t=SEGREDO123 e http://lume.app/api?token=OUTROSEGREDO agora.',
    html: '<a href="http://lume.app/painel/abc#t=SEGREDO123">álbum</a>',
  });
  const saida = linhas.join('\n');
  assert.ok(!saida.includes('SEGREDO123'), 'token do painel não pode aparecer no log');
  assert.ok(!saida.includes('OUTROSEGREDO'), 'token de query não pode aparecer no log');
  assert.ok(saida.includes('token=***'));
  // O que foi entregue de fato continua íntegro; só o log é redigido.
  assert.ok(email.enviados[0].texto.includes('SEGREDO123'));
});

test('redigir mascara token= e #t= sem mexer no resto do texto', () => {
  assert.equal(redigir('veja http://x/painel/1#t=AbC-123_fim ok'), 'veja http://x/painel/1#t=*** ok');
  assert.equal(redigir('/api/events/1/photos/2/file?token=Zz9'), '/api/events/1/photos/2/file?token=***');
  assert.equal(redigir('sem token aqui'), 'sem token aqui');
});

test('Resend envia por HTTP com EMAIL_API_KEY e EMAIL_FROM', async () => {
  const chamadas = [];
  const email = criarEmail(
    { EMAIL_PROVEDOR: 'resend', EMAIL_API_KEY: 'chave-de-teste', EMAIL_FROM: 'Lume <ola@lume.app>' },
    { httpPost: async (url, init) => { chamadas.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: 'msg_1' }) }; } },
  );
  assert.equal(email.nome, 'resend');
  const r = await email.enviar({ para: 'noivos@exemplo.com', assunto: 'Seu álbum', texto: 't', html: '<p>t</p>' });
  assert.equal(r.id, 'msg_1');
  assert.equal(chamadas.length, 1);
  const { url, init } = chamadas[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.authorization, 'Bearer chave-de-teste');
  const corpo = JSON.parse(init.body);
  assert.deepEqual(corpo.to, ['noivos@exemplo.com']);
  assert.equal(corpo.from, 'Lume <ola@lume.app>');
  assert.equal(corpo.subject, 'Seu álbum');
});

test('sem chave ou remetente o envio não inicia, com erro claro', () => {
  assert.throws(
    () => criarEmail({ NODE_ENV: 'production', EMAIL_PROVEDOR: 'resend', EMAIL_FROM: 'a@b.c' }),
    (e) => e instanceof ErroEmail && /EMAIL_API_KEY/.test(e.message),
  );
  assert.throws(
    () => criarEmail({ EMAIL_PROVEDOR: 'resend', EMAIL_API_KEY: 'k' }),
    (e) => e instanceof ErroEmail && /EMAIL_FROM/.test(e.message),
  );
});

test('provedor desconhecido não inicia', () => {
  assert.throws(() => criarEmail({ EMAIL_PROVEDOR: 'pombo-correio' }), /desconhecido/i);
});

test('erro do Resend vira ErroEmail com o status', async () => {
  const email = criarEmail(
    { EMAIL_PROVEDOR: 'resend', EMAIL_API_KEY: 'k', EMAIL_FROM: 'a@b.c' },
    { httpPost: async () => ({ ok: false, status: 422, text: async () => 'destinatário inválido' }) },
  );
  await assert.rejects(() => email.enviar({ para: 'x', assunto: 'y', texto: 'z' }), /422/);
});

test('console recusa mensagem sem destinatário', async () => {
  const email = provedorConsole({ log: () => {} });
  await assert.rejects(() => email.enviar({ assunto: 'sem para', texto: 't' }), ErroEmail);
});
