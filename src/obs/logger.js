'use strict';
// Log estruturado (JSON por linha) por requisição, SEM PII.
// Nunca registra corpo de requisição, cabeçalhos, query string, e-mail, nome,
// token nem texto de recado. O IP aparece apenas como hash curto, com um sal
// aleatório por processo (não reversível entre reinícios).
const crypto = require('crypto');

// Chaves que, por engano, jamais podem aparecer numa linha de log.
const CHAVES_PROIBIDAS = new Set([
  'email', 'e-mail', 'nome', 'name', 'token', 'senha', 'password', 'secret',
  'recado', 'texto', 'mensagem', 'autor', 'contato', 'body', 'headers', 'cookie',
]);

function hashIp(ip, salt) {
  if (!ip) return null;
  const base = String(ip).replace(/^::ffff:/, '');
  return crypto.createHash('sha256').update(`${salt}:${base}`).digest('hex').slice(0, 12);
}

// Só o caminho, sem query string (onde podem ir tokens) e com tamanho limitado.
function rotaSegura(req) {
  const bruto = req.path || (req.url ? String(req.url) : '/');
  const rota = String(bruto).split('?')[0];
  return rota.length > 200 ? rota.slice(0, 200) : rota;
}

function semPII(registro) {
  for (const k of Object.keys(registro)) if (CHAVES_PROIBIDAS.has(k.toLowerCase())) delete registro[k];
  return registro;
}

function createLogger({ sink, salt, now = () => Date.now() } = {}) {
  const segredo = salt || crypto.randomBytes(16).toString('hex');
  const escrever = sink || ((linha) => process.stdout.write(`${JSON.stringify(linha)}\n`));

  function log(campos) {
    const linha = semPII({ t: new Date(now()).toISOString(), nivel: 'info', ...campos });
    try { escrever(linha); } catch { /* log nunca pode derrubar a requisição */ }
    return linha;
  }

  function middleware(req, res, next) {
    const inicio = now();
    res.on('finish', () => log({
      msg: 'http',
      metodo: req.method,
      rota: rotaSegura(req),
      status: res.statusCode,
      ms: Math.max(0, now() - inicio),
      ipH: hashIp(req.ip || req.socket?.remoteAddress, segredo),
    }));
    next();
  }

  return { middleware, log, hashIp: (ip) => hashIp(ip, segredo) };
}

module.exports = { createLogger, hashIp, rotaSegura, semPII, CHAVES_PROIBIDAS };
