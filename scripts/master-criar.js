const path = require('path');
const readline = require('readline');
const app = require(path.join(__dirname, '..', 'server.js'));

const [,, email, nome, senhaArg, secretArg] = process.argv;

async function main() {
  if (!email || !nome) {
    console.error('Uso: node scripts/master-criar.js <email> <nome> [senha] [totp-secret]');
    console.error('Se a senha não for fornecida, será solicitada interativamente.');
    process.exit(2);
  }
  let senha = senhaArg;
  if (!senha) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    senha = await new Promise((resolve) => {
      rl.question('Senha (mín. 12 caracteres): ', (answer) => { rl.close(); resolve(answer); });
    });
  }
  try {
    const r = await app.criarMaster({ email, nome, senha, totpSecret: secretArg });
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