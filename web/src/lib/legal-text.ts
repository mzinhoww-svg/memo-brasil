/** Textos das páginas /termos e /privacidade, versão 2026-10-22-v1. Origem: texto fornecido pelo operador; sem revisão jurídica profissional registrada. */
export type LegalSection = { title: string; blocks: (string | string[])[] };

export const LEGAL_UPDATED_AT = "22 de outubro de 2026";

export const TERMS_TEXT: LegalSection[] = [
  { title: "1. Sobre o serviço", blocks: [
    "O MemoriesMT permite criar eventos, convidar participantes, compartilhar fotografias e disponibilizar uma galeria conforme as configurações de acesso e revelação escolhidas pelo organizador.",
    "O responsável pela operação é Aurimar Espindola Nogueira. Dúvidas, suporte e solicitações podem ser encaminhados para mazinhoww@gmail.com.",
  ] },
  { title: "2. Organizador e participantes", blocks: [
    "O organizador administra seu evento, seus convites e as configurações disponíveis. Participantes acessam o evento por convite e devem respeitar as pessoas fotografadas e as regras comunicadas pelo organizador.",
    "A criação de conta de organizador exige maioridade civil. A participação de menores deve ocorrer sob responsabilidade de seu representante legal. Não devem ser enviados conteúdos de crianças ou adolescentes sem as autorizações cabíveis e a observância de seu melhor interesse.",
    "Não compartilhe sua conta. Links e códigos de convite devem ser enviados somente às pessoas que você deseja admitir no evento.",
  ] },
  { title: "3. Fotografias e direitos de imagem", blocks: [
    "Quem envia uma fotografia declara possuir os direitos ou autorizações necessários para compartilhá-la naquele contexto.",
    "O envio não transfere a propriedade da fotografia ao MemoriesMT. Você autoriza apenas o tratamento necessário para armazenar, processar tecnicamente e exibir o conteúdo às pessoas autorizadas no evento.",
    "O aceite destes Termos não representa autorização irrestrita de uso da imagem de terceiros. O organizador e quem envia o conteúdo devem respeitar os direitos das pessoas retratadas.",
    "O MemoriesMT não utilizará fotografias do evento em publicidade, divulgação comercial ou treinamento de modelos de inteligência artificial sem autorização específica e separada.",
  ] },
  { title: "4. Acesso e revelação", blocks: [
    "As configurações do evento determinam quando a galeria será disponibilizada e quais funcionalidades estarão acessíveis aos participantes. O organizador e operadores autorizados podem ter acessos necessários à gestão, suporte e segurança.",
    "A revelação programada controla a disponibilização pelo serviço, mas não impede que uma pessoa que já recebeu acesso faça capturas, downloads ou compartilhe uma cópia fora da plataforma.",
  ] },
  { title: "5. Condutas proibidas", blocks: [
    "É proibido publicar conteúdo ilegal, violento, discriminatório, abusivo, sexual envolvendo menores, que viole direitos de imagem ou propriedade intelectual, ou que exponha indevidamente informações pessoais.",
    "Também é proibido tentar acessar eventos alheios, contornar limites, explorar vulnerabilidades ou prejudicar o serviço.",
    "Conteúdo e acessos poderão ser restringidos quando necessário para proteção dos usuários, apuração de abuso ou cumprimento de obrigação legal. Medidas poderão ser contestadas pelo canal de contato.",
  ] },
  { title: "6. Limites e funcionalidades", blocks: [
    "A interface informa os limites aplicáveis ao evento, incluindo participantes, fotografias e período de disponibilidade.",
    "Funcionalidades comerciais somente estarão disponíveis quando efetivamente implementadas e apresentadas ao usuário. Nenhuma cobrança é autorizada apenas pelo aceite destes Termos.",
    "Quando houver contratação paga, preço, condições, duração, atendimento, cancelamento e direitos aplicáveis deverão ser informados antes da confirmação da compra.",
  ] },
  { title: "7. Disponibilidade e guarda das fotos", blocks: [
    "As fotografias ficam disponíveis por 90 dias após o encerramento do evento. O organizador deve realizar os downloads desejados antes do término desse período.",
    "Após o prazo, o acesso será encerrado e a exclusão do armazenamento ativo ocorrerá em até 30 dias. Cópias de segurança restritas serão eliminadas conforme o ciclo descrito na Política de Privacidade.",
    "Solicitações válidas de exclusão antecipada poderão reduzir esse período. Condições diferentes expressamente contratadas serão informadas antes da contratação.",
  ] },
  { title: "8. Suporte e solicitações de remoção", blocks: [
    "Participantes e pessoas retratadas podem solicitar análise ou remoção de conteúdo pelo canal mazinhoww@gmail.com, informando o evento e o conteúdo relacionado.",
    "Poderemos solicitar apenas os elementos necessários para verificar legitimidade e localizar o conteúdo. Não envie senhas ou documentos completos sem solicitação e justificativa.",
  ] },
  { title: "9. Responsabilidades", blocks: [
    "O organizador responde pelas configurações e convites que administra; cada usuário responde pelo conteúdo que envia e por seu uso do serviço.",
    "O MemoriesMT responde por suas próprias obrigações e falhas na forma da legislação aplicável. Estes Termos não excluem direitos do consumidor nem afastam responsabilidades que não possam ser limitadas por contrato.",
  ] },
  { title: "10. Atualizações e legislação", blocks: [
    "Alterações relevantes serão comunicadas pela plataforma. Quando necessário, será solicitado novo aceite. Mudanças não retirarão retroativamente direitos ou condições já contratadas.",
    "Aplica-se a legislação brasileira, preservados os direitos do consumidor e as regras legais sobre competência territorial.",
  ] },
];

