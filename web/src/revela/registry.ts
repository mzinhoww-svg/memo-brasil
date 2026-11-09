// Mapa das telas (gerado de design-system/revela/TELAS.md): id, título, imagem de referência e componente.
export interface ScreenMeta { id: string; title: string; webp: string; html: string; name: string; master: boolean }
export const SCREENS: ScreenMeta[] = [
 {
  "id": "00",
  "title": "Splash",
  "webp": "telas/01-abertura/00-splash.webp",
  "html": "Abertura-splash",
  "name": "AberturaSplash",
  "master": false
 },
 {
  "id": "01",
  "title": "Abertura com vídeo",
  "webp": "telas/01-abertura/01-abertura-com-video.webp",
  "html": "Main",
  "name": "Main",
  "master": false
 },
 {
  "id": "02",
  "title": "Telefone",
  "webp": "telas/02-cadastro/02-telefone.webp",
  "html": "Cadastro-telefone",
  "name": "CadastroTelefone",
  "master": false
 },
 {
  "id": "03",
  "title": "Código",
  "webp": "telas/02-cadastro/03-codigo.webp",
  "html": "Cadastro-codigo",
  "name": "CadastroCodigo",
  "master": false
 },
 {
  "id": "04",
  "title": "Seu nome",
  "webp": "telas/02-cadastro/04-seu-nome.webp",
  "html": "Cadastro-perfil",
  "name": "CadastroPerfil",
  "master": false
 },
 {
  "id": "05",
  "title": "Para que vai usar",
  "webp": "telas/02-cadastro/05-para-que-vai-usar.webp",
  "html": "Cadastro-ocasiao",
  "name": "CadastroOcasiao",
  "master": false
 },
 {
  "id": "06",
  "title": "Monte a câmera",
  "webp": "telas/03-montar-a-camera/06-monte-a-camera.webp",
  "html": "Camera-montar",
  "name": "CameraMontar",
  "master": false
 },
 {
  "id": "07",
  "title": "Embalagem",
  "webp": "telas/03-montar-a-camera/07-embalagem.webp",
  "html": "Camera-embalagem",
  "name": "CameraEmbalagem",
  "master": false
 },
 {
  "id": "08",
  "title": "Nome impresso",
  "webp": "telas/03-montar-a-camera/08-nome-impresso.webp",
  "html": "Camera-nome",
  "name": "CameraNome",
  "master": false
 },
 {
  "id": "09",
  "title": "Até quando",
  "webp": "telas/03-montar-a-camera/09-ate-quando.webp",
  "html": "Camera-data",
  "name": "CameraData",
  "master": false
 },
 {
  "id": "10",
  "title": "Poses por pessoa",
  "webp": "telas/03-montar-a-camera/10-poses-por-pessoa.webp",
  "html": "Camera-poses",
  "name": "CameraPoses",
  "master": false
 },
 {
  "id": "11",
  "title": "Quando revelar",
  "webp": "telas/03-montar-a-camera/11-quando-revelar.webp",
  "html": "Camera-revelacao",
  "name": "CameraRevelacao",
  "master": false
 },
 {
  "id": "12",
  "title": "Filme",
  "webp": "telas/03-montar-a-camera/12-filme.webp",
  "html": "Camera-filtro",
  "name": "CameraFiltro",
  "master": false
 },
 {
  "id": "13",
  "title": "Quem vê o quê",
  "webp": "telas/03-montar-a-camera/13-quem-ve-o-que.webp",
  "html": "Camera-privacidade",
  "name": "CameraPrivacidade",
  "master": false
 },
 {
  "id": "14",
  "title": "Publicar",
  "webp": "telas/03-montar-a-camera/14-publicar.webp",
  "html": "Camera-publicar",
  "name": "CameraPublicar",
  "master": false
 },
 {
  "id": "15",
  "title": "Câmera pronta",
  "webp": "telas/03-montar-a-camera/15-camera-pronta.webp",
  "html": "Camera-pronta",
  "name": "CameraPronta",
  "master": false
 },
 {
  "id": "14a",
  "title": "Resumo e forma de pagamento",
  "webp": "telas/04-pagamento/14a-resumo-e-forma-de-pagamento.webp",
  "html": "Pagamento-resumo",
  "name": "PagamentoResumo",
  "master": false
 },
 {
  "id": "14b",
  "title": "Pix",
  "webp": "telas/04-pagamento/14b-pix.webp",
  "html": "Pagamento-pix",
  "name": "PagamentoPix",
  "master": false
 },
 {
  "id": "14c",
  "title": "Cartão",
  "webp": "telas/04-pagamento/14c-cartao.webp",
  "html": "Pagamento-cartao",
  "name": "PagamentoCartao",
  "master": false
 },
 {
  "id": "14d",
  "title": "Confirmação do banco",
  "webp": "telas/04-pagamento/14d-confirmacao-do-banco.webp",
  "html": "Pagamento-3ds",
  "name": "Pagamento3ds",
  "master": false
 },
 {
  "id": "14e",
  "title": "Confirmando",
  "webp": "telas/04-pagamento/14e-confirmando.webp",
  "html": "Pagamento-processando",
  "name": "PagamentoProcessando",
  "master": false
 },
 {
  "id": "14f",
  "title": "Pago",
  "webp": "telas/04-pagamento/14f-pago.webp",
  "html": "Pagamento-aprovado",
  "name": "PagamentoAprovado",
  "master": false
 },
 {
  "id": "14g",
  "title": "Não deu certo",
  "webp": "telas/04-pagamento/14g-nao-deu-certo.webp",
  "html": "Pagamento-falhou",
  "name": "PagamentoFalhou",
  "master": false
 },
 {
  "id": "14h",
  "title": "Trocar de plano",
  "webp": "telas/04-pagamento/14h-trocar-de-plano.webp",
  "html": "Pagamento-trocar-plano",
  "name": "PagamentoTrocarPlano",
  "master": false
 },
 {
  "id": "16",
  "title": "Câmeras (anfitrião)",
  "webp": "telas/05-anfitriao/16-cameras-anfitriao.webp",
  "html": "Anfitriao-inicio",
  "name": "AnfitriaoInicio",
  "master": false
 },
 {
  "id": "17",
  "title": "Ajustes do evento",
  "webp": "telas/05-anfitriao/17-ajustes-do-evento.webp",
  "html": "Anfitriao-ajustes",
  "name": "AnfitriaoAjustes",
  "master": false
 },
 {
  "id": "17b",
  "title": "Convidados",
  "webp": "telas/05-anfitriao/17b-convidados.webp",
  "html": "Anfitriao-convidados",
  "name": "AnfitriaoConvidados",
  "master": false
 },
 {
  "id": "17c",
  "title": "Revisar antes de revelar",
  "webp": "telas/05-anfitriao/17c-revisar-antes-de-revelar.webp",
  "html": "Anfitriao-moderar",
  "name": "AnfitriaoModerar",
  "master": false
 },
 {
  "id": "17d",
  "title": "Resumo do evento",
  "webp": "telas/06-painel-do-anfitriao/17d-resumo-do-evento.webp",
  "html": "Painel-resumo",
  "name": "PainelResumo",
  "master": false
 },
 {
  "id": "17e",
  "title": "Convites e mesas",
  "webp": "telas/06-painel-do-anfitriao/17e-convites-e-mesas.webp",
  "html": "Painel-convites",
  "name": "PainelConvites",
  "master": false
 },
 {
  "id": "17f",
  "title": "Programação e local",
  "webp": "telas/06-painel-do-anfitriao/17f-programacao-e-local.webp",
  "html": "Painel-programacao",
  "name": "PainelProgramacao",
  "master": false
 },
 {
  "id": "17g",
  "title": "Aviso aos convidados",
  "webp": "telas/06-painel-do-anfitriao/17g-aviso-aos-convidados.webp",
  "html": "Painel-aviso",
  "name": "PainelAviso",
  "master": false
 },
 {
  "id": "17h",
  "title": "Downloads",
  "webp": "telas/06-painel-do-anfitriao/17h-downloads.webp",
  "html": "Painel-downloads",
  "name": "PainelDownloads",
  "master": false
 },
 {
  "id": "17i",
  "title": "Moderar comentários",
  "webp": "telas/06-painel-do-anfitriao/17i-moderar-comentarios.webp",
  "html": "Painel-moderacao",
  "name": "PainelModeracao",
  "master": false
 },
 {
  "id": "17j",
  "title": "Excluir evento",
  "webp": "telas/06-painel-do-anfitriao/17j-excluir-evento.webp",
  "html": "Painel-excluir",
  "name": "PainelExcluir",
  "master": false
 },
 {
  "id": "17k",
  "title": "Convite A5 para imprimir",
  "webp": "telas/06-painel-do-anfitriao/17k-convite-a5-para-imprimir.webp",
  "html": "Painel-convite-a5",
  "name": "PainelConviteA5",
  "master": false
 },
 {
  "id": "18",
  "title": "Revelação",
  "webp": "telas/07-revelacao/18-revelacao.webp",
  "html": "Revelados-galeria",
  "name": "ReveladosGaleria",
  "master": false
 },
 {
  "id": "19",
  "title": "Foto aberta",
  "webp": "telas/07-revelacao/19-foto-aberta.webp",
  "html": "Revelados-foto",
  "name": "ReveladosFoto",
  "master": false
 },
 {
  "id": "19b",
  "title": "Álbum impresso",
  "webp": "telas/07-revelacao/19b-album-impresso.webp",
  "html": "Revelados-album",
  "name": "ReveladosAlbum",
  "master": false
 },
 {
  "id": "20a",
  "title": "Leitura do QR",
  "webp": "telas/08-convidado/20a-leitura-do-qr.webp",
  "html": "Convidado-qr",
  "name": "ConvidadoQr",
  "master": false
 },
 {
  "id": "20b",
  "title": "Entrar no evento",
  "webp": "telas/08-convidado/20b-entrar-no-evento.webp",
  "html": "Convidado-entrar",
  "name": "ConvidadoEntrar",
  "master": false
 },
 {
  "id": "20c",
  "title": "Código do convite",
  "webp": "telas/08-convidado/20c-codigo-do-convite.webp",
  "html": "Convidado-codigo",
  "name": "ConvidadoCodigo",
  "master": false
 },
 {
  "id": "20d",
  "title": "Consentimento",
  "webp": "telas/08-convidado/20d-consentimento.webp",
  "html": "Convidado-consentimento",
  "name": "ConvidadoConsentimento",
  "master": false
 },
 {
  "id": "20e",
  "title": "Convite inválido",
  "webp": "telas/08-convidado/20e-convite-invalido.webp",
  "html": "Convidado-invalido",
  "name": "ConvidadoInvalido",
  "master": false
 },
 {
  "id": "20f",
  "title": "Câmera lotada",
  "webp": "telas/08-convidado/20f-camera-lotada.webp",
  "html": "Convidado-lotado",
  "name": "ConvidadoLotado",
  "master": false
 },
 {
  "id": "20g",
  "title": "Carregando a festa",
  "webp": "telas/08-convidado/20g-carregando-a-festa.webp",
  "html": "Convidado-carregando",
  "name": "ConvidadoCarregando",
  "master": false
 },
 {
  "id": "20h",
  "title": "Código não confere",
  "webp": "telas/08-convidado/20h-codigo-nao-confere.webp",
  "html": "Convidado-codigo-erro",
  "name": "ConvidadoCodigoErro",
  "master": false
 },
 {
  "id": "21",
  "title": "Câmera",
  "webp": "telas/08-convidado/21-camera.webp",
  "html": "Convidado-camera",
  "name": "ConvidadoCamera",
  "master": false
 },
 {
  "id": "22",
  "title": "Disparo",
  "webp": "telas/08-convidado/22-disparo.webp",
  "html": "Convidado-flash",
  "name": "ConvidadoFlash",
  "master": false
 },
 {
  "id": "23",
  "title": "Acesso à câmera",
  "webp": "telas/08-convidado/23-acesso-a-camera.webp",
  "html": "Convidado-permissao",
  "name": "ConvidadoPermissao",
  "master": false
 },
 {
  "id": "24",
  "title": "Filme acabou",
  "webp": "telas/08-convidado/24-filme-acabou.webp",
  "html": "Convidado-fim",
  "name": "ConvidadoFim",
  "master": false
 },
 {
  "id": "23b",
  "title": "Feed antes da revelação",
  "webp": "telas/09-convidado-no-evento/23b-feed-antes-da-revelacao.webp",
  "html": "Convidado-laboratorio",
  "name": "ConvidadoLaboratorio",
  "master": false
 },
 {
  "id": "23c",
  "title": "Minhas poses",
  "webp": "telas/09-convidado-no-evento/23c-minhas-poses.webp",
  "html": "Convidado-minhas",
  "name": "ConvidadoMinhas",
  "master": false
 },
 {
  "id": "23d",
  "title": "Enviar do rolo",
  "webp": "telas/09-convidado-no-evento/23d-enviar-do-rolo.webp",
  "html": "Convidado-postar",
  "name": "ConvidadoPostar",
  "master": false
 },
 {
  "id": "23e",
  "title": "Editar foto",
  "webp": "telas/09-convidado-no-evento/23e-editar-foto.webp",
  "html": "Convidado-editar",
  "name": "ConvidadoEditar",
  "master": false
 },
 {
  "id": "23f",
  "title": "Programação",
  "webp": "telas/09-convidado-no-evento/23f-programacao.webp",
  "html": "Convidado-programacao",
  "name": "ConvidadoProgramacao",
  "master": false
 },
 {
  "id": "23g",
  "title": "Você (convidado)",
  "webp": "telas/09-convidado-no-evento/23g-voce-convidado.webp",
  "html": "Convidado-voce",
  "name": "ConvidadoVoce",
  "master": false
 },
 {
  "id": "24b",
  "title": "Aviso de revelação",
  "webp": "telas/10-feed/24b-aviso-de-revelacao.webp",
  "html": "Feed-aviso",
  "name": "FeedAviso",
  "master": false
 },
 {
  "id": "24c",
  "title": "Revelou",
  "webp": "telas/10-feed/24c-revelou.webp",
  "html": "Feed-revelou",
  "name": "FeedRevelou",
  "master": false
 },
 {
  "id": "24d",
  "title": "Feed do evento",
  "webp": "telas/10-feed/24d-feed-do-evento.webp",
  "html": "Feed-evento",
  "name": "FeedEvento",
  "master": false
 },
 {
  "id": "24e",
  "title": "Comentários",
  "webp": "telas/10-feed/24e-comentarios.webp",
  "html": "Feed-comentarios",
  "name": "FeedComentarios",
  "master": false
 },
 {
  "id": "24f",
  "title": "Reações",
  "webp": "telas/10-feed/24f-reacoes.webp",
  "html": "Feed-reacoes",
  "name": "FeedReacoes",
  "master": false
 },
 {
  "id": "24g",
  "title": "Denunciar",
  "webp": "telas/10-feed/24g-denunciar.webp",
  "html": "Feed-denunciar",
  "name": "FeedDenunciar",
  "master": false
 },
 {
  "id": "24h",
  "title": "Retrospectiva",
  "webp": "telas/10-feed/24h-retrospectiva.webp",
  "html": "Feed-retrospectiva",
  "name": "FeedRetrospectiva",
  "master": false
 },
 {
  "id": "24i",
  "title": "Aviso por e-mail",
  "webp": "telas/10-feed/24i-aviso-por-e-mail.webp",
  "html": "Feed-email",
  "name": "FeedEmail",
  "master": false
 },
 {
  "id": "24j",
  "title": "Sair dos avisos por e-mail",
  "webp": "telas/10-feed/24j-sair-dos-avisos-por-e-mail.webp",
  "html": "Feed-email-sair",
  "name": "FeedEmailSair",
  "master": false
 },
 {
  "id": "25",
  "title": "QR para as mesas",
  "webp": "telas/11-qr-e-convite/25-qr-para-as-mesas.webp",
  "html": "QR-convite",
  "name": "QRConvite",
  "master": false
 },
 {
  "id": "26",
  "title": "Compartilhar",
  "webp": "telas/11-qr-e-convite/26-compartilhar.webp",
  "html": "QR-compartilhar",
  "name": "QRCompartilhar",
  "master": false
 },
 {
  "id": "27",
  "title": "Você",
  "webp": "telas/12-voce/27-voce.webp",
  "html": "Voce",
  "name": "Voce",
  "master": false
 },
 {
  "id": "28",
  "title": "Sem internet",
  "webp": "telas/13-apoio/28-sem-internet.webp",
  "html": "Apoio-offline",
  "name": "ApoioOffline",
  "master": false
 },
 {
  "id": "29",
  "title": "Excluir conta",
  "webp": "telas/13-apoio/29-excluir-conta.webp",
  "html": "Apoio-excluir-conta",
  "name": "ApoioExcluirConta",
  "master": false
 },
 {
  "id": "30",
  "title": "Preços",
  "webp": "telas/13-apoio/30-precos.webp",
  "html": "Apoio-precos",
  "name": "ApoioPrecos",
  "master": false
 },
 {
  "id": "31",
  "title": "Termos e privacidade",
  "webp": "telas/13-apoio/31-termos-e-privacidade.webp",
  "html": "Apoio-termos",
  "name": "ApoioTermos",
  "master": false
 },
 {
  "id": "32",
  "title": "Ajuda",
  "webp": "telas/13-apoio/32-ajuda.webp",
  "html": "Apoio-ajuda",
  "name": "ApoioAjuda",
  "master": false
 },
 {
  "id": "M00",
  "title": "Login",
  "webp": "telas/14-master/M00-login.webp",
  "html": "Master-login",
  "name": "MasterLogin",
  "master": true
 },
 {
  "id": "M01",
  "title": "Visão geral",
  "webp": "telas/14-master/M01-visao-geral.webp",
  "html": "Master-visao",
  "name": "MasterVisao",
  "master": true
 },
 {
  "id": "M02",
  "title": "Eventos",
  "webp": "telas/14-master/M02-eventos.webp",
  "html": "Master-eventos",
  "name": "MasterEventos",
  "master": true
 },
 {
  "id": "M03",
  "title": "Planos e preços",
  "webp": "telas/14-master/M03-planos-e-precos.webp",
  "html": "Master-planos",
  "name": "MasterPlanos",
  "master": true
 },
 {
  "id": "M04",
  "title": "Confirmar novo preço",
  "webp": "telas/14-master/M04-confirmar-novo-preco.webp",
  "html": "Master-plano-publicar",
  "name": "MasterPlanoPublicar",
  "master": true
 },
 {
  "id": "M05",
  "title": "Pagamentos",
  "webp": "telas/14-master/M05-pagamentos.webp",
  "html": "Master-pagamentos",
  "name": "MasterPagamentos",
  "master": true
 },
 {
  "id": "M06",
  "title": "Detalhe do pagamento",
  "webp": "telas/14-master/M06-detalhe-do-pagamento.webp",
  "html": "Master-pagamento-detalhe",
  "name": "MasterPagamentoDetalhe",
  "master": true
 },
 {
  "id": "M07",
  "title": "Cortesias",
  "webp": "telas/14-master/M07-cortesias.webp",
  "html": "Master-cortesias",
  "name": "MasterCortesias",
  "master": true
 },
 {
  "id": "M08",
  "title": "Revelações",
  "webp": "telas/14-master/M08-revelacoes.webp",
  "html": "Master-revelacoes",
  "name": "MasterRevelacoes",
  "master": true
 },
 {
  "id": "M09",
  "title": "Moderação",
  "webp": "telas/14-master/M09-moderacao.webp",
  "html": "Master-moderacao",
  "name": "MasterModeracao",
  "master": true
 },
 {
  "id": "M10",
  "title": "Pessoas",
  "webp": "telas/14-master/M10-pessoas.webp",
  "html": "Master-pessoas",
  "name": "MasterPessoas",
  "master": true
 },
 {
  "id": "M11",
  "title": "Storage e saúde",
  "webp": "telas/14-master/M11-storage-e-saude.webp",
  "html": "Master-saude",
  "name": "MasterSaude",
  "master": true
 },
 {
  "id": "M12",
  "title": "LGPD",
  "webp": "telas/14-master/M12-lgpd.webp",
  "html": "Master-lgpd",
  "name": "MasterLgpd",
  "master": true
 },
 {
  "id": "M13",
  "title": "Auditoria",
  "webp": "telas/14-master/M13-auditoria.webp",
  "html": "Master-auditoria",
  "name": "MasterAuditoria",
  "master": true
 },
 {
  "id": "M14",
  "title": "Configurações",
  "webp": "telas/14-master/M14-configuracoes.webp",
  "html": "Master-config",
  "name": "MasterConfig",
  "master": true
 }
];
