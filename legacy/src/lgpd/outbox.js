// Fila de avisos por e-mail (o envio real depende do item de e-mail).
// Cada arquivo tem permissão 0600 e a pasta 0700: contém contato e ids, nunca a imagem.
const fs = require('fs');
const path = require('path');

function enfileirarAviso(dataDir, nome, dados) {
  const dir = path.join(dataDir, 'outbox');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
  const arquivo = path.join(dir, nome);
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), { mode: 0o600 });
  try { fs.chmodSync(arquivo, 0o600); } catch {}
  return arquivo;
}

module.exports = { enfileirarAviso };
