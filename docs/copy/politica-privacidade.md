# Política de Privacidade — Lume

> **Rascunho v0.2 · 16/10/2026 · Redator.** Texto de produto, não parecer jurídico.
> Trechos marcados com ⚖️ **PP-n** exigem revisão de advogado(a) antes da publicação.
> Trechos marcados com 🔧 `feature.<chave>` descrevem algo que **ainda não existe no produto**; a chave aponta para `features.json`. Texto com chave desligada não pode ser publicado (`node scripts/check-copy-features.js --publicar`).
> Itens entre `[colchetes]` e `{chaves}` são dados ou variáveis a preencher.

---

## Em poucas palavras

Cuidamos das fotos e dos nomes que passam por aqui como se fossem de família. Resumo do que você vai ler:

- **Só pedimos o que o álbum precisa:** nome, fotos, recados e, para quem organiza, um contato.
- **Suas fotos ficam guardadas e escondidas** até a hora da revelação que o casal escolheu. Depois, **todos os convidados do casamento** podem vê-las.
- **Não vendemos seus dados**, não fazemos publicidade com suas fotos e não usamos reconhecimento facial.
- **Guardamos o álbum por {retencao_meses} meses depois da revelação e depois apagamos.** 🔧 `feature.retencao`
- **Você manda nos seus dados:** pode pedir cópia, correção ou exclusão quando quiser.

---

## 1. Quem somos e quem decide o quê

O **Lume** é uma plataforma de álbum colaborativo de casamento, operada por **[RAZÃO SOCIAL], CNPJ [00.000.000/0000-00]**, com sede em **[ENDEREÇO]** ("nós").

Quem decide sobre os seus dados depende de qual dado é:

| Dado | Quem decide | Papel |
|---|---|---|
| Nome, fotos, recados, resposta de presença e avisos de **quem entra como convidado** | O Lume, com o casal | **Nós somos controladores** (colhemos o seu aceite diretamente, guardamos, moderamos e damos suporte). **O casal é co-controlador do álbum**: escolhe quem entra, quando revelar, se o nome de quem tirou aparece e o que fica ou sai. |
| Conta e contato de **quem organiza** | O Lume | Controlador |
| **Lista de convidados** que o casal cola no painel | O casal | O casal é controlador; nós somos operadores e só tratamos conforme as instruções dele |
| Registros de segurança | O Lume | Controlador |

**Quem responde a você:** fale com o encarregado do Lume ou com os noivos. Um encaminha ao outro, e nós respondemos pelos dados que tratamos como controladores.

⚖️ **PP-1 — Papéis.** Esta versão trata o Lume como **controlador** dos dados do convidado e do organizador e o casal como **co-controlador do álbum**, porque é a plataforma quem colhe o aceite, modera e acessa o conteúdo por finalidade própria. Validar a divisão de responsabilidades (arts. 42 e seguintes) e se é preciso cláusula entre plataforma e casal nos Termos.

**Encarregado(a) pelo tratamento de dados pessoais (DPO):**
**[NOME DO ENCARREGADO]** — **[encarregado@dominio.com.br]**
⚖️ **PP-2 — Encarregado.** Nome e canal reais são obrigatórios (LGPD, art. 41). Definir antes da publicação; aqui só há marcador.

---

## 2. Quem usa o Lume

| Quem | Como entra | O que acontece |
|---|---|---|
| **Organização** (casal e cerimonial) | Cria o evento e acessa o painel | Gerencia lista, programação, fotos e avisos |
| **Convidado** | Escaneia o QR Code e digita o nome | Fotografa, vê o álbum depois da revelação, confirma presença e deixa recados |
| **Equipe da plataforma** | Acesso interno | Dá suporte, modera e mantém o serviço no ar |

Convidados **não criam conta nem senha**.

---

## 3. Quais dados tratamos, para quê e com base em quê

⚖️ **PP-3 — Bases legais.** A tabela abaixo sugere uma base por finalidade (LGPD, art. 7). Validar cada uma, em especial o **consentimento** do convidado, o **legítimo interesse** para quem aparece nas fotos e para moderação e segurança (exige teste de balanceamento documentado, **PP-13**).

### 3.1 Dados de quem organiza o casamento

