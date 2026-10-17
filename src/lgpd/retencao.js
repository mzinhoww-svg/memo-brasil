// Prazo de retenção (LGPD): quanto tempo guardamos cada evento.
//
// Regra (corrigida no parecer do Atlas): a contagem é sempre a partir de
// `revealAt`, NUNCA de `createdAt`. Um evento marcado para daqui a 7 meses não
// pode ser apagado só porque foi criado há muito tempo.
// - Depois que `revealAt` passou e o álbum abriu: RETENCAO_DIAS_APOS_REVELACAO (365).
// - `revealAt` passou sem revelação efetiva: RETENCAO_DIAS_SEM_REVELACAO (180).
// - `revealAt` ainda no futuro: nunca expira por retenção.
const PADRAO_APOS_REVELACAO = 365;
const PADRAO_SEM_REVELACAO = 180;
const DIA_MS = 86400000;
const JANELA_AVISO_DIAS = 30;

const inteiroPositivo = (v, padrao) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : padrao;
};

// Precedência: variável de ambiente > settings.json da plataforma > padrão.
function configRetencao({ settings = {}, env = {} } = {}) {
  return {
    diasAposRevelacao: inteiroPositivo(
      env.RETENCAO_DIAS_APOS_REVELACAO ?? settings.retencaoDiasAposRevelacao,
      PADRAO_APOS_REVELACAO,
    ),
    diasSemRevelacao: inteiroPositivo(
      env.RETENCAO_DIAS_SEM_REVELACAO ?? settings.retencaoDiasSemRevelacao,
      PADRAO_SEM_REVELACAO,
    ),
  };
}

const idadeDias = (iso, agora) => (agora - new Date(iso).getTime()) / DIA_MS;
const reveladoEfetivo = (ev) => ev.revealNotified === true || ev.revelado === true;

// Instante (ms) em que o evento vira elegível para exclusão; null se ainda não aconteceu.
function expiraEmMs(ev, cfg) {
  const revelacao = new Date(ev.revealAt).getTime();
  if (!Number.isFinite(revelacao)) return null;
  const dias = reveladoEfetivo(ev) ? cfg.diasAposRevelacao : cfg.diasSemRevelacao;
  return revelacao + dias * DIA_MS;
}

// Devolve o motivo da expiração ('pos-revelacao' | 'sem-revelacao') ou null.
function motivoExpiracao(ev, agora, cfg) {
  const expira = expiraEmMs(ev, cfg);
  if (expira === null || agora < expira) return null;
  return reveladoEfetivo(ev) ? 'pos-revelacao' : 'sem-revelacao';
}

// Lista os eventos a expirar, sem PII (só id, motivo, idade e datas).
function planoRetencao(db, agora = Date.now(), cfg = configRetencao()) {
  const plano = [];
  for (const ev of Object.values(db.events || {})) {
    const motivo = motivoExpiracao(ev, agora, cfg);
    if (!motivo) continue;
    const expira = expiraEmMs(ev, cfg);
    plano.push({
      id: ev.id,
      motivo,
      revelado: motivo === 'pos-revelacao',
      idadeDias: Math.floor(idadeDias(ev.revealAt, agora)),
      apagaEm: new Date(expira).toISOString(),
    });
  }
  return plano;
}

// Eventos que vão expirar nos próximos `janelaDias` (aviso ao casal antes de apagar),
// excluindo os que já foram avisados e os já vencidos.
function avisosRetencao(db, agora = Date.now(), cfg = configRetencao(), janelaDias = JANELA_AVISO_DIAS) {
  const avisos = [];
  for (const ev of Object.values(db.events || {})) {
    if (ev.retencaoAvisoEm) continue;
    const expira = expiraEmMs(ev, cfg);
    if (expira === null) continue;
    const diasRestantes = Math.ceil((expira - agora) / DIA_MS);
    if (diasRestantes < 0 || diasRestantes > janelaDias) continue;
    avisos.push({
      id: ev.id,
      motivo: reveladoEfetivo(ev) ? 'pos-revelacao' : 'sem-revelacao',
      diasRestantes,
      apagaEm: new Date(expira).toISOString(),
      contato: ev.contato || '',
    });
  }
  return avisos;
}

module.exports = {
  PADRAO_APOS_REVELACAO, PADRAO_SEM_REVELACAO, DIA_MS, JANELA_AVISO_DIAS,
  configRetencao, idadeDias, reveladoEfetivo, expiraEmMs, motivoExpiracao, planoRetencao, avisosRetencao,
};
