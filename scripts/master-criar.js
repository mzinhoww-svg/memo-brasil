const path = require('path');
const app = require(path.join(__dirname, '..', 'server.js'));

// Cria a primeira conta do admin master.
// Uso: node scripts/master-criar.js <email> <nome>
// A senha NUNCA vem por argumento: ela apareceria no histórico do shell e no
// `ps` de qualquer outra pessoa da máquina. Leia de MASTER_SENHA (ambiente) ou
// digite no prompt (sem eco). O segredo TOTP, se quiser reaproveitar, vem de
// MASTER_TOTP_SECRET; sem ele, um novo é gerado e impresso uma única vez.
const [,, email, nome, extra] = process.argv;

function uso() {
  console.error('Uso: node scripts/master-criar.js <email> <nome>');
  console.error('A senha vem de MASTER_SENHA (ambiente) ou do prompt — nunca por argumento.');
  console.error('Opcional: MASTER_TOTP_SECRET=<base32> para reaproveitar um segredo TOTP.');
}

// Lê a senha sem eco: no TTY em modo cru; por pipe, lê a primeira linha do stdin.
function lerSenha(pergunta) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      const partes = [];
      stdin.resume();
      stdin.on('data', (c) => partes.push(c));
      stdin.on('end', () => resolve(Buffer.concat(partes).toString('utf8').split('\n')[0].trim()));
      stdin.on('error', reject);
      return;
    }
    process.stdout.write(pergunta);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const fim = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', aoDigitar);
      process.stdout.write('\n');
    };
    const aoDigitar = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { fim(); resolve(buf); return; }
        if (c === '\u0003') { fim(); reject(new Error('cancelado')); return; }
        if (c === '\u007f' || c === '\b') { buf = buf.slice(0, -1); continue; }
        buf += c;
      }
    };
    stdin.on('data', aoDigitar);
  });
}

async function main() {
  // Argumento a mais é quase sempre a senha por engano: recusa e explica.
  if (!email || !nome || extra) { uso(); process.exit(2); }
  let senha = process.env.MASTER_SENHA || '';
  if (!senha) senha = await lerSenha('Senha (mín. 12 caracteres): ');
  if (!senha) { console.error('Senha vazia.'); process.exit(2); }
  try {
    const r = await app.criarMaster({ email, nome, senha, totpSecret: process.env.MASTER_TOTP_SECRET });
    console.log(JSON.stringify({
      id: r.id, email: r.email, nome: r.nome,
      totpSecret: r.totpSecret,
      otpauth: r.otpauth,
      recoveryCodes: r.recoveryCodes,
    }, null, 2));
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
}

main();
