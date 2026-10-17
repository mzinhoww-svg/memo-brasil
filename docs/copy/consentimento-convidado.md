# Consentimento do convidado

> **Rascunho v0.2 · 16/10/2026 · Redator.** ⚖️ **CG-n** = revisão jurídica. 🔧 `feature.<chave>` = depende de implementação (ver `features.json`).
> Onde aparece: na tela do convite (`/e/:id`), **antes** de o convidado entrar no álbum, e novamente em "Sobre suas fotos" no início.
> Não é um muro de texto: **um aviso curto sempre visível + um "saiba mais" abre o texto completo.**

---

## 1. Aviso curto (fica na tela do convite, acima das caixas)

> **Antes de entrar**
> **Suas fotos serão vistas por todos os convidados** quando o álbum for revelado, com o seu nome. 📷
> Os noivos e a equipe do Lume também podem ver as fotos para organizar, dar suporte e moderar.
> [Saiba mais]

Regras de interface:

- O texto **em negrito** é obrigatório e literal: "**Suas fotos serão vistas por todos os convidados**".
- O botão de entrada só fica ativo com as **três caixas** da seção 2 marcadas. Todas começam desmarcadas. 🔧 `feature.aceite_registrado`

## 2. Caixas de aceite (ciência, consentimento e idade ficam separados)

> ☐ **Li** os [Termos de Uso] e a [Política de Privacidade]. *(ciência)*
> ☐ **Concordo** que as minhas fotos sejam vistas por todos os convidados deste casamento, como descrito acima. *(consentimento)*
> ☐ **Tenho 18 anos ou estou com um responsável** que sabe que estou aqui. *(idade)*

Botão: **Entrar no álbum** (desabilitado até marcar as três)

Por que são três caixas: ler os textos (ciência) não é o mesmo que autorizar o uso das próprias fotos (consentimento), e as duas coisas são registradas separadamente. A terceira não pede data de nascimento nem documento.

Mensagem se tentar sem marcar:
> Para entrar, precisamos do seu "de acordo". É rapidinho.

## 3. Texto completo ("Saiba mais")

**O que acontece com as suas fotos**

1. **Você tira a foto.** Ela é enviada e guardada com segurança, com o seu nome.
2. **Fica escondida.** Ninguém vê as fotos até a hora da revelação que os noivos escolheram: **{data e hora}**.
3. **A revelação.** Quando o álbum abre, **todos os convidados deste casamento** passam a ver todas as fotos, **com o nome de quem tirou**.
4. **Depois.** Os noivos podem baixar o álbum. Guardamos tudo por **{retencao_meses} meses** depois da revelação e depois apagamos. 🔧 `feature.retencao` *A cópia que os noivos baixarem fica com eles e não é apagada por nós.*

**Quem pode ver**
- **Todos os convidados** do casamento, depois da revelação.
- **Os noivos e o cerimonial**, antes e depois, para organizar e apagar o que for impróprio.
- **A equipe do Lume**, apenas para suporte, moderação e segurança. As ações da administração ficam registradas. 🔧 `feature.auditoria_motivo` *O acesso às fotos e o motivo também ficam registrados.*

**O que a gente pede de você**
- Fotografe pensando que **todo mundo vai ver**.
- Não tire fotos de quem não quer aparecer e cuide com as crianças.
- Nada de conteúdo ofensivo ou íntimo.
- Fotos de celular podem trazer, escondido no arquivo, o lugar onde foram tiradas. Se não quiser isso, desligue a localização da câmera. 🔧 `feature.exif` *Quando tirarmos esse dado automaticamente, esta linha muda.*

**O que a gente não faz**
- Não vendemos nem usamos suas fotos para anúncios.
- Não fazemos reconhecimento facial.

**Seus direitos**
- Quer **retirar uma foto sua** ou um recado? Peça aos noivos ou escreva para [encarregado@dominio.com.br]. 🔧 `feature.apagar_proprio` *Você mesmo apaga suas fotos e recados, até o fim do prazo de guarda.*
- **Apareceu numa foto que não gostou?** Você pode pedir a retirada, sem precisar explicar muito. Fale com os noivos ou com o encarregado.
- Quer saber o que guardamos sobre você, corrigir ou apagar? Também é por lá.
- Pode **mudar de ideia** sobre os avisos a qualquer momento.

[Ler Termos de Uso] · [Ler Política de Privacidade]

---

## 4. Variações de contexto

### 4.1 Com nome ou sem identificar (a versão aceita vale para sempre)

O aceite grava **qual versão** o convidado viu. O casal pode **ocultar** os nomes a qualquer momento, mas **não pode passar a exibi-los** se o convidado aceitou "sem identificar". Avisar os convidados de uma mudança não substitui o consentimento deles. 🔧 `feature.nome_travado`

**Versão com nome** (padrão):
> **Suas fotos serão vistas por todos os convidados** quando o álbum for revelado, com o seu nome.

**Versão sem identificar** (se a organização desligou "Mostrar o nome de quem tirou cada foto" antes de o convidado entrar):
> **Suas fotos serão vistas por todos os convidados** quando o álbum for revelado. O nome de quem tirou não aparece.

