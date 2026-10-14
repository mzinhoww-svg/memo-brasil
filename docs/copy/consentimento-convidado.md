# Consentimento do convidado

> **Rascunho v0.1 · 13/10/2026 · Redator.** ⚖️ **CG-n** = revisão jurídica. 🔧 = depende de implementação.
> Onde aparece: na tela do convite (`/e/:id`), **antes** de o convidado entrar no álbum, e novamente em "Sobre suas fotos" no início.
> Não é um muro de texto: **um aviso curto sempre visível + um "saiba mais" abre o texto completo.**

---

## 1. Aviso curto (fica na tela do convite, acima do botão)

> **Antes de entrar**
> **Suas fotos serão vistas por todos os convidados** quando o álbum for revelado, com o seu nome. 📷
> Os noivos e a equipe do Memo Brasil também podem ver as fotos para organizar e moderar.
> [Saiba mais]

Regras de interface:

- O texto **em negrito** é obrigatório e literal: "**Suas fotos serão vistas por todos os convidados**".
- O botão de entrada só fica ativo depois do aceite (caixa de seleção, desmarcada por padrão). 🔧

## 2. Caixa de aceite

> ☐ **Li e concordo** com o uso das minhas fotos como descrito. Li os [Termos de Uso] e a [Política de Privacidade].

Botão: **Entrar no álbum** (desabilitado até marcar)

Mensagem se tentar sem marcar:
> Para entrar, precisamos do seu "de acordo". É rapidinho.

## 3. Texto completo ("Saiba mais")

**O que acontece com as suas fotos**

1. **Você tira a foto.** Ela é enviada e guardada com segurança, com o seu nome.
2. **Fica escondida.** Ninguém vê as fotos até a hora da revelação que os noivos escolheram: **{data e hora}**.
3. **A revelação.** Quando o álbum abre, **todos os convidados deste casamento** passam a ver todas as fotos, **com o nome de quem tirou**.
4. **Depois.** Os noivos podem baixar o álbum. Guardamos tudo por **12 meses** depois da revelação e depois apagamos.

**Quem pode ver**
- **Todos os convidados** do casamento, depois da revelação.
- **Os noivos e o cerimonial**, antes e depois, para organizar e apagar o que for impróprio.
- **A equipe do Memo Brasil**, apenas para suporte, moderação e segurança. Esses acessos ficam registrados.

**O que a gente pede de você**
- Fotografe pensando que **todo mundo vai ver**.
- Não tire fotos de quem não quer aparecer e cuide com as crianças.
- Nada de conteúdo ofensivo ou íntimo.

**O que a gente não faz**
- Não vendemos nem usamos suas fotos para anúncios.
- Não fazemos reconhecimento facial.
- Não guardamos sua localização.

**Seus direitos**
- Quer **retirar uma foto**? Peça aos noivos ou escreva para [encarregado@dominio.com.br].
- Quer saber o que guardamos sobre você, corrigir ou apagar? Também é por lá.
- Pode **mudar de ideia** sobre os avisos a qualquer momento.

[Ler Termos de Uso] · [Ler Política de Privacidade]

---

## 4. Variações de contexto

### 4.1 Se a organização desligou "Mostrar o nome de quem tirou cada foto"
Troque o trecho "com o seu nome" por "sem identificar quem tirou".

> **Suas fotos serão vistas por todos os convidados** quando o álbum for revelado. O nome de quem tirou não aparece.

### 4.2 Se o álbum já foi revelado (convidado que chegou depois)
> O álbum deste casamento já está aberto. Você pode ver as fotos de todos. Se tirar fotos agora, **elas também serão vistas por todos os convidados**.

(Na prática, a câmera fecha após a revelação; usar só se o produto permitir fotos depois.)

### 4.3 Aviso de menores (rodapé do "Saiba mais")
> Tem crianças e adolescentes nesta festa. Se você fotografar um, pense se os pais gostariam que a foto fosse vista por todos. Pais e responsáveis podem pedir a retirada de qualquer foto.

⚖️ **CG-1 — Menores.** Esse aviso reduz o risco, mas **não substitui** o consentimento específico dos pais para dados de crianças (LGPD, art. 14, §1º). Ver **PP-7**.

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

Na tela de recados (comportamento **atual**: todos os convidados leem os recados, com nome):
> **Os recados aparecem para todos os convidados, com o seu nome.** Escreva pensando que todo mundo vai ler.

⚖️ **CG-3 — Visibilidade dos recados.** O código atual lista recados com autor a todos os convidados (rota `/recados`), embora a tela se chame "Recados para os noivos". Decidir: (a) manter público e usar o texto acima; ou (b) tornar privado aos noivos e usar "Seu recado é só para os noivos". Ajustar texto e produto juntos.

---

## 6. Registro do consentimento 🔧

Para provar o aceite (LGPD, art. 8º, §2º), registrar por convidado, **sem guardar nada além do necessário**:

| Campo | Exemplo |
|---|---|
| Evento | id do casamento |
| Convidado | id gerado (não o nome) |
| Versão do texto aceito | `consentimento-convidado v1.0` |
| Data e hora (UTC) | `2026-10-13T20:41:00Z` |
| Caixas marcadas | fotos: sim · avisos: não |

⚖️ **CG-4 — Prova e retirada.** Validar o conteúdo do registro, o prazo de guarda do próprio registro e como a **retirada** do consentimento funciona na prática (apagar as fotos já enviadas? só impedir novas?). Definir no produto antes de publicar.

---

## 7. Mensagens de recusa

Quem não marcar ou sair:

> **Tudo bem!** Sem o "de acordo" não dá para tirar fotos neste álbum. Se mudar de ideia, é só voltar pelo QR Code. 💛

---

## 8. Texto para a organização repassar aos convidados (convite impresso ou mensagem)

> Os noivos usarão o **Memo Brasil**: escaneie o QR Code, tire fotos durante a festa e elas serão reveladas para todos juntos depois. **Suas fotos serão vistas por todos os convidados.** Se preferir não aparecer, avise os noivos.

⚖️ **CG-5 — Alternativa ao aceite.** Prever que o convidado possa **não** participar sem prejuízo (e sem perder o convite).
