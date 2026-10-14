const { chromium } = require('playwright-core');
const fs = require('fs');
// Uso: QA_BASE=http://localhost:PORT QA_EVENT=<id> QA_GUEST=<guestId> QA_HOST_TOKEN=<token> QA_MASTER_TOKEN=<token> node docs/qa/qa-visual.js
// Requer: npm i playwright-core (fora do repo) e Google Chrome instalado.
const O = process.env.QA_BASE, ID = process.env.QA_EVENT, GID = process.env.QA_GUEST, HT = process.env.QA_HOST_TOKEN;
const OUT = __dirname;
const pages = [
  ['criar', '/'], ['convite', `/e/${ID}`], ['inicio', `/e/${ID}/inicio`], ['camera', `/e/${ID}/camera`],
  ['album', `/e/${ID}/album`], ['programacao', `/e/${ID}/programacao`], ['recados', `/e/${ID}/recados`],
  ['presenca', `/e/${ID}/presenca`],
  ...['resumo','convidados','programacao','fotos','avisos','convite','config','equipe'].map(s => [`painel-${s}`, `/painel/${ID}#${s}`]),
  ['master', '/master'],
  ...['fotos','plataforma','avisos','auditoria','politicas'].map(s => [`master-${s}`, `/master#${s}`]),
];
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const rows = [];
  for (const [vp, W, H, mobile] of [['m', 390, 844, true], ['d', 1440, 900, false]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, permissions: ['camera'] });
    await ctx.addInitScript(([id, gid, ht, mt]) => {
      localStorage.setItem(`memo:${id}:guest`, JSON.stringify({ guestId: gid, nome: 'Maria Silva' }));
      localStorage.setItem(`memo:${id}:host`, ht); localStorage.setItem('memo:master', mt);
    }, [ID, GID, HT, process.env.QA_MASTER_TOKEN]);
    for (const [name, url] of pages) {
      const p = await ctx.newPage(); const errs = [];
      p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(`${m.type()}: ${m.text().slice(0, 140)}`); });
      p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 140)));
      p.on('response', r => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url().replace(O, '')}`); });
      await p.goto(O + url, { waitUntil: 'networkidle' }).catch(e => errs.push('goto: ' + e.message));
      await p.waitForTimeout(700);
      if (name.startsWith('master-')) {
        const label = { fotos: 'Fotos', plataforma: 'Plataforma', avisos: 'Avisos', auditoria: 'Auditoria', politicas: 'Políticas' }[name.slice(7)];
        await p.getByRole('button', { name: new RegExp('^' + label) }).first().click().catch(e => errs.push('tab: ' + label));
        await p.waitForTimeout(600);
      }
      const m = await p.evaluate(() => {
        const de = document.documentElement; const vw = innerWidth;
        const wide = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > vw + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 3).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''));
        return { path: location.pathname + location.hash, sw: de.scrollWidth, vw, h1: (document.querySelector('h1') || {}).textContent || '', wide };
      });
      await p.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: true });
      rows.push({ name, vp, ...m, hscroll: m.sw > m.vw, errs });
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/.resultado.json`, JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(`${r.name}|${r.vp}|${r.path}|h1="${r.h1}"|sw=${r.sw}/${r.vw}${r.hscroll ? ' HSCROLL ' + r.wide.join(',') : ''}|errs=${r.errs.length ? r.errs.join(' ; ') : '-'}`);
})();
