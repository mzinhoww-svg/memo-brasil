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
 },
 {
  "id": "M15",
  "title": "Pessoas: contas",
  "webp": "master/png/Master-pessoas-contas.png",
  "html": "Master-pessoas-contas",
  "name": "MasterPessoasContas",
  "master": true
 },
 {
  "id": "M15-v",
  "title": "Pessoas: contas (vazio)",
  "webp": "master/png/Master-pessoas-contas--vazio.png",
  "html": "Master-pessoas-contas--vazio",
  "name": "MasterPessoasContasVazio",
  "master": true
 },
 {
  "id": "M15-e",
  "title": "Pessoas: contas (erro)",
  "webp": "master/png/Master-pessoas-contas--erro.png",
  "html": "Master-pessoas-contas--erro",
  "name": "MasterPessoasContasErro",
  "master": true
 },
 {
  "id": "M15-p",
  "title": "Pessoas: contas (sem permissão)",
  "webp": "master/png/Master-pessoas-contas--sem-permissao.png",
  "html": "Master-pessoas-contas--sem-permissao",
  "name": "MasterPessoasContasSemPermissao",
  "master": true
 },
 {
  "id": "M15-c",
  "title": "Pessoas: contas (carregando)",
  "webp": "master/png/Master-pessoas-contas--carregando.png",
  "html": "Master-pessoas-contas--carregando",
  "name": "MasterPessoasContasCarregando",
  "master": true
 },
 {
  "id": "M16",
  "title": "Pessoas: organizadores",
  "webp": "master/png/Master-pessoas-organizadores.png",
  "html": "Master-pessoas-organizadores",
  "name": "MasterPessoasOrganizadores",
  "master": true
 },
 {
  "id": "M16-v",
  "title": "Pessoas: organizadores (vazio)",
  "webp": "master/png/Master-pessoas-organizadores--vazio.png",
  "html": "Master-pessoas-organizadores--vazio",
  "name": "MasterPessoasOrganizadoresVazio",
  "master": true
 },
 {
  "id": "M16-e",
  "title": "Pessoas: organizadores (erro)",
  "webp": "master/png/Master-pessoas-organizadores--erro.png",
  "html": "Master-pessoas-organizadores--erro",
  "name": "MasterPessoasOrganizadoresErro",
  "master": true
 },
 {
  "id": "M16-p",
  "title": "Pessoas: organizadores (sem permissão)",
  "webp": "master/png/Master-pessoas-organizadores--sem-permissao.png",
  "html": "Master-pessoas-organizadores--sem-permissao",
  "name": "MasterPessoasOrganizadoresSemPermissao",
  "master": true
 },
 {
  "id": "M16-c",
  "title": "Pessoas: organizadores (carregando)",
  "webp": "master/png/Master-pessoas-organizadores--carregando.png",
  "html": "Master-pessoas-organizadores--carregando",
  "name": "MasterPessoasOrganizadoresCarregando",
  "master": true
 },
 {
  "id": "M17",
  "title": "Pessoas: convidados",
  "webp": "master/png/Master-pessoas-convidados.png",
  "html": "Master-pessoas-convidados",
  "name": "MasterPessoasConvidados",
  "master": true
 },
 {
  "id": "M17-v",
  "title": "Pessoas: convidados (vazio)",
  "webp": "master/png/Master-pessoas-convidados--vazio.png",
  "html": "Master-pessoas-convidados--vazio",
  "name": "MasterPessoasConvidadosVazio",
  "master": true
 },
 {
  "id": "M17-e",
  "title": "Pessoas: convidados (erro)",
  "webp": "master/png/Master-pessoas-convidados--erro.png",
  "html": "Master-pessoas-convidados--erro",
  "name": "MasterPessoasConvidadosErro",
  "master": true
 },
 {
  "id": "M17-p",
  "title": "Pessoas: convidados (sem permissão)",
  "webp": "master/png/Master-pessoas-convidados--sem-permissao.png",
  "html": "Master-pessoas-convidados--sem-permissao",
  "name": "MasterPessoasConvidadosSemPermissao",
  "master": true
 },
 {
  "id": "M17-c",
  "title": "Pessoas: convidados (carregando)",
  "webp": "master/png/Master-pessoas-convidados--carregando.png",
  "html": "Master-pessoas-convidados--carregando",
  "name": "MasterPessoasConvidadosCarregando",
  "master": true
 },
 {
  "id": "M18",
  "title": "Pessoas: convites",
  "webp": "master/png/Master-pessoas-convites.png",
  "html": "Master-pessoas-convites",
  "name": "MasterPessoasConvites",
  "master": true
 },
 {
  "id": "M18-v",
  "title": "Pessoas: convites (vazio)",
  "webp": "master/png/Master-pessoas-convites--vazio.png",
  "html": "Master-pessoas-convites--vazio",
  "name": "MasterPessoasConvitesVazio",
  "master": true
 },
 {
  "id": "M18-e",
  "title": "Pessoas: convites (erro)",
  "webp": "master/png/Master-pessoas-convites--erro.png",
  "html": "Master-pessoas-convites--erro",
  "name": "MasterPessoasConvitesErro",
  "master": true
 },
 {
  "id": "M18-p",
  "title": "Pessoas: convites (sem permissão)",
  "webp": "master/png/Master-pessoas-convites--sem-permissao.png",
  "html": "Master-pessoas-convites--sem-permissao",
  "name": "MasterPessoasConvitesSemPermissao",
  "master": true
 },
 {
  "id": "M18-c",
  "title": "Pessoas: convites (carregando)",
  "webp": "master/png/Master-pessoas-convites--carregando.png",
  "html": "Master-pessoas-convites--carregando",
  "name": "MasterPessoasConvitesCarregando",
  "master": true
 },
 {
  "id": "M19",
  "title": "Pessoas: equipe",
  "webp": "master/png/Master-pessoas-equipe.png",
  "html": "Master-pessoas-equipe",
  "name": "MasterPessoasEquipe",
  "master": true
 },
 {
  "id": "M19-v",
  "title": "Pessoas: equipe (vazio)",
  "webp": "master/png/Master-pessoas-equipe--vazio.png",
  "html": "Master-pessoas-equipe--vazio",
  "name": "MasterPessoasEquipeVazio",
  "master": true
 },
 {
  "id": "M19-e",
  "title": "Pessoas: equipe (erro)",
  "webp": "master/png/Master-pessoas-equipe--erro.png",
  "html": "Master-pessoas-equipe--erro",
  "name": "MasterPessoasEquipeErro",
  "master": true
 },
 {
  "id": "M19-p",
  "title": "Pessoas: equipe (sem permissão)",
  "webp": "master/png/Master-pessoas-equipe--sem-permissao.png",
  "html": "Master-pessoas-equipe--sem-permissao",
  "name": "MasterPessoasEquipeSemPermissao",
  "master": true
 },
 {
  "id": "M19-c",
  "title": "Pessoas: equipe (carregando)",
  "webp": "master/png/Master-pessoas-equipe--carregando.png",
  "html": "Master-pessoas-equipe--carregando",
  "name": "MasterPessoasEquipeCarregando",
  "master": true
 },
 {
  "id": "M19-f1",
  "title": "Equipe: conceder papel",
  "webp": "master/png/Master-pessoas-equipe--folha-conceder.png",
  "html": "Master-pessoas-equipe--folha-conceder",
  "name": "MasterPessoasEquipeFolhaConceder",
  "master": true
 },
 {
  "id": "M19-f2",
  "title": "Equipe: revogar papel",
  "webp": "master/png/Master-pessoas-equipe--folha-revogar.png",
  "html": "Master-pessoas-equipe--folha-revogar",
  "name": "MasterPessoasEquipeFolhaRevogar",
  "master": true
 },
 {
  "id": "M20",
  "title": "Visão geral: atividade por dia",
  "webp": "master/png/Master-visao-atividade.png",
  "html": "Master-visao-atividade",
  "name": "MasterVisaoAtividade",
  "master": true
 },
 {
  "id": "M20-v",
  "title": "Visão geral: atividade por dia (vazio)",
  "webp": "master/png/Master-visao-atividade--vazio.png",
  "html": "Master-visao-atividade--vazio",
  "name": "MasterVisaoAtividadeVazio",
  "master": true
 },
 {
  "id": "M20-e",
  "title": "Visão geral: atividade por dia (erro)",
  "webp": "master/png/Master-visao-atividade--erro.png",
  "html": "Master-visao-atividade--erro",
  "name": "MasterVisaoAtividadeErro",
  "master": true
 },
 {
  "id": "M20-p",
  "title": "Visão geral: atividade por dia (sem permissão)",
  "webp": "master/png/Master-visao-atividade--sem-permissao.png",
  "html": "Master-visao-atividade--sem-permissao",
  "name": "MasterVisaoAtividadeSemPermissao",
  "master": true
 },
 {
  "id": "M20-c",
  "title": "Visão geral: atividade por dia (carregando)",
  "webp": "master/png/Master-visao-atividade--carregando.png",
  "html": "Master-visao-atividade--carregando",
  "name": "MasterVisaoAtividadeCarregando",
  "master": true
 },
 {
  "id": "M20-t",
  "title": "Visão geral: atividade por dia (tabela)",
  "webp": "master/png/Master-visao-atividade--tabela.png",
  "html": "Master-visao-atividade--tabela",
  "name": "MasterVisaoAtividadeTabela",
  "master": true
 },
 {
  "id": "M21",
  "title": "Evento: detalhe",
  "webp": "master/png/Master-evento-detalhe.png",
  "html": "Master-evento-detalhe",
  "name": "MasterEventoDetalhe",
  "master": true
 },
 {
  "id": "M21-v",
  "title": "Evento: detalhe (vazio)",
  "webp": "master/png/Master-evento-detalhe--vazio.png",
  "html": "Master-evento-detalhe--vazio",
  "name": "MasterEventoDetalheVazio",
  "master": true
 },
 {
  "id": "M21-e",
  "title": "Evento: detalhe (erro)",
  "webp": "master/png/Master-evento-detalhe--erro.png",
  "html": "Master-evento-detalhe--erro",
  "name": "MasterEventoDetalheErro",
  "master": true
 },
 {
  "id": "M21-p",
  "title": "Evento: detalhe (sem permissão)",
  "webp": "master/png/Master-evento-detalhe--sem-permissao.png",
  "html": "Master-evento-detalhe--sem-permissao",
  "name": "MasterEventoDetalheSemPermissao",
  "master": true
 },
 {
  "id": "M21-c",
  "title": "Evento: detalhe (carregando)",
  "webp": "master/png/Master-evento-detalhe--carregando.png",
  "html": "Master-evento-detalhe--carregando",
  "name": "MasterEventoDetalheCarregando",
  "master": true
 },
 {
  "id": "M21-f1",
  "title": "Evento: marcar como teste",
  "webp": "master/png/Master-evento-detalhe--folha-teste.png",
  "html": "Master-evento-detalhe--folha-teste",
  "name": "MasterEventoDetalheFolhaTeste",
  "master": true
 },
 {
  "id": "M21-f1r",
  "title": "Evento: marcar como teste (recusado)",
  "webp": "master/png/Master-evento-detalhe--folha-teste-recusa.png",
  "html": "Master-evento-detalhe--folha-teste-recusa",
  "name": "MasterEventoDetalheFolhaTesteRecusa",
  "master": true
 },
 {
  "id": "M21-f2",
  "title": "Evento: excluir evento de teste",
  "webp": "master/png/Master-evento-detalhe--folha-excluir-teste.png",
  "html": "Master-evento-detalhe--folha-excluir-teste",
  "name": "MasterEventoDetalheFolhaExcluirTeste",
  "master": true
 },
 {
  "id": "M22",
  "title": "Eventos de teste",
  "webp": "master/png/Master-eventos-teste.png",
  "html": "Master-eventos-teste",
  "name": "MasterEventosTeste",
  "master": true
 },
 {
  "id": "M22-v",
  "title": "Eventos de teste (vazio)",
  "webp": "master/png/Master-eventos-teste--vazio.png",
  "html": "Master-eventos-teste--vazio",
  "name": "MasterEventosTesteVazio",
  "master": true
 },
 {
  "id": "M22-e",
  "title": "Eventos de teste (erro)",
  "webp": "master/png/Master-eventos-teste--erro.png",
  "html": "Master-eventos-teste--erro",
  "name": "MasterEventosTesteErro",
  "master": true
 },
 {
  "id": "M22-p",
  "title": "Eventos de teste (sem permissão)",
  "webp": "master/png/Master-eventos-teste--sem-permissao.png",
  "html": "Master-eventos-teste--sem-permissao",
  "name": "MasterEventosTesteSemPermissao",
  "master": true
 },
 {
  "id": "M22-c",
  "title": "Eventos de teste (carregando)",
  "webp": "master/png/Master-eventos-teste--carregando.png",
  "html": "Master-eventos-teste--carregando",
  "name": "MasterEventosTesteCarregando",
  "master": true
 },
 {
  "id": "M22-f1",
  "title": "Eventos de teste: excluir em lote",
  "webp": "master/png/Master-eventos-teste--folha-excluir-lote.png",
  "html": "Master-eventos-teste--folha-excluir-lote",
  "name": "MasterEventosTesteFolhaExcluirLote",
  "master": true
 },
 {
  "id": "M22-f2",
  "title": "Eventos de teste: lote recusado",
  "webp": "master/png/Master-eventos-teste--folha-recusa.png",
  "html": "Master-eventos-teste--folha-recusa",
  "name": "MasterEventosTesteFolhaRecusa",
  "master": true
 },
 {
  "id": "M23",
  "title": "Pagamentos: conciliar agora (código)",
  "webp": "master/png/Master-pagamentos--folha-conciliar-codigo.png",
  "html": "Master-pagamentos--folha-conciliar-codigo",
  "name": "MasterPagamentosFolhaConciliarCodigo",
  "master": true
 },
 {
  "id": "M23-r",
  "title": "Pagamentos: conciliar agora (resultado)",
  "webp": "master/png/Master-pagamentos--folha-conciliar-resultado.png",
  "html": "Master-pagamentos--folha-conciliar-resultado",
  "name": "MasterPagamentosFolhaConciliarResultado",
  "master": true
 },
 {
  "id": "M23-w",
  "title": "Pagamentos: conciliar agora (aguarde)",
  "webp": "master/png/Master-pagamentos--folha-conciliar-espera.png",
  "html": "Master-pagamentos--folha-conciliar-espera",
  "name": "MasterPagamentosFolhaConciliarEspera",
  "master": true
 },
 {
  "id": "M24",
  "title": "Exportar (folha padrão)",
  "webp": "master/png/Master-exportar--folha.png",
  "html": "Master-exportar--folha",
  "name": "MasterExportarFolha",
  "master": true
 },
 {
  "id": "M24-t",
  "title": "Exportar (truncado em 50 mil linhas)",
  "webp": "master/png/Master-exportar--folha-truncado.png",
  "html": "Master-exportar--folha-truncado",
  "name": "MasterExportarFolhaTruncado",
  "master": true
 },
 {
  "id": "M25",
  "title": "Revelar agora (folha única)",
  "webp": "master/png/Master-revelar-agora--folha.png",
  "html": "Master-revelar-agora--folha",
  "name": "MasterRevelarAgoraFolha",
  "master": true
 },
 {
  "id": "M25-a",
  "title": "Revelar agora (erro: Este evento já foi revelado.)",
  "webp": "master/png/Master-revelar-agora--folha-erro-ja-revelado.png",
  "html": "Master-revelar-agora--folha-erro-ja-revelado",
  "name": "MasterRevelarAgoraFolhaErroJaRevelado",
  "master": true
 },
 {
  "id": "M25-b",
  "title": "Revelar agora (erro: Evento sem revelação ligada.)",
  "webp": "master/png/Master-revelar-agora--folha-erro-sem-revelacao.png",
  "html": "Master-revelar-agora--folha-erro-sem-revelacao",
  "name": "MasterRevelarAgoraFolhaErroSemRevelacao",
  "master": true
 },
 {
  "id": "M25-c",
  "title": "Revelar agora (erro: Sem permissão)",
  "webp": "master/png/Master-revelar-agora--folha-erro-sem-permissao.png",
  "html": "Master-revelar-agora--folha-erro-sem-permissao",
  "name": "MasterRevelarAgoraFolhaErroSemPermissao",
  "master": true
 },
 {
  "id": "M26",
  "title": "Moderação: fotos com motivos",
  "webp": "master/png/Master-moderacao-motivos.png",
  "html": "Master-moderacao-motivos",
  "name": "MasterModeracaoMotivos",
  "master": true
 },
 {
  "id": "M26-v",
  "title": "Moderação: fotos com motivos (vazio)",
  "webp": "master/png/Master-moderacao-motivos--vazio.png",
  "html": "Master-moderacao-motivos--vazio",
  "name": "MasterModeracaoMotivosVazio",
  "master": true
 },
 {
  "id": "M26-e",
  "title": "Moderação: fotos com motivos (erro)",
  "webp": "master/png/Master-moderacao-motivos--erro.png",
  "html": "Master-moderacao-motivos--erro",
  "name": "MasterModeracaoMotivosErro",
  "master": true
 },
 {
  "id": "M26-p",
  "title": "Moderação: fotos com motivos (sem permissão)",
  "webp": "master/png/Master-moderacao-motivos--sem-permissao.png",
  "html": "Master-moderacao-motivos--sem-permissao",
  "name": "MasterModeracaoMotivosSemPermissao",
  "master": true
 },
 {
  "id": "M26-c",
  "title": "Moderação: fotos com motivos (carregando)",
  "webp": "master/png/Master-moderacao-motivos--carregando.png",
  "html": "Master-moderacao-motivos--carregando",
  "name": "MasterModeracaoMotivosCarregando",
  "master": true
 },
 {
  "id": "M26-b",
  "title": "Moderação: comentários com motivos",
  "webp": "master/png/Master-moderacao-motivos--comentarios.png",
  "html": "Master-moderacao-motivos--comentarios",
  "name": "MasterModeracaoMotivosComentarios",
  "master": true
 },
 {
  "id": "M26-f1",
  "title": "Moderação: esconder foto",
  "webp": "master/png/Master-moderacao-motivos--folha-esconder.png",
  "html": "Master-moderacao-motivos--folha-esconder",
  "name": "MasterModeracaoMotivosFolhaEsconder",
  "master": true
 },
 {
  "id": "M27",
  "title": "Storage e saúde (completa)",
  "webp": "master/png/Master-saude-completa.png",
  "html": "Master-saude-completa",
  "name": "MasterSaudeCompleta",
  "master": true
 },
 {
  "id": "M27-v",
  "title": "Storage e saúde (completa) (vazio)",
  "webp": "master/png/Master-saude-completa--vazio.png",
  "html": "Master-saude-completa--vazio",
  "name": "MasterSaudeCompletaVazio",
  "master": true
 },
 {
  "id": "M27-e",
  "title": "Storage e saúde (completa) (erro)",
  "webp": "master/png/Master-saude-completa--erro.png",
  "html": "Master-saude-completa--erro",
  "name": "MasterSaudeCompletaErro",
  "master": true
 },
 {
  "id": "M27-p",
  "title": "Storage e saúde (completa) (sem permissão)",
  "webp": "master/png/Master-saude-completa--sem-permissao.png",
  "html": "Master-saude-completa--sem-permissao",
  "name": "MasterSaudeCompletaSemPermissao",
  "master": true
 },
 {
  "id": "M27-c",
  "title": "Storage e saúde (completa) (carregando)",
  "webp": "master/png/Master-saude-completa--carregando.png",
  "html": "Master-saude-completa--carregando",
  "name": "MasterSaudeCompletaCarregando",
  "master": true
 },
 {
  "id": "M28",
  "title": "Auditoria (filtros)",
  "webp": "master/png/Master-auditoria-filtros.png",
  "html": "Master-auditoria-filtros",
  "name": "MasterAuditoriaFiltros",
  "master": true
 },
 {
  "id": "M28-v",
  "title": "Auditoria (filtros) (vazio)",
  "webp": "master/png/Master-auditoria-filtros--vazio.png",
  "html": "Master-auditoria-filtros--vazio",
  "name": "MasterAuditoriaFiltrosVazio",
  "master": true
 },
 {
  "id": "M28-e",
  "title": "Auditoria (filtros) (erro)",
  "webp": "master/png/Master-auditoria-filtros--erro.png",
  "html": "Master-auditoria-filtros--erro",
  "name": "MasterAuditoriaFiltrosErro",
  "master": true
 },
 {
  "id": "M28-p",
  "title": "Auditoria (filtros) (sem permissão)",
  "webp": "master/png/Master-auditoria-filtros--sem-permissao.png",
  "html": "Master-auditoria-filtros--sem-permissao",
  "name": "MasterAuditoriaFiltrosSemPermissao",
  "master": true
 },
 {
  "id": "M28-c",
  "title": "Auditoria (filtros) (carregando)",
  "webp": "master/png/Master-auditoria-filtros--carregando.png",
  "html": "Master-auditoria-filtros--carregando",
  "name": "MasterAuditoriaFiltrosCarregando",
  "master": true
 },
 {
  "id": "M29",
  "title": "Impressões: pedidos",
  "webp": "master/png/Master-impressoes.png",
  "html": "Master-impressoes",
  "name": "MasterImpressoes",
  "master": true
 },
 {
  "id": "M29-v",
  "title": "Impressões: pedidos (vazio)",
  "webp": "master/png/Master-impressoes--vazio.png",
  "html": "Master-impressoes--vazio",
  "name": "MasterImpressoesVazio",
  "master": true
 },
 {
  "id": "M29-e",
  "title": "Impressões: pedidos (erro)",
  "webp": "master/png/Master-impressoes--erro.png",
  "html": "Master-impressoes--erro",
  "name": "MasterImpressoesErro",
  "master": true
 },
 {
  "id": "M29-p",
  "title": "Impressões: pedidos (sem permissão)",
  "webp": "master/png/Master-impressoes--sem-permissao.png",
  "html": "Master-impressoes--sem-permissao",
  "name": "MasterImpressoesSemPermissao",
  "master": true
 },
 {
  "id": "M29-c",
  "title": "Impressões: pedidos (carregando)",
  "webp": "master/png/Master-impressoes--carregando.png",
  "html": "Master-impressoes--carregando",
  "name": "MasterImpressoesCarregando",
  "master": true
 },
 {
  "id": "M30",
  "title": "Impressão: detalhe do pedido",
  "webp": "master/png/Master-impressao-detalhe.png",
  "html": "Master-impressao-detalhe",
  "name": "MasterImpressaoDetalhe",
  "master": true
 },
 {
  "id": "M30-v",
  "title": "Impressão: detalhe do pedido (vazio)",
  "webp": "master/png/Master-impressao-detalhe--vazio.png",
  "html": "Master-impressao-detalhe--vazio",
  "name": "MasterImpressaoDetalheVazio",
  "master": true
 },
 {
  "id": "M30-e",
  "title": "Impressão: detalhe do pedido (erro)",
  "webp": "master/png/Master-impressao-detalhe--erro.png",
  "html": "Master-impressao-detalhe--erro",
  "name": "MasterImpressaoDetalheErro",
  "master": true
 },
 {
  "id": "M30-p",
  "title": "Impressão: detalhe do pedido (sem permissão)",
  "webp": "master/png/Master-impressao-detalhe--sem-permissao.png",
  "html": "Master-impressao-detalhe--sem-permissao",
  "name": "MasterImpressaoDetalheSemPermissao",
  "master": true
 },
 {
  "id": "M30-c",
  "title": "Impressão: detalhe do pedido (carregando)",
  "webp": "master/png/Master-impressao-detalhe--carregando.png",
  "html": "Master-impressao-detalhe--carregando",
  "name": "MasterImpressaoDetalheCarregando",
  "master": true
 },
 {
  "id": "M30-f1",
  "title": "Impressão: avançar status",
  "webp": "master/png/Master-impressao-detalhe--folha-avancar.png",
  "html": "Master-impressao-detalhe--folha-avancar",
  "name": "MasterImpressaoDetalheFolhaAvancar",
  "master": true
 },
 {
  "id": "M30-f2",
  "title": "Impressão: cancelar pedido",
  "webp": "master/png/Master-impressao-detalhe--folha-cancelar.png",
  "html": "Master-impressao-detalhe--folha-cancelar",
  "name": "MasterImpressaoDetalheFolhaCancelar",
  "master": true
 },
 {
  "id": "M31",
  "title": "Configurações (revisada)",
  "webp": "master/png/Master-config-revisada.png",
  "html": "Master-config-revisada",
  "name": "MasterConfigRevisada",
  "master": true
 },
 {
  "id": "M31-v",
  "title": "Configurações (revisada) (vazio)",
  "webp": "master/png/Master-config-revisada--vazio.png",
  "html": "Master-config-revisada--vazio",
  "name": "MasterConfigRevisadaVazio",
  "master": true
 },
 {
  "id": "M31-e",
  "title": "Configurações (revisada) (erro)",
  "webp": "master/png/Master-config-revisada--erro.png",
  "html": "Master-config-revisada--erro",
  "name": "MasterConfigRevisadaErro",
  "master": true
 },
 {
  "id": "M31-p",
  "title": "Configurações (revisada) (sem permissão)",
  "webp": "master/png/Master-config-revisada--sem-permissao.png",
  "html": "Master-config-revisada--sem-permissao",
  "name": "MasterConfigRevisadaSemPermissao",
  "master": true
 },
 {
  "id": "M31-c",
  "title": "Configurações (revisada) (carregando)",
  "webp": "master/png/Master-config-revisada--carregando.png",
  "html": "Master-config-revisada--carregando",
  "name": "MasterConfigRevisadaCarregando",
  "master": true
 },
 {
  "id": "M31-f1",
  "title": "Configurações: alterar valor",
  "webp": "master/png/Master-config-revisada--folha-alterar.png",
  "html": "Master-config-revisada--folha-alterar",
  "name": "MasterConfigRevisadaFolhaAlterar",
  "master": true
 },
 {
  "id": "M31-f2",
  "title": "Configurações: desligar checkout",
  "webp": "master/png/Master-config-revisada--folha-chave.png",
  "html": "Master-config-revisada--folha-chave",
  "name": "MasterConfigRevisadaFolhaChave",
  "master": true
 },
 {
  "id": "M32",
  "title": "Sem acesso (papéis)",
  "webp": "master/png/Master-sem-acesso.png",
  "html": "Master-sem-acesso",
  "name": "MasterSemAcesso",
  "master": true
 }
];
