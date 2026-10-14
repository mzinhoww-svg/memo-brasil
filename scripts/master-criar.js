const path = require('path');
const app = require(path.join(__dirname, '..', 'server.js'));
const [,, email, nome, senha, secret] = process.argv;
if (!email || !nome || !senha) {
  console.error('Uso: node scripts/master-criar.js <email> <nome> <senha> [totp-secret]');
  process.exit(2);
}
try {
  const r = app.criarMaster({ email, nome, senha, totpSecret: secret });
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