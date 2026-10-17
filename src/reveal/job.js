// Job de revelação: quando chega a hora marcada, avisa os convidados (push que já
// existe) e manda um e-mail para a organização. Roda de tempos em tempos.
//
// Garantias:
//   - idempotente: grava revealNotified/emailEnviado no evento, então repetir o
//     ciclo ou reiniciar o servidor não duplica o aviso;
//   - trava: um ciclo por vez no processo (o setInterval não empilha execuções);
//   - timeout: cada envio tem limite de tempo, para um provedor lento não travar o job;
//   - fail-closed no destino: e-mail só para endereço verificado (contatoVerificado
//     ou lista de confiança), nunca para um endereço qualquer digitado no evento;
//   - fotos ocultas pela moderação não entram nas contagens.
'use strict';

const crypto = require('crypto');
const { escaparHtml } = require('../util/escapar');
const { fotosVisiveis } = require('../util/fotos');

const MAX_TENTATIVAS_EMAIL = 5;
const TITULO_PUSH = 'As fotos foram reveladas! 🎉';
const TIMEOUT_ENVIO_PADRAO_MS = 10000;

// Trava do processo: evita dois ciclos ao mesmo tempo (setInterval + gancho de teste).
let emAndamento = false;

const RESUMO_VAZIO = { avaliados: 0, revelados: 0, emailsEnviados: 0, emailsFalhos: 0, emailsNaoVerificados: 0, pushes: 0 };

const linkDoAlbum = (ev, baseUrl) => `${String(baseUrl || '').replace(/\/+$/, '')}/e/${ev.id}/album`;

