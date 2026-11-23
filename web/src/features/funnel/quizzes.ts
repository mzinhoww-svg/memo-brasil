/**
 * Funil de quiz: 5 portas, uma por nível de consciência, todas levando à mesma oferta (câmera para até 50 convidados).
 * Só dados: o motor (`Quiz.tsx`) é um só. Trocar um quiz é trocar este arquivo; o anúncio aponta para `/q/<slug>`.
 * Regras do método: perguntas sobre ela (nunca sobre o produto), as fáceis primeiro, depois o sintoma, o que já tentou e o compromisso.
 */
export type ProfileId = "espalhadas" | "posado" | "pista";

export type QuizOption = { id: string; label: string; guests?: number; profile?: ProfileId };
export type QuizQuestion = {
  id: string;
  text: string;
  /** Explicação curta abaixo da pergunta (o quiz do nível 1 educa enquanto pergunta). */
  hint?: string;
  /** Checklist: marca quantas quiser; o total marcado vira a pontuação. */
  multi?: boolean;
  options: QuizOption[];
};
export type Quiz = {
  slug: string;
  /** Nível de consciência (1 = inconsciente … 5 = mais consciente). */
  level: 1 | 2 | 3 | 4 | 5;
  /** Título da aba e da prévia do link. */
  title: string;
  /** Chamada no topo da primeira pergunta. */
  headline: string;
  lead: string;
  questions: QuizQuestion[];
  /** Perfil quando nenhuma resposta escolhe um. */
  fallbackProfile: ProfileId;
};

const GUESTS: QuizQuestion = {
  id: "convidados",
  text: "Quantos convidados vão à festa?",
  options: [
    { id: "ate50", label: "Até 50", guests: 40 },
    { id: "ate100", label: "De 51 a 100", guests: 80 },
    { id: "ate150", label: "De 101 a 150", guests: 130 },
    { id: "mais", label: "Mais de 150", guests: 200 },
  ],
};

const WHEN: QuizQuestion = {
  id: "quando",
  text: "Quando é o casamento?",
  options: [
    { id: "mes", label: "Neste mês" },
    { id: "3m", label: "Em até 3 meses" },
    { id: "6m", label: "Em até 6 meses" },
    { id: "depois", label: "Daqui a mais de 6 meses" },
  ],
};

const TRIED: QuizQuestion = {
  id: "tentou",
  text: "Como você pensa em juntar as fotos que os convidados tirarem?",
  options: [
    { id: "grupo", label: "Grupo de WhatsApp", profile: "espalhadas" },
    { id: "hashtag", label: "Hashtag no Instagram", profile: "espalhadas" },
    { id: "fotografo", label: "Só as do fotógrafo já bastam", profile: "posado" },
    { id: "nada", label: "Ainda não pensei nisso", profile: "pista" },
  ],
};

const COMMIT: QuizQuestion = {
  id: "compromisso",
  text: "Você quer ver o casamento pelos olhos dos convidados já no dia seguinte?",
  options: [
    { id: "sim", label: "Quero muito" },
    { id: "talvez", label: "Seria bom" },
  ],
};

