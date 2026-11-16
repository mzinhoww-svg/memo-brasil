# Plano de correção pós-publicação do Revela 2.0 (2026-11-10)

Produção atual: `dpl_2QdPiDZPzVVMJ28SjFTq9bmucpiA` (`e594aaa6c`). Rollback: `dpl_EZtKyENbbEP26KTZVpn2EeQ3T73i`.
Regra para todo item: reproduzir primeiro, corrigir, provar (teste + captura), só então publicar (candidato sem tráfego → API da Vercel → promover → smoke).

## O que o diagnóstico mostrou
1. **Prints do usuário = build anterior (`df2970f`) ou telas ainda não portadas.** O passo 3 "Até quando vale?" (com "Termina em 1 hora…") é o assistente antigo; o bundle em produção já traz "Quando é a festa?" (conferido nos chunks). Já o passo 6 "Qual filme?" **continua antigo no build atual**: os passos 1, 2, 6 e 7 do assistente (telas 06, 07, 08, 12, 13) nunca foram ligados ao desenho.
2. **Filtro.** O passo 6 mostra o mesmo bolo 3D com um `filter: sepia(.35)` em CSS (quase invisível); o desenho compara duas fotos reais (`sc-bolo-natural.jpg` × `sc-bolo.jpg`). Na captura, `renderPhoto` (`web/src/features/photos/capture.ts`) aplica `applyStylePixels` e o carimbo de data, mas não há grão, brilho de flash nem prova automática de que "Filme 35mm" muda o JPEG. Não há como o usuário perceber que o filtro funciona.
3. **PDF/impressão torta (iPhone) — resolvida removendo o caminho de impressão (ver A3).** `window.print()` no Safari iOS ignora `@page` e várias regras de `body[data-imprimir]`: a prévia saiu A4 com o convite A5 minúsculo no canto e o fundo escuro da tela (`.scr`) impresso. O CSS de impressão está em `web/src/styles/app.css` (linhas ~193–204) e o PDF próprio em `web/src/features/invitations/invite-pdf.ts`.

## Parte A — correções pedidas
**A1. Portar os passos 1, 2, 6 e 7 do assistente (telas 06, 07, 08, 12, 13)** — `Camera-embalagem`, `Camera-nome`, `Camera-filtro`, `Camera-privacidade` viram componentes com props (padrão do `WizardSheet`), ligados em `features/events/wizard.tsx` (passos 0, 1, 5, 6). Embalagem com as amostras e o texto do desenho; nome com prévia da embalagem, chips de sugestão e teclado nativo (o teclado do desenho é só ilustração); privacidade com os dois toggles do desenho — "Permitir baixar em álbum" só se houver campo real (senão, divergência registrada). Testes: unitários do wizard, `e2e/revela-wizard.spec.ts` estendido aos 8 passos, evidência `06/07/08/12/13` < 3%.
**A2. Filtro de verdade, ponta a ponta.**
 1. Reproduzir: teste de pixel (canvas) que tira a mesma imagem em `natural` e `filme35` e exige diferença mensurável de matiz/contraste, grão e carimbo; hoje não existe.
 2. Passo 6 fiel: duas fotos reais lado a lado (as do desenho) e o filme escolhido gravado no evento (`filmLook`), conferido no painel (17) e na câmera.
 3. Reforçar o "Filme 35mm" na captura e na prévia ao vivo da câmera (tom quente, grão leve, vinheta, brilho de flash, carimbo `'AA MM DD`), igual ao que o texto promete, e aplicar também a envios do rolo.
 4. Garantir que o look aparece no feed, na galeria e nos downloads (a foto guardada já sai processada).
