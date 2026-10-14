# Política de Privacidade — Memo Brasil

> **Rascunho v0.1 · 13/10/2026 · Redator.** Texto de produto, não parecer jurídico.
> Trechos marcados com ⚖️ **PP-n** exigem revisão de advogado(a) antes da publicação.
> Trechos marcados com 🔧 dependem de funcionalidade que ainda precisa existir (ver `README.md` desta pasta).
> Itens entre `[colchetes]` são dados a preencher.

---

## Em poucas palavras

Cuidamos das fotos e dos nomes que passam por aqui como se fossem de família. Resumo do que você vai ler:

- **Só pedimos o que o álbum precisa:** nome, fotos, recados e, para quem organiza, um contato.
- **Suas fotos ficam guardadas e escondidas** até a hora da revelação que o casal escolheu. Depois, **todos os convidados do casamento** podem vê-las.
- **Não vendemos seus dados**, não fazemos publicidade com suas fotos e não usamos reconhecimento facial.
- **Guardamos tudo por 12 meses** depois da revelação. Depois disso, apagamos.
- **Você manda nos seus dados:** pode pedir cópia, correção ou exclusão quando quiser.

---

## 1. Quem somos

O **Memo Brasil** é uma plataforma de álbum colaborativo de casamento, operada por **[RAZÃO SOCIAL], CNPJ [00.000.000/0000-00]**, com sede em **[ENDEREÇO]** ("nós").

⚖️ **PP-1 — Papéis (controlador × operador).** Este texto trata a plataforma como **controladora** dos dados de quem organiza o evento (conta, contato) e dos dados de segurança, e como **operadora** do conteúdo do álbum (fotos, recados, lista de convidados), tratado em nome do casal. O casal decide quem entra e o que fica. Confirmar se esse enquadramento é o desejado, porque ele muda quem responde a pedidos de titulares e o que precisa constar em contrato com o organizador.

**Encarregado(a) pelo tratamento de dados pessoais (DPO):**
**[NOME DO ENCARREGADO]** — **[encarregado@dominio.com.br]**
⚖️ **PP-2 — Encarregado.** Nome e canal reais são obrigatórios (LGPD, art. 41). Definir antes da publicação; aqui só há marcador.

---

## 2. Quem usa o Memo Brasil

| Quem | Como entra | O que acontece |
|---|---|---|
| **Organização** (casal e cerimonial) | Cria o evento e acessa o painel | Gerencia lista, programação, fotos e avisos |
| **Convidado** | Escaneia o QR Code e digita o nome | Fotografa, vê o álbum depois da revelação, confirma presença e deixa recados |
| **Equipe da plataforma** | Acesso interno | Dá suporte, modera e mantém o serviço no ar |

Convidados **não criam conta nem senha**.

---

## 3. Quais dados tratamos, para quê e com base em quê

⚖️ **PP-3 — Bases legais.** A tabela abaixo sugere uma base por finalidade (LGPD, art. 7). Validar cada uma, em especial o **consentimento** do convidado para fotos e avisos, e o **legítimo interesse** para moderação e segurança (exige teste de balanceamento documentado).

### 3.1 Dados de quem organiza o casamento

| Dado | Para quê | Base legal |
|---|---|---|
| Nome do evento, data, local, endereço, programação, mensagem aos convidados | Montar o convite e a página do evento | Execução do serviço pedido (art. 7º, V) |
| E-mail ou WhatsApp de contato | Entrar na conta por link, avisar que o álbum foi revelado, falar com você sobre suporte | Execução do serviço (art. 7º, V) |
| Lista de convidados (nome, grupo, acompanhantes, resposta de presença) | Controlar quem foi convidado e quem confirmou | Execução do serviço (art. 7º, V) — ver 3.4 |
| Registro de ações no painel (quem apagou foto, quem baixou o álbum) | Segurança e prestação de contas | Legítimo interesse (art. 7º, IX) |