export const QUIZZES: Quiz[] = [
  {
    slug: "diagnostico", level: 1,
    title: "Quantas fotos do seu casamento você nunca vai ver?",
    headline: "Quantas fotos do seu casamento você nunca vai ver?",
    lead: "Teste de 2 minutos. No fim você recebe o número da sua festa.",
    fallbackProfile: "espalhadas",
    questions: [
      WHEN,
      GUESTS,
      { id: "fotografo", text: "Você contratou fotógrafo?", hint: "O fotógrafo registra o que foi combinado. Ele é um só e não está em todas as mesas.", options: [
        { id: "sim", label: "Sim" }, { id: "nao", label: "Ainda não" }, { id: "sem", label: "Não vou contratar", profile: "pista" } ] },
      { id: "momento", text: "Qual momento você mais tem medo de não ver depois?", hint: "Quase tudo isso acontece longe da câmera do fotógrafo, e na frente do celular de algum convidado.", options: [
        { id: "pista", label: "A pista de dança", profile: "pista" }, { id: "avos", label: "Os avós e a família" },
        { id: "bastidor", label: "Os bastidores e a arrumação", profile: "posado" }, { id: "amigos", label: "A mesa dos amigos" } ] },
      { id: "celular", text: "Em casamento de amigos, o que você faz com as fotos que tira?", hint: "A maioria fica onde foi tirada: no celular de cada convidado.", options: [
        { id: "manda", label: "Mando algumas para os noivos" }, { id: "posta", label: "Posto nos stories" },
        { id: "esquece", label: "Ficam no meu celular", profile: "espalhadas" } ] },
      TRIED,
      COMMIT,
    ],
  },
  {
    slug: "sinais", level: 2,
    title: "6 sinais de que as fotos dos convidados vão se perder",
    headline: "6 sinais de que as fotos dos seus convidados vão se perder",
    lead: "Marque o que vale para o seu casamento e veja a sua pontuação.",
    fallbackProfile: "espalhadas",
    questions: [
      { id: "sinais", text: "Quais destes valem para você?", multi: true, options: [
        { id: "grupo", label: "Vou criar um grupo de WhatsApp para as fotos", profile: "espalhadas" },
        { id: "qualidade", label: "Já recebi foto de festa em baixa qualidade" },
        { id: "ninguem", label: "Depois da festa quase ninguém manda nada" },
        { id: "um", label: "Terei um fotógrafo só para a festa inteira", profile: "posado" },
        { id: "pista", label: "A pista vai até tarde", profile: "pista" },
        { id: "longe", label: "Tem convidado que mora longe e some depois" },
      ] },
      GUESTS,
      WHEN,
      COMMIT,
    ],
  },
  {
    slug: "descartavel-ou-qr", level: 3,
    title: "Câmera descartável ou QR Code: qual serve para o seu casamento?",
    headline: "Câmera descartável ou QR Code nas mesas?",
    lead: "Responda 5 perguntas e veja qual das duas serve para a sua festa.",
    fallbackProfile: "pista",
    questions: [
      GUESTS,
      { id: "luz", text: "A festa é mais de dia ou de noite?", options: [
        { id: "dia", label: "De dia" }, { id: "noite", label: "De noite", profile: "pista" }, { id: "ambos", label: "Começa de dia e vira a noite", profile: "pista" } ] },
      { id: "ver", text: "Quando você quer ver as fotos?", options: [
        { id: "dia-seguinte", label: "No dia seguinte" }, { id: "semana", label: "Na mesma semana" }, { id: "tanto-faz", label: "Posso esperar revelar o filme", profile: "posado" } ] },
      { id: "estilo", text: "O que você mais gosta na câmera descartável?", options: [
        { id: "surpresa", label: "A surpresa de ver só depois" }, { id: "visual", label: "O visual de filme" },
        { id: "todos", label: "Todo mundo fotografar", profile: "espalhadas" } ] },
      COMMIT,
    ],
  },
  {
    slug: "camera-ideal", level: 4,
    title: "Qual é a câmera ideal para o seu casamento?",
    headline: "Monte a câmera ideal do seu casamento",
    lead: "4 perguntas. No fim, o perfil da sua festa e a configuração certa.",
    fallbackProfile: "espalhadas",
    questions: [
      GUESTS,
      WHEN,
      { id: "revelar", text: "Quando as fotos devem aparecer para todo mundo?", options: [
        { id: "manha", label: "Na manhã seguinte" }, { id: "fim", label: "Assim que a festa acabar", profile: "pista" }, { id: "data", label: "Numa data que eu escolher", profile: "posado" } ] },
      TRIED,
    ],
  },
  {
    slug: "rapido", level: 5,
    title: "Sua câmera do casamento em 1 minuto",
    headline: "Sua câmera do casamento em 1 minuto",
    lead: "Duas perguntas e a sua câmera fica pronta.",
    fallbackProfile: "espalhadas",
    questions: [GUESTS, WHEN],
  },
];

export const quizBySlug = (slug: string): Quiz | undefined => QUIZZES.find((q) => q.slug === slug);

export type Profile = { id: ProfileId; name: string; diagnosis: string };
export const PROFILES: Record<ProfileId, Profile> = {
  espalhadas: {
    id: "espalhadas", name: "Fotos Espalhadas",
    diagnosis: "Seus convidados vão fotografar bastante, mas cada foto fica num celular diferente. Grupo e hashtag recebem uma parte pequena, e em baixa qualidade.",
  },
  posado: {
    id: "posado", name: "Só o Posado",
    diagnosis: "O fotógrafo cobre a cerimônia e os retratos. O que acontece nas mesas, nos bastidores e no meio da pista fica só com quem estava lá.",
  },
  pista: {
    id: "pista", name: "Pista sem Registro",
    diagnosis: "A melhor parte da sua festa acontece tarde e longe do fotógrafo. Sem um lugar único para as fotos, é a parte que mais se perde.",
  },
};

/** Estimativa usada no resultado: fotos que cada convidado tira numa festa. Aparece na tela como estimativa, não como medida. */
export const PHOTOS_PER_GUEST = 12;

export type Answers = Record<string, string[]>;
export type QuizResult = { profile: ProfileId; guests: number | null; score: number | null; lostPhotos: number | null };

/** Perfil = o mais votado entre as respostas (empate: o primeiro a aparecer); convidados = a faixa escolhida; pontuação = itens do checklist. */
export function scoreQuiz(quiz: Quiz, answers: Answers): QuizResult {
  const votes = new Map<ProfileId, number>();
  let guests: number | null = null;
  let score: number | null = null;
  for (const q of quiz.questions) {
    const picked = answers[q.id] ?? [];
    if (q.multi) score = picked.length;
    for (const o of q.options) {
      if (!picked.includes(o.id)) continue;
      if (o.guests) guests = o.guests;
      if (o.profile) votes.set(o.profile, (votes.get(o.profile) ?? 0) + 1);
    }
  }
  let profile = quiz.fallbackProfile;
  let best = 0;
  for (const [id, n] of votes) if (n > best) { best = n; profile = id; }
  return { profile, guests, score, lostPhotos: guests ? guests * PHOTOS_PER_GUEST : null };
}
