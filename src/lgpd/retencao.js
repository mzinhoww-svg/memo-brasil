// Prazo de retenção (LGPD): quanto tempo guardamos cada evento.
// Depois da revelação, RETENCAO_DIAS_APOS_REVELACAO (padrão 365).
// Eventos que nunca foram revelados, RETENCAO_DIAS_SEM_REVELACAO (padrão 180) desde a criação.
const PADRAO_APOS_REVELACAO = 365;
const PADRAO_SEM_REVELACAO = 180;
const DIA_MS = 86400000;

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

// Devolve o motivo da expiração ('pos-revelacao' | 'sem-revelacao') ou null se ainda deve ficar.
function motivoExpiracao(ev, agora, cfg) {
  const revelacao = new Date(ev.revealAt).getTime();
  if (Number.isFinite(revelacao) && agora >= revelacao) {
    return idadeDias(ev.revealAt, agora) >= cfg.diasAposRevelacao ? 'pos-revelacao' : null;
  }
  const base = ev.createdAt || ev.revealAt;
  if (!base || !Number.isFinite(new Date(base).getTime())) return null;
  return idadeDias(base, agora) >= cfg.diasSemRevelacao ? 'sem-revelacao' : null;
}

// Lista os eventos a expirar, sem PII (só id, motivo, idade e se foi revelado).
function planoRetencao(db, agora = Date.now(), cfg = configRetencao()) {
  const plano = [];
  for (const ev of Object.values(db.events || {})) {
    const motivo = motivoExpiracao(ev, agora, cfg);
    if (!motivo) continue;
    const base = motivo === 'pos-revelacao' ? ev.revealAt : (ev.createdAt || ev.revealAt);
    plano.push({
      id: ev.id,
      motivo,
      idadeDias: Math.floor(idadeDias(base, agora)),
      revelado: motivo === 'pos-revelacao',
    });
  }
  return plano;
}

module.exports = {
  PADRAO_APOS_REVELACAO, PADRAO_SEM_REVELACAO,
  configRetencao, idadeDias, motivoExpiracao, planoRetencao,
};
