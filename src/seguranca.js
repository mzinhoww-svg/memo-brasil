// C3: garante que nenhuma resposta JSON exponha material de credencial.
// Os hashes de token vivem no servidor para autenticar; nunca podem sair na API.
const SEGREDOS = new Set(['tokenHash', 'hostTokenHash']);

function limpar(valor) {
  if (Array.isArray(valor)) return valor.map(limpar);
  if (valor && typeof valor === 'object') {
    // Preserva tipos especiais que o express sabe serializar sem virar objeto simples.
    if (valor instanceof Date || Buffer.isBuffer(valor)) return valor;
    const saida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (SEGREDOS.has(k)) continue;
      saida[k] = limpar(v);
    }
    return saida;
  }
  return valor;
}

// Envolve res.json para limpar o corpo antes de serializar.
function semSegredos(req, res, next) {
  const json = res.json.bind(res);
  res.json = (corpo) => json(limpar(corpo));
  next();
}

module.exports = { limpar, semSegredos, SEGREDOS };
