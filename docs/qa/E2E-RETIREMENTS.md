# Testes E2E retirados ou reescritos (Revela 2.0)

| Arquivo | Teste | Motivo | Cobertura substituta |
|---|---|---|---|
| web/e2e/produto.spec.ts | home mostra a linha de preço só do Grátis quando não há plano pago ativo | A abertura (Main) não tem mais a linha de preço "Grátis até 10 convidados." | `/precos local mostra só o Grátis...` no mesmo arquivo (preço, aviso "planos pagos voltam em breve") |
| web/e2e/produto.spec.ts | /precos: as 3 perguntas ("Como pago?", "E se passar do limite?", "Posso pedir reembolso?") e o link "Fale com a gente" | A tela de preços 30 é só h1, plano(s), aviso e botão "Montar câmera"; as perguntas de pagamento estão em /ajuda | `/ajuda é pública...` (perguntas e suporte por e-mail) |
| web/e2e/produto.spec.ts | rodapé nas rotas /precos e /ajuda | Só a abertura (/) tem rodapé; Preços e Ajuda são telas próprias sem `contentinfo` | `rodapé tem Termos...` (agora só em `/`, ausente no painel e no convite) |
| web/e2e/produto.spec.ts | cartão de mesa do QR: um cartão por mesa e a linha "Cada um tem N fotos. Revelamos..." | A tela 25 mostra um cartão em 4 modelos; o download por mesa vive na folha de download, e a linha do rolo não aparece mais no cartão | `QR das mesas: cartão com a redação do modelo...`; `qr-download.spec.ts` (SVG/PNG por mesa); `qr-copy.test.ts` (vitest) |
| web/e2e/studio-local.spec.ts | tema personalizado (paleta Oceano, `data-event-theme`, `--evento-superficie`) | Cores e fontes por evento foram removidas; a identidade é embalagem + filme + mensagem | `aparência: embalagem e mensagem valem na entrada do convidado...` |
| web/e2e/produto.spec.ts | home: 3 passos, "Grátis até 10 convidados." e CTA "Criar meu evento grátis" na abertura; "Minhas fotos"/"Agora" no /exemplo | Abertura nova (Main) com uma promessa e dois botões; o /exemplo não tem mais a aba "Minhas fotos" | `home mostra a proposta...` e `/exemplo: até 5 fotos...` |
