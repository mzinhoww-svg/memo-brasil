# Roteiro de testes manuais do Revela 2.0 (ordem sugerida)

Use dois celulares (um iPhone e um Android, se possível) e um computador. Anote cada item como ✅ / ❌ e o que viu. Cada bloco depende do anterior.
Endereço: https://fotosdocasamento.online. A versão do app aparece em **Você → "Sua conta de anfitrião · versão xxxxxxx"** (`/eventos/voce`): confira que é a versão publicada antes de começar.

## 0. Preparação
- Conta Google do anfitrião (a que criará os eventos) e uma conta Google com papel **Master** (para o painel `/master`).
- Segundo aparelho para fazer de **convidado** (sem login). Câmera liberada no navegador.
- Master: abra `/master` → **Configurações (M14)** e anote: ambiente do pagamento, "Checkout ligado", validade do Pix, chave do cartão (`validapay_card`, deve estar **desligada**).
- Para testar pagamento barato: **Planos (M03)**, ative o plano "Teste R$ 1" (`teste1real`) para o ambiente em uso e desative depois. Preço de cada plano vem do banco (ex.: Festa R$ 59,90), não do desenho.

## 1. Abertura e instalação
1. Abra `/` no celular: vídeo da abertura, botões "Tenho um convite", "Montar câmera" (ou "Minhas câmeras" se logado) e "Experimentar câmera".
2. Instale na tela inicial (PWA): ao abrir, o splash aparece por ~1,4 s. Conferir ícone e nome "Revela".
3. Modo avião: abra `/offline` e uma tela já visitada; deve mostrar a tela "Sem internet" (não "Algo deu errado").

## 2. Login e criação (anfitrião)
1. "Montar câmera" → entrar com Google.
2. **Passo 1/8 Embalagem:** trocar entre Festa, Casamento, Aniversário, Noite; o texto muda; Próximo.
3. **Passo 2/8 Nome do evento:** digitar nome; chips de sugestão; vazio deve bloquear com mensagem.
4. **Passo 3/8 Quando é a festa:** tocar em Dia, Começa, Termina e escolher valores; termina antes de começar vira "no dia seguinte"; fim em menos de 30 min deve bloquear.
5. **Passo 4/8 Quando revelar:** as 4 opções (festa acabar, dia seguinte 12:00, um dia depois, escolher dia e hora). Escolher "dia e hora" no passado deve bloquear; antes do fim da festa deve bloquear. Conferir a frase "Todo mundo recebe o aviso…".
6. **Passo 5/8 Poses:** 10/24/27/36; legenda "Grátis" ou "exige <plano>".
7. **Passo 6/8 Filme:** "Natural" × "Filme 35mm" lado a lado; escolher.
8. **Passo 7/8 Quem vê:** "Convidados veem o feed" e "Permitir baixar em alta" (ligar e desligar).
9. **Passo 8/8 Plano:** o plano sugerido pelas poses vem marcado; Grátis cria direto ("Criar câmera") → diálogo "Antes de criar" (duas caixas, "Aceitar" só habilita com as duas) → tela "A câmera de X está pronta".

## 3. QR code (substitui PDF/impressão)
1. Na tela "câmera pronta": **Baixar QR code** abre folha com SVG, PNG 2048 px (fundo branco) e PNG transparente.
2. Baixe os três. No iPhone: salvar em Arquivos; abrir o SVG no Canva/Figma e colocar numa arte; PNG transparente sobre fundo colorido.
3. Leia o QR com a câmera nativa de outro celular: deve abrir `https://fotosdocasamento.online/e/<código>`.
4. Painel → **Convites e mesas**: criar uma mesa e baixar o QR dela (nome do arquivo com a mesa).