### 3.2 Dados dos convidados

| Dado | Para quê | Base legal |
|---|---|---|
| Nome digitado ao entrar | Identificar suas fotos e recados e controlar quantas fotos você ainda pode tirar | Consentimento (art. 7º, I) |
| **Fotos** que você tira | Compor o álbum do casamento, que será visto por todos os convidados depois da revelação | Consentimento (art. 7º, I) |
| Recados | Entregar sua mensagem aos noivos | Consentimento (art. 7º, I) |
| Resposta de presença e número de acompanhantes | Ajudar o casal a se organizar | Consentimento (art. 7º, I) |
| Inscrição de avisos no aparelho (opcional) | Avisar que o álbum foi aberto e enviar novidades do casal | Consentimento (art. 7º, I), que você pode retirar a qualquer momento |
| Identificador guardado no seu aparelho | Reconhecer você quando volta, sem cadastro, e preservar seu saldo de fotos | Execução do serviço (art. 7º, V) |

### 3.3 Dados técnicos e de segurança

| Dado | Para quê | Base legal |
|---|---|---|
| Endereço IP (de forma protegida) e data/hora de acesso | Evitar abuso e spam, limitar tentativas, investigar incidentes | Legítimo interesse (art. 7º, IX) e obrigação legal de guarda de registros (art. 7º, II) |
| Tipo de navegador e aparelho | Fazer a câmera e as telas funcionarem | Legítimo interesse (art. 7º, IX) |

⚖️ **PP-4 — Guarda de registros de acesso.** O Marco Civil da Internet (art. 15) pede guarda de registros de acesso a aplicações por 6 meses. Confirmar se se aplica à plataforma, qual o prazo final e se o IP é guardado em claro ou com hash (🔧 definir com a engenharia; a decisão 003 prevê `ip_hash` na auditoria).

### 3.4 Dados de terceiros que o organizador insere

Quando o casal cola a lista de convidados, está nos entregando nomes de outras pessoas. Tratamos essa lista **só para o casamento** e apenas conforme as instruções do casal. O casal é quem deve ter combinado com os convidados que eles estarão na lista.

⚖️ **PP-5 — Dados de terceiros.** Avaliar se basta a cláusula dos Termos (organizador declara ter legitimidade) ou se é preciso aviso de privacidade adicional entregue ao convidado já na entrada (já previsto em `consentimento-convidado.md`).

### 3.5 O que **não** fazemos

- Não vendemos nem alugamos seus dados.
- Não usamos suas fotos para anúncios, treinamento de inteligência artificial ou qualquer finalidade além do álbum do casamento.
- Não fazemos reconhecimento facial nem identificamos pessoas pelo rosto.
- Não pedimos dados de pagamento (o serviço, nesta fase, não é cobrado). ⚖️ Revisar se isso mudar.

---

## 4. Fotos: quem vê, quando e por quanto tempo

1. **Antes da revelação:** a foto fica guardada e **bloqueada**. Nenhum convidado consegue abri-la. A organização do casamento pode vê-las apenas para moderar (apagar conteúdo impróprio).
2. **Na hora da revelação:** o álbum abre e **todos os convidados do casamento** passam a ver as fotos, com o nome de quem as tirou (se a organização mantiver essa opção ligada).
3. **Depois:** o casal pode baixar o álbum completo. Os arquivos ficam disponíveis por **12 meses a contar da revelação** e então são apagados (seção 8).

O álbum de um casamento **nunca é misturado** com o de outro. Cada evento é um espaço separado.

🔧 **Metadados:** removemos das fotos enviadas as informações escondidas no arquivo, como a localização (GPS) onde foram tiradas. *(Confirmar com a engenharia antes de manter esta frase.)*

---

## 5. Acesso da plataforma ao conteúdo (suporte e moderação)

