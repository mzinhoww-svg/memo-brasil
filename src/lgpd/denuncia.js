// Denúncia de foto por um convidado autenticado. A organização recebe, modera
// (oculta) ou apaga; toda ação fica auditada. Guarda só o necessário.
const crypto = require('crypto');
const MAX_DENUNCIAS_POR_EVENTO = 5000;
const MOTIVO_MAX = 300;

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const novoId = () => crypto.randomBytes(6).toString('base64url');

function registrarDenuncia(ev, { fotoId, guestId, motivo } = {}, agora = new Date()) {
  const foto = (ev.photos || []).find((p) => p.id === fotoId);
  if (!foto) return { status: 404, erro: 'Foto não encontrada.' };
  const guest = (ev.guests || []).find((g) => g.id === guestId);
  if (!guest) return { status: 403, erro: 'Entre no evento antes de denunciar.' };
  if (!Array.isArray(ev.denuncias)) ev.denuncias = [];
  const repetida = ev.denuncias.find((d) => d.fotoId === fotoId && d.guestId === guestId && d.status === 'aberta');
  if (repetida) return { denuncia: repetida, repetida: true };
  if (ev.denuncias.length >= MAX_DENUNCIAS_POR_EVENTO)
    return { status: 409, erro: 'Este evento atingiu o limite de denúncias.' };
  const denuncia = {
    id: novoId(), fotoId, guestId,
    motivo: texto(motivo, MOTIVO_MAX),
    criadoEm: agora.toISOString(), status: 'aberta',
  };
  ev.denuncias.push(denuncia);
  return { denuncia };
}

// Fecha as denúncias abertas de uma foto quando ela é moderada ou apagada.
function resolverDenunciasDaFoto(ev, fotoId, status = 'moderada', agora = new Date()) {
  const abertas = (ev.denuncias || []).filter((d) => d.fotoId === fotoId && d.status === 'aberta');
  for (const d of abertas) { d.status = status; d.resolvidaEm = agora.toISOString(); }
  return abertas.length;
}

module.exports = { MAX_DENUNCIAS_POR_EVENTO, MOTIVO_MAX, registrarDenuncia, resolverDenunciasDaFoto };
