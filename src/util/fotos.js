// Visibilidade de foto para quem é convidado.
//
// A moderação (item 9) pode esconder uma foto (`oculta`, com `ocultaEm` marcando
// quando). Foto oculta não aparece no álbum, na retrospectiva nem nas contagens
// do e-mail de revelação. Sem a marca, a foto é visível — o filtro é fail-closed
// só para quem foi explicitamente ocultado.
function fotoVisivel(foto) {
  if (!foto) return false;
  return foto.oculta !== true && !foto.ocultaEm;
}

const fotosVisiveis = (ev) => (Array.isArray(ev?.photos) ? ev.photos.filter(fotoVisivel) : []);

module.exports = { fotoVisivel, fotosVisiveis };
