// Tela da câmera: aviso de navegador embutido (Instagram/WhatsApp/Facebook),
// botão para abrir fora e envio pela galeria como caminho garantido.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-cam-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');

let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

test('a câmera avisa sobre navegador embutido, oferece abrir fora e fallback de arquivo', async () => {
  const ev = await (await fetch(`${B}/api/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ titulo: 'Câmera', revealAt: new Date(Date.now() + 3600e3).toISOString() }),
  })).json();
  const html = await (await fetch(`${B}/e/${ev.id}/camera`)).text();
  assert.match(html, /embutido/i);
  assert.match(html, /abrir no navegador/i);
  assert.match(html, /id="arq"/);
  assert.match(html, /embutido\.js/);
  const js = await (await fetch(`${B}/embutido.js`)).text();
  assert.match(js, /ehNavegadorEmbutido/);
});
