import type { ReferenceProblem } from "./reference";
import type { SmartAlbumFailure } from "./service";

/** Microcopy do Smart Album (seção 4.5 do plano). Nunca prometer identificação certa: "podem ser suas", "sugestões". */
export const COPY = {
  menu: "Minhas Fotos",
  title: "Minhas Fotos",
  introTitle: "Encontre seus momentos.",
  introBody: "Escolha uma foto sua para receber sugestões das fotos em que você aparece, depois da revelação. A busca pode errar: você confere cada sugestão.",
  skip: "Continuar sem reconhecimento",
  sourceTitle: "Escolha uma foto sua",
  sourceBody: "Só você, de frente, com boa luz. Ela não aparece para ninguém e não vira foto do evento.",
  google: "Foto do Google",
  gallery: "Escolher da galeria",
  camera: "Tirar uma foto",
  later: "Fazer depois",
  reviewTitle: "Confira a foto",
  reviewTips: "Rosto inteiro, sem óculos escuros, sem outras pessoas e com boa luz.",
  selfConfirm: "Esta foto é minha e mostra o meu rosto.",
  consentTitle: "Ativar busca de fotos em que apareço (opcional)",
  consentBody:
    "Quero usar uma imagem minha como referência para que o Revela sugira fotografias deste evento em que eu possa aparecer. Entendo que a busca pode errar, que minhas fotos só serão exibidas conforme as permissões e a revelação do evento, e que posso desativar o recurso e solicitar exclusão dos dados relacionados. Li as informações específicas sobre processamento, retenção e compartilhamento.",
  consentThirdParties: "Outras pessoas também aparecem nas fotos do evento. A busca só procura você, nunca dá nome a ninguém e não funciona em outros eventos.",
  activate: "Ativar Minhas Fotos",
  faceUnavailableTitle: "A busca por reconhecimento ainda não está liberada.",
  faceUnavailableBody: "Nada da sua foto foi enviado. Enquanto isso, Minhas Fotos mostra as fotos que você tirou e as que você marcar como favoritas.",
  accountNeeded: "Para ativar a busca, entre com sua conta Google. O álbum manual funciona sem isso.",
  useManual: "Usar o álbum manual",
  searching: "Procurando seus momentos…",
  searchingBody: "Você pode continuar usando o Revela.",
  results: "Fotos que podem ser suas",
  empty: "Ainda não encontramos correspondências.",
  emptyBody: "Você pode trocar sua foto ou selecionar fotos manualmente.",
  beforeReveal: "Suas fotos serão mostradas quando o evento for revelado.",
  privacy: "Desativar busca facial e apagar meus dados de referência",
  inviteTitle: "Encontre fotos em que você aparece",
  inviteBody: "Escolha uma foto sua e, depois da revelação, veja sugestões das fotos em que você pode estar.",
} as const;

export function referenceProblemText(p: ReferenceProblem): string {
  switch (p) {
    case "too-large": return "Arquivo grande demais (até 15 MB). Escolha outra foto.";
    case "unsupported": return "Formato não aceito. Use uma foto JPG, PNG, WebP ou HEIC.";
    case "undecodable": return "Não deu para abrir essa foto neste aparelho. Escolha outra (JPG ou PNG funcionam em todos).";
    case "too-small": return "Foto pequena demais. Use uma foto com pelo menos 320 pixels no lado menor.";
    case "no-face": return "Não encontramos um rosto nessa foto. Escolha uma foto sua, de frente.";
    case "many-faces": return "Aparece mais de uma pessoa. Escolha uma foto só sua.";
  }
}

export function failureText(code: SmartAlbumFailure): string {
  switch (code) {
    case "disabled": return "Este recurso não está disponível neste evento agora.";
    case "consent": return "Ative a busca com o seu consentimento para continuar.";
    case "notrevealed": return COPY.beforeReveal;
    case "forbidden": return "Você não tem acesso a esta foto ou a este evento.";
    case "invalid": return "Algo não confere. Escolha a foto de novo.";
    case "rate-limited": return "Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.";
    default: return "Não deu para falar com o servidor. Confira a conexão e tente de novo.";
  }
}

/** Erros do motor que a pessoa resolve trocando a referência (códigos do worker). */
export function jobErrorText(code: string | null): string {
  switch (code) {
    case "no_face": return "Não encontramos um rosto na sua foto. Troque a foto para tentar de novo.";
    case "multiple_faces": return "Sua foto tem mais de uma pessoa. Troque por uma foto só sua.";
    case "low_quality": case "invalid_image": return "Sua foto não tem qualidade suficiente. Troque por outra, com boa luz.";
    default: return "A busca não terminou desta vez. Tente de novo em alguns minutos.";
  }
}
