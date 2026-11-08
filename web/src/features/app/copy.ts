/** Textos que dependem do modo: "neste aparelho" só é verdade no modo local; na nuvem os dados ficam no servidor. */
export type CopyMode = "local" | "supabase";

export interface ModeCopy {
  /** Mensagem curta (erro do campo de código). */
  inviteInvalid: string;
  /** Parágrafo da tela de convite inválido (abaixo do título "Código não confere."). */
  inviteInvalidBody: string;
  errorBody: string;
  offlineBody: string;
  storageBanner: string;
  downloadsSaved: (saved: number, missing: number) => string;
  downloadsNote: string;
  deleteQuestion: string;
  deleteBody: string;
  panelNotFoundBody: string;
  noticeOn: string;
}

const plural = (n: number) => `${n} ${n === 1 ? "foto" : "fotos"}`;

const LOCAL: ModeCopy = {
  inviteInvalid: "Código não confere. Confira no card da mesa.",
  inviteInvalidBody: "Confira no card da mesa. Esta versão só abre festas criadas neste aparelho.",
  errorBody: "Suas fotos continuam guardadas neste aparelho. Tente de novo.",
  offlineBody: "Suas fotos estão guardadas neste aparelho. Tente de novo quando o sinal voltar.",
  storageBanner: "Não deu para guardar neste aparelho. Libere espaço ou saia do modo privado e tente de novo.",
  downloadsSaved: (saved, missing) => `Baixamos ${plural(saved)}${missing ? `. ${missing} não estavam neste aparelho.` : "."}`,
  downloadsNote: "As fotos baixadas são as que estão guardadas neste aparelho.",
  deleteQuestion: "Excluir evento?",
  deleteBody: "As fotos e reações deste evento serão apagadas. Não dá para desfazer.",
  panelNotFoundBody: "Esta versão só abre eventos criados neste aparelho.",
  noticeOn: "Avisos ligados neste aparelho.",
};

const CLOUD: ModeCopy = {
  inviteInvalid: "Código não confere. Confira as 8 letras e números no card da mesa.",
  inviteInvalidBody: "Confira as 8 letras e números no card da mesa.",
  errorBody: "Algo deu errado. Suas fotos enviadas estão guardadas.",
  offlineBody: "Suas fotos enviadas estão guardadas. Tente de novo quando o sinal voltar.",
  storageBanner: "Este navegador não deixou guardar os dados. Libere espaço ou saia do modo privado e tente de novo.",
  downloadsSaved: (saved, missing) => missing ? `Baixamos ${saved} de ${saved + missing} fotos. ${missing} não puderam ser incluídas. Tente de novo para completar o álbum.` : `Baixamos ${plural(saved)}.`,
  downloadsNote: "O álbum reúne as fotos do evento que ainda não foram removidas.",
  deleteQuestion: "Excluir este evento e todas as fotos?",
  deleteBody: "As fotos e reações deste evento serão apagadas. Não dá para desfazer.",
  panelNotFoundBody: "Confira o link ou entre com a conta Google que criou o evento.",
  noticeOn: "Avisos ligados.",
};

export const copyFor = (mode: CopyMode): ModeCopy => (mode === "supabase" ? CLOUD : LOCAL);
