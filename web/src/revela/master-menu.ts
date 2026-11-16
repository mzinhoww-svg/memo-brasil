/* Constantes do menu recolhível do Master. Ficam fora de master-shell.tsx ("use client") para o layout do servidor poder ler o texto do script. */

/** Chave do localStorage com a escolha do menu: "1" = trilho (recolhido), "0" = expandido. */
export const RAIL_KEY = "mm.master.rail";
/** Largura a partir da qual o menu é coluna fixa (expandida ou trilho); abaixo disso é gaveta. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
/** Script de uma linha: aplica a escolha antes da primeira pintura (evita o salto do menu ao hidratar). Sem localStorage, não faz nada. */
export const RAIL_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(RAIL_KEY)})==="1")document.documentElement.setAttribute("data-mrail","1")}catch(e){}`;