Para o serviço funcionar com segurança, **a equipe do Memo Brasil pode acessar o conteúdo do álbum** (fotos, recados, lista e dados do evento), inclusive antes da revelação. Isso só acontece para:

- **dar suporte**, quando você nos pede ajuda;
- **moderar**, quando há denúncia ou suspeita de conteúdo ilegal ou que viole os Termos de Uso;
- **segurança e manutenção** do serviço;
- **cumprir ordem legal** de autoridade competente.

Como protegemos esse acesso:

- Só pessoas autorizadas, com autenticação reforçada (senha e segundo fator).
- **Todo acesso fica registrado** em um histórico que ninguém consegue editar: quem, quando, qual evento e por quê.
- Não usamos esse acesso para ver as fotos "por curiosidade", nem para qualquer finalidade comercial.

⚖️ **PP-6 — Acesso administrativo.** Confirmar que a redação (finalidades, registro, ausência de uso secundário) é suficiente como informação ao titular e compatível com o princípio da necessidade. Avaliar se convém prever notificação ao organizador quando houver acesso por suporte.

---

## 6. Crianças e adolescentes

Casamentos têm crianças: daminhas, pajens, filhos, sobrinhos. Por isso:

- **Fotos de menores de 18 anos** aparecem nos álbuns, tiradas pelos convidados. Tratamos essas fotos **com o mesmo rigor das demais, e sem nenhum uso além do álbum**.
- **O casal**, ao criar o evento, é responsável por saber que haverá menores e por avisar os responsáveis.
- **Pais e responsáveis** podem pedir a retirada de qualquer foto de uma criança ou adolescente: falando com o casal (que pode apagá-la no painel) ou escrevendo para **[encarregado@dominio.com.br]**. Atendemos com prioridade.
- **Menores de 18 anos não devem entrar no álbum sozinhos.** Se você tem menos de 18, use o Memo Brasil com o conhecimento de um responsável.

⚖️ **PP-7 — Menores.** A LGPD (art. 14) exige tratar dados de crianças e adolescentes no seu melhor interesse e, para crianças (até 12 anos), consentimento específico de um dos pais. Definir: (a) se o consentimento do convidado adulto cobre fotos de terceiros menores tiradas por ele (provavelmente não, sozinho); (b) se é preciso mecanismo de denúncia/remoção por responsável; (c) a regra de idade mínima para o convidado fotografar.

---

## 7. Com quem compartilhamos

Não compartilhamos seus dados para fins de marketing. Compartilhamos apenas o necessário com quem nos ajuda a manter o serviço:

| Quem | Para quê | Onde |
|---|---|---|
| Provedor de hospedagem | Guardar o sistema e os arquivos | **[PAÍS / REGIÃO]** |
| Provedor de e-mail | Enviar o link de acesso e os avisos por e-mail | **[PROVEDOR · PAÍS]** |
| Provedor de monitoramento de erros | Detectar falhas (sem dados pessoais nos registros) | **[PROVEDOR · PAÍS]** |
| Provedor de verificação anti-robô | Impedir cadastros automatizados | **[PROVEDOR · PAÍS]** |
| Autoridades | Quando a lei exigir | Brasil |

⚖️ **PP-8 — Transferência internacional.** Se algum provedor tratar dados fora do Brasil, a LGPD (arts. 33 a 36) exige base e garantias. Preencher a tabela com os provedores reais e verificar cláusulas contratuais.

---

## 8. Por quanto tempo guardamos

| O quê | Por quanto tempo |
|---|---|
| Fotos, recados, lista de convidados e dados do evento | **12 meses depois da revelação**; depois, apagamos tudo |
| Conta e contato do organizador | Enquanto houver evento ativo e até **[X] dias** depois do último evento apagado |
| Registros de segurança e de acesso da plataforma | **[6 meses a 12 meses — definir]** |
| Cópias de segurança (backup) | Eliminadas em até **[30] dias** depois do apagamento |

