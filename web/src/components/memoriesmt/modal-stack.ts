/**
 * Pilha de diálogos modais abertos (Sheet, Drawer do console, busca ⌘K). Só o do topo trata Tab/Esc: assim o Esc da
 * busca aberta sobre o drawer não fecha o drawer, e o Esc de um diálogo de cima não descarta a justificativa de uma
 * folha embaixo. Um diálogo aninhado no DOM de outro (folha dentro do drawer) fica acima dele mesmo quando os dois
 * montam juntos (o efeito do filho roda antes do do pai).
 */
export interface ModalHandle { isTop(): boolean; release(): void }

const stack: { el: HTMLElement | null }[] = [];

export function pushModal(el: HTMLElement | null): ModalHandle {
  const entry = { el };
  const i = el ? stack.findIndex((x) => x.el !== null && x.el !== el && el.contains(x.el)) : -1;
  if (i >= 0) stack.splice(i, 0, entry); else stack.push(entry);
  return {
    isTop: () => stack[stack.length - 1] === entry,
    release: () => { const k = stack.indexOf(entry); if (k >= 0) stack.splice(k, 1); },
  };
}

/** Há algum diálogo modal aberto? */
export const modalOpen = () => stack.length > 0;