**A3. Baixar apenas o QR code, para usar em arte própria (substitui o PDF/impressão torta).**
 Decisão do usuário: o produto deixa de gerar convite A5 e cartões de mesa impressos; o único download é o **QR code**, para a pessoa montar a arte fora da plataforma. Isso elimina o caminho `window.print()` que quebra no iOS.
 1. Telas 17k (convite A5), 25 (QR para as mesas) e 26 (compartilhar) passam a oferecer "Baixar QR code": **SVG** (vetorial, para gráfica e design), **PNG 2048 px** com fundo branco e margem de silêncio de 4 módulos, e **PNG com fundo transparente**. Sem logotipo, sem texto e sem moldura por cima; correção de erro nível Q/H e contraste conferido para leitura.
 2. O QR continua apontando para `https://fotosdocasamento.online/e/<código>` (um por evento; por mesa quando existirem convites por mesa, com o nome do arquivo `qr-<evento>-<mesa>.svg`). Download direto por `<a download>` e, no iOS, "Compartilhar/Salvar em Arquivos" via Web Share de arquivo.
 3. Remover da interface o PDF A5 (`invite-pdf.ts`), o botão "Imprimir", o CSS `body[data-imprimir]` e os cartões de mesa impressos; manter o desenho das telas e trocar os botões pelos de download do QR (divergência registrada no CHECKLIST). As fontes embutidas no PDF (Gloock, Schibsted, Share Tech Mono) deixam de ser necessárias no pacote.
 4. Testes: unitário que gera o SVG e o PNG e **decodifica o QR de volta** (biblioteca de leitura) conferindo a URL; E2E que baixa os três arquivos em `/painel/[id]/qr` e `/painel/[id]/convite`; captura em `docs/evidence/revela-fiel/` das telas 17k, 25 e 26; verificação no iPhone (salvar em Arquivos e abrir no Canva/Figma).
**A4. "Versão antiga" no celular.** Mostrar a versão do build (SHA curto) no rodapé de `/voce` e no Master, e testar que o Service Worker (`web/public/sw.js`) serve HTML da rede primeiro e troca de cache a cada build; documentar "atualizar o app" na ajuda.

## Parte B — pendências da publicação anterior
- **B1. Axe/rolagem lateral** a 360/390/430 px num build novo (`e2e/revela-a11y.spec.ts`), incluindo as rotas novas; meta: 0 violações.
- **B2. Specs E2E fora do gate:** atualizar ou aposentar com justificativa os que quebraram com a UI nova — `flows.spec` (QR alt da tela 15, câmera "5 fotos restantes", editor 23e), `reveal.spec` BG-101 (estender o fim no painel), `supabase.spec`/`remote-flow.spec` (`aguardando-revelacao` → "NO LABORATÓRIO"), `master-*.spec`, `audit-a2-crawl.spec`, `produto*.spec`; rodar os de nuvem contra um projeto Supabase de teste.
- **B3. pgTAP:** subir Postgres com o schema e rodar `28`, `29_email_opt_out_page`, `29_master_board_moderation` (hoje só validados por leitura).
- **B4. Pagamento real ponta a ponta:** abrir janela `sandbox` do ValidaPay, pagar Pix (e cartão com a flag `validapay_card` ligada), conferir `pago` no Master, liberação do plano e e-mail; depois fechar a janela. Cobrança em produção segue desligada até decisão sua.
- **B5. Download do QR (25, 26, 17k):** conferir os arquivos em celular e desktop (feito junto com A3); a conferência de impressão deixa de existir.
- **B6. Linhas do plano ainda sem tela/rota:** link para `/conta/excluir` em `/eventos/voce`; páginas antigas do Master (`usuarios`, `organizadores`, `participantes`, `storage`, `analytics`) sem redesenho; Pix vencido só é encerrado quando o checkout consulta (o reconciliador deve encerrar sozinho); aviso 24b ligado a push real.
- **B7. Telas ainda "não ligada" no CHECKLIST:** 00, 01, 02–05, 20a, 20b, 20d, 20e, 20f, 21–24 (entrada, cadastro e câmera do convidado). Portar para o desenho, na ordem: 20b/20d/20e/20f/21–24 (jornada do convidado), 00/01 (abertura), 02–05 (cadastro).
- **B8. Telas acima de 3% de diferença** (00, 01, 06, 07, 15, 14e, 14f, 14h, 20g, 24c, 24h): reduzir onde for deslocamento (06, 07, 15, 14h, 24h) e documentar o que é vídeo/animação.

## Ordem sugerida e critérios de pronto
1. A3 (download do QR no lugar do PDF/impressão) e A2.1 (reproduzir filtro) — o que o usuário viu quebrado.
2. A1 + A2.2–4 (passos do assistente e filtro fiel).
3. B7 (jornada do convidado), B1, B2, B3.
4. B4 e B6 (pagamento real, Master antigo, reconciliador).
5. A4, B8 e fechamento (PR, runbook).
Pronto = testes verdes (unitário + E2E do gate + novos), evidência < 3% (ou explicada), Axe 0, candidato validado, promovido e smoke no domínio.

## Preciso do usuário
iPhone para conferir o download do QR (salvar em Arquivos) e o filtro; janela sandbox do ValidaPay (B4); decisão se "Permitir baixar em álbum" e os extras do 14a (CPF no Pix) ficam; Postgres de teste para B3 (ou aceitar que eu suba um local).
