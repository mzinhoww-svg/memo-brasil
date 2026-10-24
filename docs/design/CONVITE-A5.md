# Convite A5 para impressão (QR Code Studio)

Onde: `/painel/<id>/qr` (só o organizador: o layout do painel já barra quem não criou o evento). Código: `web/src/features/invitations/invite-{print,layout,pdf}.ts`, `InviteA5.tsx`.

## Arquivo "Baixar PDF para gráfica"
| Item | Valor gerado e verificado |
|---|---|
| Formato final (corte) | A5 vertical, 148 × 210 mm (`TrimBox` e `ArtBox` 3/3/148/210 mm) |
| Tamanho do arquivo | 154 × 216 mm = 436,54 × 612,28 pt (`MediaBox` = `BleedBox`) |
| Sangria | 3 mm em todos os lados; só a faixa de cor do topo vai até a borda e entra na sangria |
| Margem de segurança | 10 mm do corte para todo texto e QR (testado com nomes longos) |
| Marcas de corte | não há (não invadem nada; a gráfica posiciona pelo `TrimBox`) |
| Páginas | 1; PDF 1.7 (pdf-lib) |
| Texto | vetorial, fontes embutidas em subconjunto: Bricolage Grotesque ExtraBold e Regular, Instrument Serif Italic (SIL OFL 1.1, licenças em `web/public/fonts/pdf/OFL-*.txt`) |
| QR | vetorial (retângulos), nível M, zona de proteção branca de 4 módulos, 42–66 mm de lado (módulo ≥ 1 mm), cor do evento só se o contraste com o branco for ≥ 7:1 |
| Conteúdo do QR | `https://newmemocuiaba.vercel.app/e/<código>` (`siteOrigin()`; nunca preview, localhost, URL assinada ou token); o código impresso leva ao mesmo evento em `/entrar` |
| Imagens | nenhuma imagem raster no arquivo |
| Cor | **RGB do dispositivo (DeviceRGB), sem perfil ICC.** Não é PDF/X nem CMYK; não houve conversão de cor. A gráfica deve converter com o perfil dela e enviar prova. |
| Nome | `convite-<nome-do-evento>.pdf` (sem acento, espaço ou caractere de caminho) |

## Conteúdo (tudo do evento)
Nome do evento (sem fonte manuscrita; corpo ajustado para até 3 linhas), "A festa também acontece pelo seu olhar.", QR, passos "1. Escaneie o QR Code. 2. Entre com seu nome. 3. Fotografe e compartilhe.", "Sem baixar aplicativo.", fotos por pessoa (limite efetivo do evento), revelação por extenso no fuso do evento ("no sábado, 23 de novembro, às 22h"; sem revelação: "na hora"; ao terminar: "quando a festa terminar"; só o anfitrião vê: "As fotos ficam com …"), código e endereço alternativo, "por MemoriesMT". Não diz "sem cadastro".

## Imprimir
"Imprimir" imprime só a folha A5 (`@page convite { size: 148mm 210mm }`), sem controles, cards de mesa ou rodapé. Cards das mesas (A6) seguem em "Imprimir cards das mesas", agora sempre claros no papel e com o nome em fonte legível.

## Limitações conhecidas
- Sem perfil ICC/CMYK/PDF-X (acima). Sem marcas de corte.
- Logo/capa do evento ainda não entram no convite (a cor do evento entra na faixa e nos números); ver backlog `UXA-131`.
- Caracteres fora do latim básico/estendido das fontes (ex.: emoji) são trocados pela letra-base ou omitidos para não imprimir quadrados.

## Validação (2026-10-23)
`pdfinfo -box`, `pdffonts` (3 fontes, todas `emb yes`), render a 300 dpi (`pdftoppm`) dos 3 exemplos sintéticos em `docs/evidence/convite-20261023/exemplos/`, QR decodificado (OpenCV) no PDF renderizado, na prévia e no PDF da impressão do navegador, todos = URL canônica + código impresso.
