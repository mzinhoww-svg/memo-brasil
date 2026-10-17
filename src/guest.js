// Sessão do convidado (item 7: convidado sem fricção).
// Na entrada geramos um token aleatório de 32 bytes; o servidor guarda apenas o
// hash (sha256, base64url) — o mesmo esquema de host e equipe (src/store/sqlite.js),
// para haver um único modelo de credencial no projeto. O id do convidado sozinho
// nunca autentica: toda ação exige o token no cabeçalho x-guest-token.
const crypto = require('crypto');
const { tokenHash, verifyToken } = require('./store/sqlite');

const TAMANHO_TOKEN = 32; // bytes

function novoToken() {
  const token = crypto.randomBytes(TAMANHO_TOKEN).toString('base64url');
  return { token, hash: tokenHash(token) };
}

// Compara em tempo constante (delega ao mesmo verifyToken de host/equipe).
const confere = (token, hashGuardado) => verifyToken(token, hashGuardado);

// Autentica pela dupla id + token. Devolve o convidado do evento, ou null.
function autentica(ev, guestId, token) {
  if (!ev || !Array.isArray(ev.guests)) return null;
  const g = ev.guests.find((x) => x.id === guestId);
  if (!g) return null;
  return confere(token, g.tokenHash) ? g : null;
}

// Saldo e dados que o próprio convidado pode ver.
function sessaoDe(ev, g) {
  const item = g.listaId && ev.lista.find((l) => l.id === g.listaId);
  const usadas = ev.photos.filter((p) => p.guestId === g.id).length;
  return {
    guestId: g.id, nome: g.nome, naLista: !!item, rsvp: item?.rsvp || null,
    acompanhantes: item?.acompanhantes || 0,
    fotosUsadas: usadas, fotosRestantes: Math.max(0, ev.fotosPorConvidado - usadas),
  };
}

// Mensagens de estado do convidado, em pt-BR.
const MENSAGENS = {
  semToken: 'Entre no evento de novo com seu nome para continuar.',
  sessaoInvalida: 'Sua sessão expirou. Entre de novo com seu nome.',
  eventoEncerrado: 'O evento já terminou e as fotos foram reveladas.',
  eventoIndisponivel: 'Este evento está temporariamente indisponível.',
  conviteErrado: 'Convite não encontrado. Confira o QR Code com os noivos.',
  recadoSemCredencial: 'Entre no evento para ver ou deixar recados.',
  recadoSoNoivos: 'Seu recado é só para os noivos.',
  recadoMural: 'Este recado vai aparecer para todos os convidados, com o seu nome.',
};

module.exports = { TAMANHO_TOKEN, novoToken, confere, autentica, sessaoDe, MENSAGENS };
