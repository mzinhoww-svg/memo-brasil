// Lume — rotula as células das tabelas (data-label) para virarem cartões no celular. Só apresentação.
(function () {
  let agendado = false;
  function varre() {
    agendado = false;
    document.querySelectorAll('table').forEach((t) => {
      const ths = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      if (!ths.length) return;
      t.classList.add('cartoes');
      t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => {
        if (ths[i] && !td.hasAttribute('colspan') && td.dataset.label !== ths[i]) td.dataset.label = ths[i];
      }));
    });
  }
  new MutationObserver(() => { if (!agendado) { agendado = true; requestAnimationFrame(varre); } }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', varre);
})();
