'use strict';
// Healthcheck /healthz: status, versão e uma checagem real de gravação no
// DATA_DIR. Não devolve dado pessoal, token nem caminho de disco.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function lerVersao() {
  try { return require('../../package.json').version || '0.0.0'; } catch { return '0.0.0'; }
}

// Escreve e apaga um arquivo temporário no diretório de dados.
function checarGravacao(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const arquivo = path.join(dir, `.healthz-${crypto.randomBytes(6).toString('hex')}`);
    fs.writeFileSync(arquivo, 'ok');
    fs.unlinkSync(arquivo);
    return { ok: true };
  } catch {
    return { ok: false, motivo: 'não foi possível gravar no diretório de dados' };
  }
}

function createHealthHandler({ dataDir, versao = lerVersao(), agora = () => new Date().toISOString(), checar = checarGravacao } = {}) {
  if (!dataDir) throw new Error('healthz: dataDir é obrigatório');
  return function healthz(req, res) {
    const gravacao = checar(dataDir);
    res.status(gravacao.ok ? 200 : 503).json({
      status: gravacao.ok ? 'ok' : 'degradado',
      versao,
      gravacao,
      uptimeS: Math.round(process.uptime()),
      agora: agora(),
    });
  };
}

module.exports = { createHealthHandler, checarGravacao, lerVersao };