## 4. Convidado (segundo aparelho)
1. Leia o QR pela câmera nativa → tela "Entrar no evento": nome obrigatório (vazio dá erro), e-mail opcional.
2. "Entrar e fotografar" → diálogo "Antes de fotografar" (Termos e Política) → pré-permissão da câmera → Liberar.
3. Câmera: contador de poses, flash, virar câmera, **Filme 35mm** com tom quente, grão e carimbo; tirar fotos até o filme acabar ("Seu filme acabou").
4. "Enviar do rolo da câmera": escolher fotos da galeria (várias).
5. Abas: **Feed** (laboratório: "NO LABORATÓRIO", contagem), **Minhas** (poses e horários), **Programação**, **Você** (poses usadas, avisos, e-mail, sair, apagar dados).
6. Editar foto antes da revelação (tela de edição) e remover.
7. Negue a câmera no navegador: a tela de ajuda aparece com os passos; "galeria" continua funcionando. Teste também com rede ruim (modo avião durante o envio: fila local e reenvio).
8. Convidado bloqueado e evento lotado: veja o painel (seção 5) e confirme "Câmera lotada" quando passar do limite.

## 5. Painel do anfitrião
1. **Resumo:** contagens e cartões (Convidados, Convites e mesas, Programação, Avisos, Moderação, Downloads, Aparência, Plano).
2. **Convidados:** tocar numa pessoa → Bloquear / Desbloquear (o convidado perde o acesso e vê a mensagem de bloqueio).
3. **Programação e local:** adicionar/editar/remover momentos e Salvar.
4. **Aviso aos convidados:** texto até 140 caracteres, início e fim; confira no feed do convidado.
5. **Ajustes (17):** linhas Fecha/Revela/Poses/Filme/Feed; prorrogar fim; "Mais": capacidade, quem vê, **Baixar em alta**, nome, código de presente, excluir.
6. **Moderar antes de revelar (17c):** remover/restaurar fotos; ver "Motivos" das denúncias.
7. **Moderar comentários (17i)** e **Downloads:** ZIP das fotos e CSV da lista; conferir a nota de prazo de guarda.
8. **Excluir evento (17j):** só no fim dos testes, com confirmação.

## 6. Revelação
1. **Revelar agora (único caminho):** 17c → "Revelar agora" → confirmar; só aparece com revelação pendente. Repetir o clique deve avisar "Este evento já foi revelado." e não duplicar e-mail.
2. Convidado com e-mail cadastrado (Você → Avisos): recebe o e-mail de revelação (uma vez). Link do e-mail → `/email/sair?t=…` sai da lista e permite "Voltar a receber".
3. Aviso no aparelho (notificação do navegador, se permitido) → telas "Aviso de revelação" e "Revelou" → feed.
4. **Feed (24d):** curtir, abrir foto (24f), comentários (24e: comentar, curtir, responder com @, apagar o seu), **Denunciar** foto e comentário **escolhendo o motivo** (24g).
5. Convidado sem "Baixar em alta" permitido: o botão **não aparece** nas fotos dos outros; com permitido: "Baixar em alta" baixa o arquivo.
6. **Retrospectiva (24h)** após o fim.
7. Anfitrião: **Revelados** (aba): galeria, foto aberta (estrela "Escolha dos noivos", Mais, quem reagiu, esconder/remover), **Álbum impresso**.

## 7. Pedido de impressão
1. Revelados → álbum (19b) → "Escolher as fotos": produto, quantidade, fotos, contato e endereço → "Enviar pedido" → confirmação com status. Reenviar não duplica.
2. `/eventos/pedidos`: lista, status e **cancelar** (só enquanto "solicitado").
3. Master → **Impressões** (`/master/impressoes`): ver o pedido, mudar status (solicitado → em produção → enviado → entregue), cancelar com motivo, **Exportar**.