// Texto pt-BR, acolhedor e próprio do Lume (nada copiado de outros apps).
function montarEmailRevelacao(ev, { baseUrl = '' } = {}) {
  const titulo = String(ev.titulo || 'o seu casamento');
  const link = linkDoAlbum(ev, baseUrl);
  const fotos = fotosVisiveis(ev).length;
  const recados = Array.isArray(ev.recados) ? ev.recados.length : 0;
  const contarFotos = fotos === 1 ? 'o álbum de vocês já tem 1 foto registrada' : `o álbum de vocês já tem ${fotos} fotos registradas`;
  const doMural = recados ? (recados === 1 ? ' e 1 recado no mural' : ` e ${recados} recados no mural`) : '';
  const linhaFesta = `Cada convidado foi fotógrafo — ${contarFotos}${doMural}.`;
  const assunto = `Seu álbum foi revelado: ${titulo}`;

  const texto = [
    'Oi! Chegou a hora mais esperada: o álbum de vocês está aberto. 🎉',
    '',
    linhaFesta,
    'Essas fotos podem ser vistas por todos os convidados do casamento.',
    'Sente-se confortável, veja a festa pelos olhos de quem estava lá e guarde este dia com carinho.',
    '',
    `Ver o álbum: ${link}`,
    '',
    'Com carinho,',
    'Equipe Lume',
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1c1917">',
    '<h1 style="font-size:22px;margin:0 0 12px">Seu álbum foi revelado 🎉</h1>',
    `<p>Oi! O álbum de <strong>${escaparHtml(titulo)}</strong> está aberto.</p>`,
    `<p>${escaparHtml(linhaFesta)}</p>`,
    '<p>Essas fotos podem ser vistas por todos os convidados do casamento.</p>',
    `<p><a href="${escaparHtml(link)}">Ver o álbum de fotos</a></p>`,
    '<p>Com carinho,<br>Equipe Lume</p>',
    '</div>',
  ].join('\n');

  return { para: String(ev.contato || '').trim(), assunto, texto, html };
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Só endereço verificado recebe aviso de revelação (Atlas): o contato do evento é
// texto livre, então sem verificação a plataforma não pode ser usada como disparador.
const destinoVerificado = (ev, verificados = []) =>
  ev.contatoVerificado === true || verificados.includes(String(ev.contato || '').trim().toLowerCase());

// Limite de tempo real (não usa o relógio injetável) para um envio não travar o job.
function comTimeout(promessa, ms, rotulo) {
  if (!ms || ms <= 0) return promessa;
  let timer;
  const limite = new Promise((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`tempo esgotado (${ms}ms) em ${rotulo}`)), ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

async function rodarCiclo({
  eventos = {},
  agora = () => new Date(),
  email,
  pushEnviar = async () => ({ alvos: 0, entregues: 0, falhas: 0 }),
  baseUrl = '',
  persistir = () => {},
  novoId = (n = 5) => crypto.randomBytes(n).toString('base64url'),
  log = () => {},
  timeoutMs = TIMEOUT_ENVIO_PADRAO_MS,
  verificados = [],
} = {}) {
  if (!email || typeof email.enviar !== 'function') throw new Error('processarRevelacoes precisa de um provedor de e-mail.');
  const resumo = { ...RESUMO_VAZIO };
  const t = agora().getTime();

  for (const ev of Object.values(eventos)) {
    if (!ev || !ev.revealAt) continue;
    resumo.avaliados++;
    if (t < new Date(ev.revealAt).getTime()) continue;

    const tentativas = ev.emailTentativas || 0;
    const emailPendente = !ev.emailEnviado && tentativas < MAX_TENTATIVAS_EMAIL;
    if (ev.revealNotified && !emailPendente) continue;

    let mudou = false;

    if (emailPendente) {
      mudou = true;
      const para = String(ev.contato || '').trim();
      if (!EMAIL_OK.test(para)) {
        ev.emailTentativas = tentativas + 1;
        ev.emailErro = para ? 'contato da organização não parece um e-mail' : 'organização sem e-mail de contato cadastrado';
        resumo.emailsFalhos++;
      } else if (!destinoVerificado(ev, verificados)) {
        // Não consome tentativa: quando a organização confirmar o endereço (ou o
        // operador liberar em EMAIL_VERIFICADOS), o aviso sai no próximo ciclo.
        ev.emailErro = 'destino não verificado: confirme o e-mail da organização';
        resumo.emailsNaoVerificados++;
      } else {
        try {
          const r = await comTimeout(email.enviar(montarEmailRevelacao(ev, { baseUrl })), timeoutMs, 'envio de e-mail');
          ev.emailEnviado = true;
          ev.emailEnviadoEm = agora().toISOString();
          ev.emailId = r?.id ? String(r.id) : null;
          delete ev.emailErro;
          resumo.emailsEnviados++;
        } catch (e) {
          ev.emailTentativas = tentativas + 1;
          ev.emailErro = String(e?.message || e).slice(0, 200);
          resumo.emailsFalhos++;
          log(`[revelacao] e-mail do evento ${ev.id} falhou (tentativa ${ev.emailTentativas}/${MAX_TENTATIVAS_EMAIL}): ${ev.emailErro}`);
        }
      }
    }

    // Push de revelação: uma vez por evento, junto com o aviso que aparece no painel.
    if (!ev.revealNotified) {
      const corpo = `O álbum de ${ev.titulo} está aberto.`;
      let r = { alvos: 0, entregues: 0, falhas: 0 };
      try {
        r = (await comTimeout(pushEnviar(ev, { titulo: TITULO_PUSH, corpo, url: `/e/${ev.id}/album` }), timeoutMs, 'envio de push')) || r;
      } catch (e) {
        r = { alvos: 0, entregues: 0, falhas: 0, erro: String(e?.message || e).slice(0, 200) };
        log(`[revelacao] push do evento ${ev.id} falhou: ${r.erro}`);
      }
      resumo.pushes++;
      ev.avisos = Array.isArray(ev.avisos) ? ev.avisos : [];
      ev.avisos.push({ id: novoId(5), titulo: TITULO_PUSH, corpo, enviadoEm: agora().toISOString(), por: 'Sistema', ...r });
      ev.revealNotified = true;
      resumo.revelados++;
      mudou = true;
    }

    if (mudou) persistir(ev);
  }

  return resumo;
}

// Porta de entrada do job (com a trava). Chamadas concorrentes devolvem `ocupado: true`.
async function processarRevelacoes(opts = {}) {
  if (emAndamento) return { ...RESUMO_VAZIO, ocupado: true };
  emAndamento = true;
  try {
    return { ...(await rodarCiclo(opts)), ocupado: false };
  } finally {
    emAndamento = false;
  }
}

module.exports = {
  processarRevelacoes, rodarCiclo, montarEmailRevelacao, destinoVerificado,
  MAX_TENTATIVAS_EMAIL, TITULO_PUSH, TIMEOUT_ENVIO_PADRAO_MS,
};