| Dado | Para quê | Base legal |
|---|---|---|
| Nome do evento, data, local, endereço, programação, mensagem aos convidados | Montar o convite e a página do evento | Execução do serviço pedido (art. 7º, V) |
| Contato (hoje, e-mail ou WhatsApp) | Falar com você sobre suporte; 🔧 `feature.login_email` entrar na conta por link e avisar que o álbum foi revelado | Execução do serviço (art. 7º, V) |
| Lista de convidados (nome, grupo, acompanhantes, resposta de presença) | Controlar quem foi convidado e quem confirmou | Execução do serviço (art. 7º, V) — ver 3.4 |
| Registro de ações no painel (quem apagou foto, quem baixou o álbum) | Segurança e prestação de contas | Legítimo interesse (art. 7º, IX) |

### 3.2 Dados dos convidados e de quem aparece nas fotos

| Dado | Para quê | Base legal |
|---|---|---|
| Nome digitado ao entrar | Identificar suas fotos e recados e controlar quantas fotos você ainda pode tirar | Consentimento (art. 7º, I) |
| **Fotos que você tira** (você como autor) | Compor o álbum do casamento, que será visto por todos os convidados depois da revelação | Consentimento (art. 7º, I) |
| Recados | Entregar sua mensagem aos noivos (e ao mural, só se você escolher) | Consentimento (art. 7º, I) |
| Resposta de presença e número de acompanhantes | Ajudar o casal a se organizar | Consentimento (art. 7º, I) |
| Inscrição de avisos no aparelho (opcional) | Avisar que o álbum foi aberto e enviar novidades do casal | Consentimento (art. 7º, I), que você pode retirar a qualquer momento |
| Seu aceite: o que você marcou, a versão do texto e a data 🔧 `feature.aceite_registrado` | Provar o que você aceitou | Exercício regular de direitos (art. 7º, VI) |
| Identificador guardado no seu aparelho | Reconhecer você quando volta, sem cadastro, e preservar seu saldo de fotos | Execução do serviço (art. 7º, V) |
| **Pessoas que aparecem nas fotos** (imagem e rosto de quem foi fotografado, tenha ou não entrado no Lume) | Guardar a foto e mostrá-la no álbum daquele casamento, só aos convidados e à organização | **Legítimo interesse** (art. 7º, IX), com avaliação documentada ⚖️ **PP-13**. Você pode **se opor** e pedir a retirada de forma simples (seção 9) |

**Por que a linha "pessoas que aparecem nas fotos" existe.** Quando alguém tira uma foto, o consentimento é dessa pessoa, para os dados dela. Ele **não vale pelas pessoas fotografadas**. Por isso, para quem aparece nas fotos, usamos outra base (legítimo interesse: um álbum de festa só faz sentido se mostrar quem estava lá), com três cuidados: mostramos só a quem estava no casamento, não usamos a foto para mais nada e **qualquer pessoa pode pedir a retirada**. Para crianças e adolescentes, valem as regras da seção 6.

⚖️ **PP-13 — Teste de balanceamento.** Documentar o teste do legítimo interesse para quem aparece em fotos de terceiros (finalidade, necessidade, expectativa razoável de quem está numa festa, impacto e salvaguardas) e validar a base. Se o teste não fechar, o caminho alternativo é consentimento específico de quem aparece, o que muda o produto.

### 3.3 Dados técnicos e de segurança

| Dado | Para quê | Base legal |
|---|---|---|
| Endereço IP e data/hora de acesso 🔧 `feature.logs_sem_pii` (guardado de forma protegida) | Evitar abuso e spam, limitar tentativas, investigar incidentes | Legítimo interesse (art. 7º, IX) e obrigação legal de guarda de registros (art. 7º, II) |
| Tipo de navegador e aparelho | Fazer a câmera e as telas funcionarem | Legítimo interesse (art. 7º, IX) |

⚖️ **PP-4 — Guarda de registros de acesso.** O Marco Civil da Internet (art. 15) pede guarda de registros de acesso a aplicações por 6 meses. Confirmar se se aplica à plataforma, qual o prazo final e se o IP é guardado em claro ou com hash (a decisão 003 prevê `ip_hash` na auditoria). Hoje não existe política de logs publicada; por isso a frase "de forma protegida" está marcada 🔧 como `feature.logs_sem_pii`.

