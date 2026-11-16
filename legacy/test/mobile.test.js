// Verificações estáticas da camada mobile (a medição em navegador está em docs/qa/mobile).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');
const ler = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
// presenca.html sai do produto (RSVP fora do escopo, PR #13): não entra na camada mobile.
const paginas = fs.readdirSync(pub).filter((f) => f.endsWith('.html') && f !== 'presenca.html');

test('todas as páginas usam viewport-fit=cover e carregam mobile.css', () => {
  assert.ok(paginas.length >= 8);
  for (const f of paginas) {
    const h = ler(f);
    assert.match(h, /<meta name="viewport" content="[^"]*viewport-fit=cover/, `${f}: falta viewport-fit=cover`);
    assert.match(h, /href="\/mobile\.css"/, `${f}: não carrega mobile.css`);
  }
});

test('mobile.css tem @media, safe-area, campos de 16px e alvos de 44px', () => {
  const css = ler('mobile.css');
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 400px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /input:not\(\[type=checkbox\]\)[^{]*select, textarea \{ font-size: 16px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /table\.cartoes/);
});

test('nenhuma regra de campo define font-size abaixo de 16px', () => {
  for (const f of ['app.css', 'admin.css', 'mobile.css']) {
    for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/(^|\})\s*((?:input|select|textarea)[^{]*)\{([^}]*)\}/g)) {
      const fs_ = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(m[3]);
      if (fs_) assert.ok(Number(fs_[1]) >= 16, `${f}: ${m[2].trim()} usa ${fs_[1]}px`);
    }
  }
});

test('mobile.js só rotula células e não faz chamadas à API', () => {
  const js = ler('mobile.js');
  assert.match(js, /data-label|dataset\.label/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|localStorage/);
});