export const PRIVACY_TEXT: LegalSection[] = [
  { title: "1. Responsável e contato", blocks: [
    "Aurimar Espindola Nogueira é o responsável indicado pela operação do MemoriesMT e pelo tratamento de dados relacionado à administração da plataforma.",
    "Contato para privacidade e exercício de direitos: mazinhoww@gmail.com.",
    "O organizador também toma decisões sobre seu evento, convidados e conteúdo. As responsabilidades relativas a esses tratamentos dependem das decisões efetivamente tomadas por cada parte.",
  ] },
  { title: "2. Dados utilizados", blocks: [
    "Conforme sua interação, podemos tratar:",
    [
      "Identificador, nome, e-mail e imagem de perfil disponibilizados pelo login Google.",
      "Nome informado pelo participante, identificador de sessão e vínculo com o evento.",
      "Dados do evento, convites, configurações e horários.",
      "Fotografias enviadas e informações técnicas necessárias ao processamento.",
      "Registros de aceite, versões dos documentos e datas.",
      "Informações técnicas de acesso, erros, segurança e atendimento.",
    ],
    "Não recebemos sua senha do Google. Não solicitamos CPF ou outros documentos apenas para participar de um evento.",
  ] },
  { title: "3. Finalidades e fundamentos", blocks: [
    "Utilizamos os dados para autenticar usuários, administrar eventos, admitir convidados, armazenar fotografias, aplicar limites, controlar a revelação, disponibilizar a galeria e atender solicitações.",
    "O tratamento pode se fundamentar na execução do serviço solicitado, cumprimento de obrigações legais, exercício regular de direitos e interesses legítimos de segurança e funcionamento, quando cabíveis.",
    "Quando uma finalidade exigir consentimento, ele será solicitado de maneira específica. Aceitar os Termos ou declarar ciência desta Política não autoriza automaticamente publicidade, reconhecimento facial ou qualquer uso incompatível.",
  ] },
  { title: "4. Acesso às fotografias", blocks: [
    "Fotografias são disponibilizadas conforme as permissões e o momento de revelação do evento. Organizadores e pessoas autorizadas podem acessar o conteúdo nos limites das funcionalidades oferecidas.",
    "O convite pode ser encaminhado por terceiros; mantenha seus códigos e links sob controle. Depois de uma fotografia ser acessada ou baixada legitimamente, não conseguimos controlar todas as cópias mantidas fora do MemoriesMT.",
    "Acesso operacional ao conteúdo deve ocorrer somente quando necessário para suporte, segurança, atendimento de solicitações ou obrigação legal.",
  ] },
  { title: "5. Fornecedores e compartilhamento", blocks: [
    "Utilizamos fornecedores de autenticação, hospedagem e armazenamento, incluindo Google, Vercel e Supabase, conforme os recursos em operação.",
    "Dados poderão ser tratados em infraestrutura localizada fora do Brasil. Quando aplicável, serão adotados os mecanismos e requisitos legais de transferência internacional.",
    "Também poderemos compartilhar informações estritamente necessárias para atender obrigações legais ou proteger direitos.",
    "Não vendemos dados pessoais nem utilizamos fotografias dos eventos para publicidade ou treinamento de inteligência artificial sem autorização específica.",
    "Uma futura integração de pagamentos deverá ser informada antes de sua utilização, incluindo o provedor e os dados necessários à transação.",
  ] },
  { title: "6. Armazenamento local e tecnologias necessárias", blocks: [
    "Usamos cookies e armazenamento do navegador necessários para autenticação, continuidade da sessão e funcionamento do serviço.",
    "Tecnologias opcionais de publicidade ou medição, caso adotadas, deverão ser identificadas separadamente e submetidas às escolhas exigidas pela legislação. Não há autorização genérica para publicidade pelo simples uso da plataforma.",
  ] },
  { title: "7. Retenção e exclusão", blocks: [
    "As fotografias ficam disponíveis por 90 dias após o encerramento do evento. Depois, seu acesso é encerrado e a exclusão do armazenamento ativo é concluída em até 30 dias.",
    "Solicitações válidas de exclusão antecipada serão processadas em até 30 dias, ressalvadas hipóteses legais de conservação devidamente justificadas.",
    "Cópias de segurança são restritas à recuperação e eliminadas em até 30 dias adicionais à exclusão do armazenamento ativo. Se houver restauração, as exclusões já determinadas deverão ser reaplicadas.",
    "Dados de conta são mantidos enquanto necessários à relação com o usuário. Registros de aceite, segurança e atendimento podem ser conservados pelo período necessário a obrigações legais e defesa de direitos, com acesso restrito e sem justificar a guarda indiscriminada de fotografias.",
  ] },
  { title: "8. Seus direitos", blocks: [
    "Você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento, oposição, revogação de consentimento e exclusão, conforme as condições legais aplicáveis.",
    "Envie o pedido para mazinhoww@gmail.com. Poderemos confirmar sua identidade de maneira proporcional ao pedido. Se uma solicitação não puder ser atendida integralmente, explicaremos os motivos.",
    "A exclusão de uma fotografia da plataforma não elimina automaticamente cópias anteriormente baixadas por terceiros.",
  ] },
  { title: "9. Crianças e adolescentes", blocks: [
    "O tratamento de dados de crianças e adolescentes deve observar seu melhor interesse e os requisitos legais aplicáveis.",
    "O organizador e os participantes devem evitar exposição indevida e obter as autorizações necessárias para compartilhamento de imagens. Solicitações de representantes legais serão analisadas pelo canal de privacidade.",
  ] },
  { title: "10. Segurança e alterações", blocks: [
    "Adotamos controles de autenticação, autorização e restrição de acesso. Nenhum sistema está livre de riscos; incidentes serão avaliados e tratados conforme as obrigações aplicáveis.",
    "Esta Política poderá ser atualizada. Mudanças relevantes serão comunicadas e, quando necessário, haverá nova manifestação do usuário.",
  ] },
];