### 3.4 Dados de terceiros que o organizador insere

Quando o casal cola a lista de convidados, está nos entregando nomes de outras pessoas. **O casal é o controlador dessa lista**; nós a tratamos **só para o casamento** e conforme as instruções dele. O casal deve ter combinado com os convidados que eles estarão na lista.

⚖️ **PP-5 — Dados de terceiros.** Avaliar se basta a cláusula dos Termos (organizador declara ter legitimidade) ou se é preciso aviso de privacidade adicional entregue ao convidado já na entrada (previsto em `consentimento-convidado.md`).

### 3.5 O que **não** fazemos

- Não vendemos nem alugamos seus dados.
- Não usamos suas fotos para anúncios, treinamento de inteligência artificial ou qualquer finalidade além do álbum do casamento.
- Não fazemos reconhecimento facial nem identificamos pessoas pelo rosto.
- Não pedimos dados de pagamento (o serviço, nesta fase, não é cobrado). ⚖️ Revisar se isso mudar.

---

## 4. Fotos: quem vê, quando e por quanto tempo

1. **Antes da revelação:** a foto fica guardada e **bloqueada**. Nenhum convidado consegue abri-la. A organização do casamento pode vê-las apenas para moderar (apagar conteúdo impróprio).
2. **Na hora da revelação:** o álbum abre e **todos os convidados do casamento** passam a ver as fotos. O nome de quem tirou aparece **se a organização manteve essa opção ligada desde o início**; quem entrou sem essa informação nunca passa a ser identificado depois (seção 4.1).
3. **Depois:** o casal pode baixar o álbum completo. Os arquivos ficam disponíveis pelo prazo da seção 8 e então são apagados.

O álbum de um casamento **nunca é misturado** com o de outro. Cada evento é um espaço separado.

**Localização escondida na foto.** Fotos feitas pelo celular podem trazer, dentro do arquivo, o lugar onde foram tiradas. Se não quiser isso, desligue a localização da câmera do aparelho. 🔧 `feature.exif` *Quando a remoção automática estiver no ar, passamos a tirar esses dados das fotos enviadas e esta frase muda.*

### 4.1 Nome de quem tirou a foto

A organização escolhe se o nome de quem tirou cada foto aparece. Cada convidado aceita **uma versão do aviso** (com nome ou sem identificar). Por isso: o casal pode **ocultar** os nomes a qualquer momento, mas **não pode passar a exibi-los** para quem entrou sem essa informação. 🔧 `feature.nome_travado`

---

## 5. Acesso da plataforma ao conteúdo (suporte e moderação)

Para o serviço funcionar com segurança, **a equipe do Lume pode acessar o conteúdo do álbum** (fotos, recados, lista e dados do evento), inclusive antes da revelação. Isso só acontece para:

- **dar suporte**, quando você nos pede ajuda;
- **moderar**, quando há denúncia ou suspeita de conteúdo ilegal ou que viole os Termos de Uso;
- **segurança e manutenção** do serviço;
- **cumprir ordem legal** de autoridade competente.

Como protegemos esse acesso:

- Só pessoas autorizadas, com credencial própria. 🔧 `feature.mfa_master` *Segundo fator de autenticação.*
- As ações da administração sobre o evento (como suspender, apagar ou mudar limites) ficam registradas em um histórico que ninguém consegue editar: quem, quando e qual evento.
- 🔧 `feature.auditoria_motivo` *Também ficam registrados a abertura de fotos e recados e o motivo informado.*
- 🔧 `feature.painel_acessos_admin` *O organizador vê no painel a lista "Acessos da administração" (data e motivo).*
- Não usamos esse acesso para ver as fotos "por curiosidade", nem para qualquer finalidade comercial.

⚖️ **PP-6 — Acesso administrativo.** Confirmar que a redação (finalidades, registro, ausência de uso secundário) é suficiente como informação ao titular e compatível com o princípio da necessidade. A lista de acessos no painel do organizador é recomendada como transparência.

---

## 6. Crianças e adolescentes

Casamentos têm crianças: daminhas, pajens, filhos, sobrinhos. Por isso:

