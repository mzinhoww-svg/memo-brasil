// Detecta navegador embutido (Instagram, WhatsApp, Facebook, TikTok…) pelo user agent.
// Roda no navegador (via <script src="/embutido.js">) e no Node (testes), sem duplicar a regra.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.MemoEmbutido = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  // Messenger carrega "FBAN/Messenger" e Facebook carrega "FBAN/FB4A": a ordem importa.
  const APPS = [
    ['Instagram', /Instagram/i],
    ['WhatsApp', /WhatsApp/i],
    ['Messenger', /Messenger/i],
    ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS/i],
    ['TikTok', /Bytedance|TikTok|musical_ly/i],
    ['LinkedIn', /LinkedInApp/i],
    ['Pinterest', /Pinterest/i],
  ];

  function appEmbutido(ua) {
    if (!ua) return null;
    const s = String(ua);
    for (const [nome, re] of APPS) if (re.test(s)) return nome;
    return null;
  }

  const ehNavegadorEmbutido = (ua) => appEmbutido(ua) !== null;

  return { appEmbutido, ehNavegadorEmbutido };
});
