# Revela 2.0: implementar o console Master completo (M15 a M32)

Branch `feat/revela-redesign`. Referência: `design-system/revela/master/` (`html/Master-*.html`, `png/`, `INDICE.csv`, `CLASSES-NOVAS.md`, `LEIA-ME.md`). As 94 telas já estão convertidas em `web/src/revela/screens/Master*.tsx` (fixture) e registradas em `web/src/revela/registry.ts` (ids `M15`… e variantes `M15-v`, `M15-e`, `M15-p`, `M15-c`, `M19-f1`…), com rota de desenvolvimento `/dev/revela/<html>`.

## Regras (as mesmas do restante do redesign)
1. Porte o HTML para React: apague o JSX atual da tela e escreva a partir do HTML de referência; não aproveite layout do console antigo. O componente da tela recebe props e tem o desenho como padrão (como nas outras telas Revela).
2. Textos idênticos; só mudam os dados (comentário `<!-- DINÂMICO: ... -->` no início de cada HTML).
3. Nada a mais, nada a menos: toda coluna, filtro, botão e cartão do desenho existe; não acrescente nada fora dele.
4. CSS: o bloco "Master: console completo" de `revela2-screens.css` já está em `styles/revela2.css` (hex trocados por tokens). Não crie estilo onde já há classe.
5. Dados reais: use as funções e tabelas da coluna "dados (origem)" de `INDICE.csv`. Se uma função não devolve um campo do desenho, estenda a função com migration aditiva e teste (pgTAP). Não esconda a coluna.
6. Divergência por regra de negócio: pare e pergunte com a captura e a referência lado a lado (no fluxo autônomo: decida a opção mais segura, registre em `docs/evidence/revela-fiel/master/DIVERGENCIAS.md` e siga).

## Telas e rotas
M15–M19 Pessoas (`/master/pessoas?aba=contas|organizadores|convidados|convites|equipe`) · M20 Visão geral com "Atividade por dia" (`/master`) · M21 Detalhe do evento (`/master/eventos/[id]`) · M22 Eventos de teste (`/master/eventos?filtro=teste`) · M23 folha "Conciliar agora" (sobre `/master/pagamentos`) · M24 folha "Exportar" (todas as listas) · M25 folha "Revelar agora" (Master e painel do anfitrião) · M26 Moderação com motivos (`/master/moderacao?aba=fotos|comentarios`) · M27 Storage e saúde (`/master/saude`) · M28 Auditoria com filtros (`/master/auditoria`) · M29/M30 Impressões (`/master/impressoes`, `/master/impressoes/[id]`) · M31 Configurações (`/master/configuracoes`) · M32 Acesso limitado (qualquer `/master` sem permissão).
- Menu lateral: ordem e nomes do HTML; "Impressões" entre Moderação e Storage e saúde.
- Rotas antigas `usuarios`, `organizadores`, `participantes`, `storage`, `analytics` deixam de existir: redirecionar para a aba/tela que a absorveu (ver `LEIA-ME.md`).
- Substituídas: M10, M01, M09, M11, M13, M14 dão lugar às novas; remova o código antigo (`ui.tsx`, `.adm-*`, `modules.ts`, `admin.css` no que ficar sem uso).

## Estados e folhas
- Quatro estados por tela principal: vazio (`--vazio`), erro (`--erro`), sem permissão (`--sem-permissao`), carregando (`--carregando`), com os textos do HTML. Sem permissão: o título da página vira o nome da área (ex.: "Eventos"), nunca o nome do evento ou da pessoa.
- Folhas de ação (`--folha-*`): um componente único de folha, com campo "Motivo" de 10 a 500 caracteres, contador e aviso de auditoria; o botão de confirmar fica desligado até o motivo ter 10 caracteres.
- M24 (Exportar) e M25 (Revelar agora) são um componente cada, usado em todos os lugares; a M25 é a mesma do painel do anfitrião.

## Regras de negócio que as telas mostram
- Privacidade: nunca renderizar foto privada no console (moderação mostra id curto, evento e motivos agregados); nunca devolver token de convite nem e-mail de aviso de revelação; quem denunciou nunca aparece; master vê e-mail e contato completos, support e auditor veem `a***@dominio`, **mascarado no servidor**.
- Equipe (M19): conceder e revogar pedem motivo; o último master não pode ser revogado (linha mostra "último master" no lugar do botão).
- Eventos de teste (M21, M22): só master marca, desmarca e exclui; evento pago não vira teste; lote com evento real ou pago é recusado inteiro e a folha de recusa lista o motivo de cada evento.
- Conciliar (M23): pede o código do autenticador quando a sessão não tem aal2; depois mostra conciliados, falhas e sem mudança; 1 minuto de espera entre chamadas, com contagem regressiva.
- Exportar (M24): mostra tela, período, filtros, formato e linhas estimadas; acima de 50 mil linhas avisa que o arquivo vem truncado; toda exportação entra na auditoria.
- Revelar agora (M25): motivo obrigatório; botão principal "Manter a hora"; mensagens do servidor como estão: "Este evento já foi revelado.", "Evento sem revelação ligada." e "Sem permissão".
- Impressões (M30): status só avança solicitado → em produção → enviado → entregue; cancelar pede motivo e não desfaz; nota interna só do master.
- Configurações (M31): ambiente do pagamento somente leitura; validade do Pix de 5 a 1.440 minutos; cada alteração abre a folha com valor antigo, novo e motivo.
- Datas e números: fuso de Cuiabá e pt-BR.

## Decisões confirmadas pelo usuário
1. **Cartão em M31: manter a chave "Cartão ligado" (`validapay_card`)** como no desenho (desligada por padrão).
2. **Impressões: o item do menu e as rotas `/master/impressoes*` só existem com a chave `printed_album` ligada** (nova, desligada por padrão, ligável em Configurações; sem ela o item some do menu, as rotas respondem 404 e o pedido de impressão do anfitrião (19b) fica oculto).
3. Matriz de papéis da M32: é proposta; comparar com as policies de `platform_roles` e registrar as diferenças em `DIVERGENCIAS.md`.
4. CNPJ e telefone do suporte em M31: usar os de `platform_settings` (os do desenho são fictícios).
As seis "Propostas" do fim do `LEIA-ME.md` NÃO entram.

## Aceite
- Fidelidade: para cada um dos 94 HTML, captura 1440×900 lado a lado com o PNG de referência em `docs/evidence/revela-fiel/master/<id>.png`, diff pixelmatch < 3% e uma linha no `CHECKLIST.md` (use o seed que reproduz os dados do desenho; `node scripts/revela-evidence.mjs <ids>`).
- Testes: permissão por papel em cada rota e ação (master, support, auditor, sem papel); mascaramento de e-mail no servidor; resposta de convites sem token; fila de moderação sem URL de foto nem denunciante; recusa de lote com evento real ou pago; espera de 1 minuto na conciliação; truncamento da exportação em 50 mil linhas; motivo com menos de 10 ou mais de 500 caracteres recusado no servidor; último master não revogável.
- Qualidade: lint, typecheck, vitest, testes de banco (pgTAP) e E2E verdes; Axe sem violações sérias; o console funciona em 1280 px sem rolagem lateral.
- Entrega: um commit por grupo (Pessoas, Visão geral, Eventos, Pagamentos, Revelações e moderação, Saúde e auditoria, Impressões, Configurações e acesso).
- Produção: não publicar sem confirmação do usuário; parar antes de aplicar migrations remotas e antes de promover.