- **Fotos de menores de 18 anos** aparecem nos álbuns, tiradas pelos convidados. Tratamos esses dados **no melhor interesse da criança e do adolescente** (LGPD, art. 14): só aparecem no álbum daquele casamento, para quem estava na festa, e **sem nenhum uso além disso**.
- **O consentimento de quem tira a foto não substitui o dos responsáveis.** Por isso, os pais ou responsáveis podem **pedir a retirada** de qualquer foto de uma criança ou adolescente, e nós **retiramos**: falando com o casal (que apaga a foto no painel) ou escrevendo para **[encarregado@dominio.com.br]**.
- **O casal**, ao criar o evento, é responsável por saber que haverá menores e por avisar os responsáveis.
- **Menores de 18 anos não devem entrar no álbum sozinhos.** Ao entrar, o convidado declara que **tem 18 anos ou está com um responsável ciente**. Não pedimos data de nascimento nem documento. 🔧 `feature.aceite_registrado`

⚖️ **PP-7 — Menores.** Validar: (a) o tratamento de fotos de menores tiradas por terceiros no melhor interesse (art. 14, §1º), e se a retirada a pedido do responsável é salvaguarda suficiente em vez de consentimento específico dos pais; (b) a declaração "18 anos ou com responsável ciente", sem verificação de idade, como esforço razoável (art. 14, §5º).

---

## 7. Com quem compartilhamos

Não compartilhamos seus dados para fins de marketing. Compartilhamos apenas o necessário com quem nos ajuda a manter o serviço:

| Quem | Para quê | Onde |
|---|---|---|
| Provedor de hospedagem | Guardar o sistema e os arquivos | **[PAÍS / REGIÃO]** |
| Provedor de e-mail 🔧 `feature.email` | Enviar o link de acesso e os avisos por e-mail | **[PROVEDOR · PAÍS]** |
| Provedor de monitoramento de erros | Detectar falhas | **[PROVEDOR · PAÍS]** |
| Provedor de verificação anti-robô | Impedir cadastros automatizados | **[PROVEDOR · PAÍS]** |
| Autoridades | Quando a lei exigir | Brasil |

⚖️ **PP-8 — Transferência internacional.** Se algum provedor tratar dados fora do Brasil, a LGPD (arts. 33 a 36) exige base e garantias. Preencher a tabela com os provedores reais e verificar cláusulas contratuais.

---

## 8. Por quanto tempo guardamos

| O quê | Por quanto tempo |
|---|---|
| Fotos, recados, lista de convidados e dados do evento **revelado** | **{retencao_meses} meses depois da revelação**; depois, apagamos tudo 🔧 `feature.retencao` |
| Evento **nunca revelado** ou abandonado | Teto de **{teto_meses} meses** contados da data do casamento (ou da criação do evento, se não houver data); depois, apagamos tudo 🔧 `feature.retencao` |
| Conta e contato do organizador | Enquanto houver evento ativo e até **[X] dias** depois do último evento apagado |
| Registros de segurança e de acesso da plataforma | **[prazo a definir; mínimo legal a confirmar]** |
| Cópias de segurança (backup) | Eliminadas em até **[30] dias** depois do apagamento 🔧 `feature.backup_rotina` |

**A cópia que o casal baixa fica com o casal.** O ZIP do álbum e o CSV da lista, depois de baixados, estão fora do nosso controle e **não são apagados por nós** no fim do prazo. Quem baixa passa a cuidar desses arquivos.

Antes de apagar, **avisamos o organizador por e-mail**, com tempo para baixar o álbum. 🔧 `feature.email` O casal também pode **apagar tudo antes**, quando quiser (seção 9).

Não prometemos prorrogar o prazo. Guardar além do que foi combinado com os convidados exigiria uma nova base legal.

🔧 `feature.retencao` A exclusão automática depende do job de retenção. Hoje o prazo é apenas registrado. **Não publicar esta página antes de o job rodar.**
⚖️ **PP-9 — Prazos.** Validar o prazo, o teto para evento nunca revelado, o prazo dos registros de segurança e se há outra obrigação legal que obrigue a guardar mais tempo.

---

## 9. Seus direitos

Como titular, você pode pedir, a qualquer momento e gratuitamente:

- **confirmar** que tratamos seus dados e **acessar** uma cópia;
- **corrigir** dados incompletos ou errados;
- **apagar** dados tratados com base no seu consentimento, ou desnecessários;
- **anonimizar ou bloquear** dados excessivos;
- **levar** seus dados a outro serviço (portabilidade);
- **saber com quem compartilhamos** seus dados;
- **retirar o consentimento** (ex.: desativar os avisos, apagar suas fotos e recados);
- **se opor** a um tratamento feito com base em legítimo interesse, **inclusive pedir a retirada de uma foto em que você aparece**;
- **reclamar** à Autoridade Nacional de Proteção de Dados (ANPD).

**Como pedir:** escreva para **[encarregado@dominio.com.br]** dizendo o nome do casamento e o que você precisa. Respondemos em até **[15] dias**. 🔧 `feature.fluxo_titular` *Protocolo e prazo acompanhados pelo sistema.*

**Para quem organiza o casamento:**

- **Exportar:** o painel oferece o download do álbum completo (ZIP) e da lista de convidados (CSV). 🔧 `feature.exportar_tudo` *Baixar tudo do evento de uma vez.*
- **Apagar:** você pode apagar fotos, recados e convidados individualmente. **Excluir o evento inteiro**, hoje, é pedido ao nosso suporte. 🔧 `feature.excluir_evento` *Exclusão do evento inteiro direto no painel.* A exclusão é definitiva.

**Para convidados:**

- **Suas fotos e seus recados:** você pode pedir ao casal que apague ou escrever para o encarregado. 🔧 `feature.apagar_proprio` *Apagar você mesmo as suas fotos e os seus recados, até o fim do prazo de guarda.*
- **Fotos de outras pessoas em que você aparece:** peça aos noivos que ocultem ou apaguem, ou escreva para o encarregado. 🔧 `feature.denuncia` *Denunciar direto pelo álbum.*

⚖️ **PP-10 — Pedidos de quem aparece na foto.** Definir o fluxo de oposição e retirada para foto tirada por outro convidado: critérios de ponderação (direito de imagem, interesse do autor e do casal), prazo e o que acontece com a foto enquanto o pedido é analisado.

---

## 10. Como protegemos os dados

- Cada casamento é um espaço isolado; um evento não enxerga o outro.
- Bloqueio das fotos imposto pelo servidor, não apenas pela tela.
- Nomes de arquivo gerados pelo sistema e limite de tamanho das fotos.
- Ações da administração em histórico que não pode ser editado.
- 🔧 `feature.https` Conexão protegida (HTTPS) em todo o serviço.
- 🔧 `feature.validacao_arquivo` Conferência do conteúdo real do arquivo enviado.
- 🔧 `feature.mfa_master` Acesso da equipe com segundo fator.
- 🔧 `feature.logs_sem_pii` Registros técnicos sem dados pessoais.

Nenhum sistema é 100% imune. Se houver incidente que possa causar risco ou dano relevante, **comunicaremos os titulares afetados e a ANPD**, conforme a lei.

⚖️ **PP-11 — Incidentes.** Ajustar prazo e responsável pela comunicação conforme regulamento da ANPD vigente.

---

## 11. Cookies e armazenamento no aparelho

Não usamos cookies de publicidade nem de rastreamento entre sites. Guardamos no seu aparelho apenas o necessário: seu nome e identificador no evento, o acesso do organizador e a preferência de avisos.

⚖️ **PP-12 — Cookies.** Confirmar a classificação (estritamente necessários × outros) e se é preciso aviso/banner. A verificação anti-robô (decisão 003) e o monitoramento de erros podem gravar cookies ou dados de terceiros: **atualizar esta seção e a tabela da seção 7 quando o provedor for escolhido.**

---

## 12. Mudanças nesta política

Se mudarmos algo importante, avisamos o organizador e, na página do evento, antes de a mudança valer. Quem já aceitou uma versão **não passa a ter o aceite ampliado** por uma mudança: se a mudança exigir consentimento, pediremos de novo. A data da última atualização aparece abaixo.

**Última atualização:** [DD/MM/AAAA] · **Versão:** [1.0]

## 13. Fale com a gente

**Encarregado(a):** [NOME] — [encarregado@dominio.com.br]
**Suporte:** [suporte@dominio.com.br]
**Endereço:** [ENDEREÇO]
