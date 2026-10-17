// Retrospectiva de um casamento: só faz sentido depois da revelação (a rota garante isso).
// Lê apenas o evento recebido, então não há como misturar dados de outro casamento.
'use strict';

const { fotosVisiveis } = require('../util/fotos');

const inicioDaHora = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

function montarRetrospectiva(ev, { agora = () => new Date(), top = 5 } = {}) {
  // Foto oculta pela moderação não entra na retrospectiva do convidado.
  const fotos = fotosVisiveis(ev);
  const mostrarAutor = ev.config?.mostrarAutor !== false;
  const porFotografo = new Map();
  const porHora = new Map();

  for (const f of fotos) {
    const chave = f.guestId || `autor:${f.autor || 'sem-autor'}`;
    const atual = porFotografo.get(chave) || { nome: f.autor || '', fotos: 0, primeiraEm: null, ultimaEm: null };
    atual.fotos++;
    if (!atual.primeiraEm || f.criadaEm < atual.primeiraEm) atual.primeiraEm = f.criadaEm;
    if (!atual.ultimaEm || f.criadaEm > atual.ultimaEm) atual.ultimaEm = f.criadaEm;
    porFotografo.set(chave, atual);

    const hora = inicioDaHora(f.criadaEm);
    if (hora) porHora.set(hora, (porHora.get(hora) || 0) + 1);
  }

  const topFotografos = [...porFotografo.values()]
    .sort((a, b) => b.fotos - a.fotos || String(a.nome).localeCompare(String(b.nome)))
    .slice(0, top)
    .map((t) => ({
      nome: mostrarAutor ? t.nome : '',
      fotos: t.fotos,
      primeiraEm: t.primeiraEm,
      ultimaEm: t.ultimaEm,
    }));

  return {
    evento: {
      id: ev.id, titulo: ev.titulo, revealAt: ev.revealAt,
      dataEvento: ev.dataEvento || null, local: ev.local || '',
    },
    revelado: true,
    agora: agora().toISOString(),
    mostrarAutor,
    totais: {
      fotos: fotos.length,
      fotografos: porFotografo.size,
      convidados: (ev.guests || []).length,
      recados: (ev.recados || []).length,
    },
    topFotografos,
    linhaDoTempo: [...porHora.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, quantidade]) => ({ hora, fotos: quantidade })),
  };
}

module.exports = { montarRetrospectiva };