**Se o casal ocultar os nomes depois** (convidado que aceitou "com nome"): nada a pedir, o convidado passa a ficar menos exposto. Se quiser avisar, usar: `Os noivos deixaram o álbum sem nomes. Suas fotos continuam visíveis a todos os convidados, sem identificar quem tirou.`

### 4.2 Se o álbum já foi revelado (convidado que chegou depois)
> O álbum deste casamento já está aberto. Você pode ver as fotos de todos. Se tirar fotos agora, **elas também serão vistas por todos os convidados**.

(Na prática, a câmera fecha após a revelação; usar só se o produto permitir fotos depois.)

### 4.3 Aviso de menores (rodapé do "Saiba mais")
> Tem crianças e adolescentes nesta festa. Se você fotografar um, pense se os pais gostariam que a foto fosse vista por todos. Pais e responsáveis podem pedir a retirada de qualquer foto, e a gente retira.

⚖️ **CG-1 — Menores.** Dois pontos separados: (a) a **idade de quem entra**, resolvida pela terceira caixa ("18 anos ou com responsável"), sem coletar data de nascimento; (b) as **fotos de menores tiradas por convidados**, tratadas pelo art. 14 (melhor interesse) com retirada a pedido do responsável. O aviso reduz o risco, mas não substitui validação jurídica. Ver **PP-7**.

---

## 5. Avisos adicionais, sempre opcionais e separados

### 5.1 Avisos no aparelho (push)
> **Quer ser avisado quando o álbum abrir?**
> Mandamos uma notificação quando as fotos forem reveladas e quando os noivos tiverem novidades. Dá para desligar quando quiser.
> [Ativar avisos] · [Agora não]

Consentimento **separado** do aceite das fotos e **nunca** pré-marcado. ⚖️ **CG-2.**

### 5.2 Presença e recados
Na tela de presença:
> **Sua resposta é só para os noivos.** Eles usam para se organizar.

Na tela de recados, **padrão** (decisão 004: o recado é privado ao casal; leitura exige credencial; mural desligado) 🔧 `feature.recados_privados`:
> **Seu recado é só para os noivos.**

Com o **mural** ligado pelo casal, o convidado vê uma caixa **desmarcada** abaixo do campo: ☐ *Mostrar para os outros convidados.* Marcando:
> **Este recado vai aparecer para todos os convidados, com o seu nome.**

E em qualquer caso, ao lado de cada recado enviado por ele: `Apagar meu recado` 🔧 `feature.apagar_proprio`

> **Provisório, só enquanto a decisão 004 não estiver no ar.** Hoje a rota `/recados` mostra os recados, com nome, a qualquer pessoa com o link. Se a tela for publicada antes da decisão 004, o único aviso honesto é: "Os recados aparecem para todos os convidados, com o seu nome. Escreva pensando que todo mundo vai ler." Preferir **não publicar** a tela de recados até a correção.

⚖️ **CG-3 — Visibilidade dos recados.** Resolvida em direção à opção B da decisão 004 (privado por padrão, mural opt-in em dois níveis). Revisar o texto final com o produto implementado.

---

## 6. Registro do consentimento 🔧 `feature.aceite_registrado`

Para provar o aceite (LGPD, art. 8º, §2º), registrar por convidado, **sem guardar nada além do necessário**:

| Campo | Exemplo |
|---|---|
| Evento | id do casamento |
| Convidado | id gerado (não o nome) |
| Versão do texto aceito | `consentimento-convidado v1.0` |
| Variante do aviso | `com_nome` ou `sem_identificar` |
| Data e hora (UTC) | `2026-10-13T20:41:00Z` |
| Ciência dos Termos e da Política | sim (versões dos dois textos) |
| Consentimento das fotos | sim |
| Declaração de idade ("18 anos ou com responsável") | sim |
| Avisos no aparelho (push) | não |

Não se coleta data de nascimento nem documento.

⚖️ **CG-4 — Prova e retirada.** Validar o conteúdo do registro, o prazo de guarda do próprio registro e a **retirada**: o convidado apaga as **próprias** fotos e recados sozinho, até o fim da retenção 🔧 `feature.apagar_proprio`; fotos de **terceiros** em que ele aparece seguem pela denúncia e ocultação 🔧 `feature.denuncia` 🔧 `feature.ocultar`.

---

## 7. Mensagens de recusa

Quem não marcar ou sair:

> **Tudo bem!** Sem o "de acordo" não dá para tirar fotos neste álbum. Se mudar de ideia, é só voltar pelo QR Code. 💛

---

## 8. Texto para a organização repassar aos convidados (convite impresso ou mensagem)

> Os noivos usarão o **Lume**: escaneie o QR Code, tire fotos durante a festa e elas serão reveladas para todos juntos depois. **Suas fotos serão vistas por todos os convidados.** Se preferir não aparecer, avise os noivos.

⚖️ **CG-5 — Alternativa ao aceite.** Prever que o convidado possa **não** participar sem prejuízo (e sem perder o convite).