## 8. Pagamento (faça depois dos blocos 2–6)
Pré-condições: ver seção 0. Use um evento novo no plano Grátis.
1. Painel → Ajustes/Plano → escolher um plano pago (ou "Teste R$ 1") → **14h** (medidores de convidados e poses) → "Escolher para X".
2. **14a Resumo:** valor, método Pix, campo CPF/CNPJ (o provedor exige) → "Pagar … com Pix".
3. **14b Pix:** QR, contagem "EXPIRA EM mm:ss", copia e cola (botão "Copiar código Pix" → "Código copiado"), pagar no app do banco.
4. Confirmação automática: tela **Pago.** (14f) e plano liberado no painel; conferir limites novos (convidados e poses).
5. **Master → Pagamentos (M05/M06):** pedido `pago`, valor, método, recibo; **Exportar** CSV. Plano do evento atualizado em Eventos (M02).
6. Expirar: crie outro pedido Pix e **não pague**; passado o prazo (M14) a tela muda para "Pagamento expirado" e "Tentar novo pagamento"; o reconciliador (a cada 5 min) também encerra sozinho.
7. Cancelar pagamento pendente e **Trocar forma de pagamento** (quando houver reserva).
8. **Estorno de teste:** só no ambiente sandbox ("Solicitar estorno de teste"). Em produção, estorno pelo Master/provedor.
9. **Cartão (opcional, só com a chave ligada):** Master → M14 → ligar `validapay_card` com motivo → no checkout aparece "Cartão de crédito" → dados do cartão, telefone e endereço → 3DS "Confirme no app do banco" → aprovado/recusado ("O banco recusou"). Desligue a chave ao terminar.
10. Conferir **Auditoria (M13)**: pedido, mudança de chave e exportações aparecem.

## 9. Master
Faça login com a conta Master (Google). Para cada tela abaixo, confira dados, busca, filtros e o botão **Exportar** (CSV `revela-<tela>-AAAAMMDD-HHMM.csv`, abre no Excel com acentos):
M01 Visão geral · M02 Eventos (filtros Todos/Rolando/Aguardando/Revelados/Denúncias/Excluídos) · M03 Planos e preços (editar preço pede confirmação, **TOTP** e motivo; M04 confirmar novo preço) · M05 Pagamentos (+ **Conciliar agora**, pede autenticador) · M06 Detalhe · M07 Cortesias (gerar código, conferir uso) · M08 Revelações (**Revelar agora**, contagem de avisos) · M09 Moderação (motivos das denúncias, sem imagens) · M10 Pessoas (abas) · M11 Storage e saúde · M12 LGPD (retenção, pedidos de exclusão) · M13 Auditoria · M14 Configurações (ambiente, checkout, validade do Pix, `validapay_card`, suporte, folga de capacidade) · **Impressões**.
Páginas antigas (digitando a URL): `/master/usuarios`, `/organizadores`, `/participantes`, `/storage`, `/analytics`: só confira que abrem; estão pendentes de redesenho (ver `docs/handoff/MASTER-PAGINAS-ANTIGAS.md`).

## 10. Apoio e conta
`/precos` (planos do catálogo), `/ajuda` (busca e acordeão), `/termos` e `/privacidade` (abas, versão e data), `/exemplo` (festa de exemplo), `/conta/excluir` (mostra quantos eventos serão excluídos; **não confirme** em conta real), `/offline`.

## 11. Acessibilidade e telas
Repita os blocos 2, 4 e 6 em 360, 390 e 430 px de largura (ou no modo responsivo do navegador): sem rolagem lateral, botões com 44 px, foco visível com Tab, leitor de tela anuncia os botões das fotos.

## 12. Filtro 35mm (comparação)
Tire a mesma cena com "Natural" e "Filme 35mm" (dois eventos): o 35mm deve ter pretos levemente levantados e esverdeados, realces âmbar, cores moderadas, grão, vinheta leve, brilho nos realces e o carimbo `'AA MM DD`. A prévia ao vivo deve parecer a foto final. Parâmetros e como ajustar: `docs/qa/FILTRO-35MM.md`.

## 13. Se algo der errado
- App antigo na tela: feche o app instalado, abra de novo (o service worker troca o cache no próximo carregamento); confirme a versão em Você.
- Rollback do app: promover o deployment anterior na Vercel (ver `docs/supabase/PUBLISH-AND-ROLLBACK.md`).
- Rollback do banco (somente incidente): `supabase/ops/rollback_revela_20261109.sql`, `rollback_revela_20261110_backend.sql`, `rollback_revela_20261110_exports.sql`.