Antes de apagar, **avisamos o organizador por e-mail**, com tempo para baixar o álbum.
O casal também pode **apagar tudo antes**, quando quiser (seção 9).

🔧 A exclusão automática depende do job de retenção (item 9 do checklist). Até existir, o prazo é apenas registrado. Não publicar esta página antes de o job rodar.
⚖️ **PP-9 — Prazos.** Validar o prazo de 12 meses, o prazo dos registros de segurança e se há outra obrigação legal que obrigue a guardar mais tempo.

---

## 9. Seus direitos

Como titular, você pode pedir, a qualquer momento e gratuitamente:

- **confirmar** que tratamos seus dados e **acessar** uma cópia;
- **corrigir** dados incompletos ou errados;
- **apagar** dados tratados com base no seu consentimento, ou desnecessários;
- **anonimizar ou bloquear** dados excessivos;
- **levar** seus dados a outro serviço (portabilidade);
- **saber com quem compartilhamos** seus dados;
- **retirar o consentimento** (ex.: desativar os avisos, pedir a retirada de uma foto sua);
- **se opor** a um tratamento feito com base em legítimo interesse;
- **reclamar** à Autoridade Nacional de Proteção de Dados (ANPD).

**Como pedir:** escreva para **[encarregado@dominio.com.br]** dizendo o nome do casamento e o que você precisa. Respondemos em até **[15] dias**.

**Para a organização do casamento:**

- **Exportar:** o painel oferece o download do álbum completo (ZIP) e da lista de convidados (CSV). 🔧 *Exportação de todos os dados do evento em um único comando: a construir.*
- **Apagar:** você pode apagar fotos, recados e convidados individualmente e **excluir o evento inteiro**, em cascata. A exclusão é definitiva. 🔧 *Exclusão completa em um comando: a construir.*

**Para convidados:** peça ao casal que apague a foto ou o recado no painel, ou escreva para o encarregado. 🔧 *Denúncia direta pelo álbum: a construir.*

⚖️ **PP-10 — Pedidos de convidado.** Definir fluxo quando o convidado pede a remoção de uma foto em que aparece mas que foi tirada por outro: base de ponderação (direito de imagem, interesse do autor, interesse do casal) e prazo.

---

## 10. Como protegemos os dados

- Conexão protegida (HTTPS) em todo o serviço.
- Cada casamento é um espaço isolado; um evento não enxerga o outro.
- Bloqueio das fotos imposto pelo servidor, não apenas pela tela.
- Nomes de arquivo gerados pelo sistema, validação do tipo de arquivo e limite de tamanho.
- Acesso da equipe com segundo fator e histórico que não pode ser editado.
- Registros técnicos sem dados pessoais.

Nenhum sistema é 100% imune. Se houver incidente que possa causar risco ou dano relevante, **comunicaremos os titulares afetados e a ANPD**, conforme a lei.

⚖️ **PP-11 — Incidentes.** Ajustar prazo e responsável pela comunicação conforme regulamento da ANPD vigente.

---

## 11. Cookies e armazenamento no aparelho

Não usamos cookies de publicidade nem de rastreamento entre sites. Guardamos no seu aparelho apenas o necessário: seu nome e identificador no evento, o acesso do organizador e a preferência de avisos.

⚖️ **PP-12 — Cookies.** Confirmar a classificação (estritamente necessários × outros) e se é preciso aviso/banner. Se a ferramenta de análise ou o monitoramento de erros incluir cookies de terceiros, atualizar.

---

## 12. Mudanças nesta política

Se mudarmos algo importante, avisamos o organizador por e-mail e, na página do evento, antes de a mudança valer. A data da última atualização aparece abaixo.

**Última atualização:** [DD/MM/AAAA] · **Versão:** [1.0]

## 13. Fale com a gente

**Encarregado(a):** [NOME] — [encarregado@dominio.com.br]
**Suporte:** [suporte@dominio.com.br]
**Endereço:** [ENDEREÇO]
