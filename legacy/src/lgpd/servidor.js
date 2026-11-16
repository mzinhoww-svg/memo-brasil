// Lock de instância: o servidor escreve DATA_DIR/server.lock enquanto está no ar.
// Os comandos de exclusão/retenção exigem o servidor parado — assim ninguém apaga
// um evento que continua vivo na memória do processo e volta a ser servido.
const fs = require('fs');
const path = require('path');

const arquivoLock = (dataDir) => path.join(dataDir, 'server.lock');

function lerLock(dataDir) {
  try { return JSON.parse(fs.readFileSync(arquivoLock(dataDir), 'utf8')); } catch { return null; }
}

function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function servidorAtivo(dataDir) {
  const lock = lerLock(dataDir);
  return lock && pidVivo(lock.pid) ? lock.pid : null;
}

function escreverLock(dataDir) {
  fs.writeFileSync(arquivoLock(dataDir), JSON.stringify({ pid: process.pid, em: new Date().toISOString() }), { mode: 0o600 });
}

function removerLock(dataDir) {
  const lock = lerLock(dataDir);
  if (!lock || lock.pid === process.pid) {
    try { fs.rmSync(arquivoLock(dataDir), { force: true }); } catch {}
  }
}

function exigirServidorParado(dataDir) {
  const pid = servidorAtivo(dataDir);
  if (!pid) return;
  const erro = new Error(`O servidor está ativo (pid ${pid}). Pare o servidor antes de rodar este comando: com ele no ar, os dados ficam em memória e a exclusão pode não valer.`);
  erro.codigo = 'SERVIDOR_ATIVO';
  throw erro;
}

module.exports = { arquivoLock, lerLock, pidVivo, servidorAtivo, escreverLock, removerLock, exigirServidorParado };
