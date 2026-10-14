# 004 — Visibilidade dos recados (CG-3)

- Status: **recomendada**
- Autor: Planejador · Data: 2026-10-13
- Origem: `docs/copy/consentimento-convidado.md` §5.2 (CG-3), auditoria do PR #2.

## Contexto

A tela chama-se "Recados para os noivos", mas o código faz outra coisa:

- `GET /api/events/:id/recados` **não exige nenhuma credencial**: devolve até 200 recados com `autor` (nome) e `texto` a qualquer pessoa que tenha o link do evento, inclusive sem ter entrado como convidado.
- `POST` só exige `guestId` (um id, sem segredo) e aceita até 5 recados de 400 caracteres por convidado.
- O texto livre pode conter dado pessoal de terceiros e, em casamento, é comum conter dado sobre saúde, família, menores e relacionamentos. O convidado escreve achando que fala com o casal.

Isso desalinha expectativa e prática (princípios da finalidade e da transparência, LGPD art. 6º, I e VI) e amplia a exposição (necessidade, art. 6º, III). A redação atual proposta no PR #2 ("Os recados aparecem para todos os convidados, com o seu nome") corrige a transparência, mas mantém a exposição e **ainda não cobre quem nem entrou** (a rota é aberta).

## Opções

### A. Manter públicos entre convidados (mural), só corrigindo o aviso
- Prós: zero mudança de produto; efeito "mural" calorosa.
- Contras: contradiz o título e a expectativa; exposição máxima de texto livre com nome; aumenta a carga de moderação; o aviso vira a única proteção; exige corrigir a rota (hoje aberta a não convidados).
- Esforço: baixo (aviso + exigir `guestId` válido na leitura).

### B. Privados para o casal por padrão; mural público só por escolha explícita
- Padrão: o recado é visível só à organização (casal e cerimonial) e ao próprio autor. O convidado vê apenas os **seus** recados.
- Mural opt-in em dois níveis: (1) o casal liga "Mural de recados" nas Configurações (desligado por padrão); (2) cada convidado, ao escrever, decide por recado "Mostrar para os outros convidados" (caixa desmarcada). Só aparece no mural o que cumpre os dois.
- Prós: alinha ao nome da tela e à expectativa; minimiza exposição; mantém o efeito mural para quem quer; texto de aviso curto e verdadeiro.
- Contras: mais um campo e uma configuração; recados existentes precisam de regra de migração.
- Esforço: médio (campo `visibilidade`, filtro no servidor, 2 telas de texto).

### C. Públicos, mas só depois de aprovados pelo casal (curadoria)
- Todo recado nasce privado; o casal aprova os que viram mural.
- Prós: controle total do casal, bom para lista grande.
- Contras: trabalho de moderação para o casal no dia da festa; o autor não decide sobre a própria exposição; ainda expõe com nome o que o autor pensava ser privado, se o casal aprovar sem avisar.
- Esforço: médio-alto (fila de aprovação).

## Decisão recomendada

**B, com C como evolução posterior opcional (aprovação pelo casal só para o mural).**

Regras de produto:
1. Campo `visibilidade ∈ {casal, mural}` em cada recado; **padrão `casal`**. O servidor decide; a tela nunca filtra.
2. `GET /recados` passa a exigir identidade: convidado válido (`guestId`) vê **só os próprios** + os `mural` se `config.muralRecados` ligado; organização (cookie/token de organização) vê todos; sem credencial → 401/403. O `autor` só vai para fora do mural se `mostrarAutor` estiver ligado e o recado for `mural`.
3. `config.muralRecados` entra em `CONFIG_PADRAO` como `false`.
4. O autor pode **apagar o próprio recado** (hoje só a organização apaga). Isso atende retirada de consentimento (CG-4) sem fluxo manual.
5. Migração dos recados existentes: viram `casal` (escolha conservadora; ninguém passa a ser exposto por migração). Registrar no changelog.
6. Retenção, exportação (CSV/ZIP do evento) e exclusão em cascata incluem recados; recado privado entra no pacote do casal, não no do convidado.
7. Texto de interface (Redator, `consentimento-convidado.md` §5.2 e A7):
   - padrão: "**Seu recado é só para os noivos.**"
   - com mural ligado e caixa marcada: "**Este recado vai aparecer para todos os convidados, com o seu nome.**"
8. Teste obrigatório (Forja-Org/Testes): sem credencial não lê; convidado A não lê o recado privado de B; recado `mural` só aparece com mural ligado; `<img onerror>` no texto é escapado; autor apaga o próprio e não o alheio.

## Consequências

- Resolve CG-3; o Redator ajusta §5.2 e remove a frase "aparecem para todos" como padrão.
- Muda a rota pública atual: quebra de compatibilidade interna (a tela `recados.html` passa a enviar `guestId`/cookie na leitura). Nenhum cliente externo depende dela.
- Interage com a decisão 002 (cookie de sessão da organização) e com a Forja-LGPD (exportar/apagar). Fica sob auditoria do Planejador por tocar dado pessoal.
