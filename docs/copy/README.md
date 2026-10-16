# Textos do Lume (pt-BR)

Rascunho v0.2 · 16/10/2026 · Redator. Tom acolhedor de casamento. Produto: **Lume**. Nada copiado do app Memo – Capture momentos.

| Arquivo | Para quê |
|---|---|
| `politica-privacidade.md` | Política de Privacidade (LGPD) |
| `termos-de-uso.md` | Termos de Uso, incluindo aviso de acesso da plataforma ao conteúdo |
| `consentimento-convidado.md` | Aviso e aceite do convidado ("suas fotos serão vistas por todos os convidados") |
| `convite-e-ui.md` | Textos de interface de todas as telas atuais, convite e mensagem para repassar |
| `emails.md` | E-mails: link mágico, revelação aberta, fim do prazo, exclusão, pedido do titular |
| `features.json` | Chaves de funcionalidade: o que cada 🔧 precisa para valer |

Convenções: ⚖️ = revisão humana jurídica antes de publicar · 🔧 `feature.<chave>` = depende de funcionalidade que **ainda não existe**; a chave vive em `features.json` com `"ativo": false` · `[colchetes]` / `{chaves}` = dado ou variável a preencher · `{retencao_meses}` e `{teto_meses}` vêm das variáveis da plataforma e **nunca** são escritos como número no texto.

## Regra de publicação (mecânica)

`node scripts/check-copy-features.js` confere os textos contra `features.json`:

- toda `feature.<chave>` citada precisa existir e a linha precisa ter 🔧;
- `--publicar` **falha** enquanto houver texto cuja chave esteja desligada (não se publica promessa sem recurso);
- falha também se aparecer prazo fixo (número de meses escrito no texto), o nome antigo da marca ou `{marca}`.

Ao entregar um recurso, ligar a chave (`"ativo": true`) no mesmo PR do recurso. Teste: `node --test test/copy-features.test.js`. Falta ligar o `--publicar` ao CI (cabe a quem cuida do CI; não alterei `package.json`).

## O que cada 🔧 precisa (estado em 16/10/2026)

| Chave | Hoje | Textos que dependem |
|---|---|---|
| `feature.aceite_registrado` | não existe (três caixas: ciência, consentimento, idade; registro com versão e variante) | Consentimento §1, §2, §6; Política 3.2, 6; Termos 3 |
| `feature.recados_privados` | rota `/recados` aberta; decisão 004 (PR #5) | Consentimento 5.2; UI A7 e Configurações |
| `feature.apagar_proprio` | só a organização apaga | Política 9; Consentimento 3, 5.2, CG-4; UI A4, A7 |
| `feature.nome_travado` | o casal liga e desliga o nome livremente | Política 4.1; Termos 5; Consentimento 4.1; UI Configurações |
| `feature.exif` | EXIF/GPS não é removido; sem recompressão | Política 4; Consentimento 3; Termos 7 |
| `feature.mfa_master` | token estático (auth no PR #9, fora da `main`) | Política 5, 10; Termos 9 |
| `feature.auditoria_motivo` | auditoria sem motivo; leitura de fotos não é registrada | Política 5; Consentimento 3; Termos 9; UI Master |
| `feature.painel_acessos_admin` | não existe | Política 5; UI Configurações |
| `feature.validacao_arquivo` | confia no `mimetype` do cliente | Política 10 |
| `feature.https` | não publicado | Política 10 |
| `feature.logs_sem_pii` | sem política de logs; IP em claro | Política 3.3, 10 |
| `feature.retencao` | só registrado; job não existe; sem teto para evento nunca revelado | Política resumo e 8; Termos resumo e 8; Consentimento 3; E-mails 2, 3; UI A8 e Fotos |
| `feature.excluir_evento` | só o master exclui | Política 9; Termos 11; E-mail 4; UI Configurações |
| `feature.exportar_tudo` | só ZIP e CSV separados | Política 9; Termos 11; UI Configurações |
| `feature.backup_rotina` | sem rotina | Política 8; E-mail 4 |
| `feature.login_email` | sem login nem e-mail (decisão 002) | Política 3.1; Termos 4; E-mail 1; UI B1 e Acesso restrito |
| `feature.email` | sem envio de e-mail | Todos os e-mails; Política 7, 8 |
| `feature.fluxo_titular` | sem fluxo, protocolo ou prazo | Política 9; E-mail 5 |
| `feature.denuncia` | não existe | Política 9; Termos 10; Consentimento CG-4; UI A4 |
| `feature.ocultar` | não existe | Consentimento CG-4 |

🔧 sem chave, em `convite-e-ui.md`, é elemento de interface novo sem promessa de privacidade (ex.: botão "Revelar agora"); o Designer e a Forja combinam a entrega.

## Revisão jurídica (humana) — resumo

| Id | Tema | Onde |
|---|---|---|
| PP-1 | Plataforma **controladora** dos dados do convidado e do organizador; casal **co-controlador do álbum**; casal controlador da lista | Política §1 |
| PP-2 | Nome e canal do encarregado (DPO) | Política §1 |
| PP-3 | Bases legais por finalidade | Política §3 |
| PP-4 | Guarda de registros de acesso (Marco Civil, art. 15); IP em claro ou hash | Política §3.3 |
| PP-5 | Dados de convidados inseridos pelo organizador | Política §3.4 |
| PP-6 | Acesso da plataforma ao conteúdo; lista de acessos no painel | Política §5 |
| PP-7 | Crianças e adolescentes (art. 14): melhor interesse, retirada pelo responsável, declaração "18 anos ou com responsável" | Política §6 |
| PP-8 | Transferência internacional (provedores) | Política §7 |
| PP-9 | Prazos: retenção após revelação, teto para evento nunca revelado, registros, backups | Política §8 |
| PP-10 | Oposição e retirada de foto por quem aparece nela | Política §9 |
| PP-11 | Incidente de segurança e comunicação à ANPD | Política §10 |
| PP-12 | Cookies e armazenamento local; captcha da decisão 003 | Política §11 |
| PP-13 | **Novo.** Teste de balanceamento do legítimo interesse para quem aparece nas fotos | Política §3.2 |
| TU-1 a TU-8 | Natureza do serviço, idade, responsabilidade do organizador, licença e direito de imagem, disponibilidade, acesso administrativo, moderação, limitação de responsabilidade | Termos |
| CG-1 a CG-5 | Menores, push, visibilidade dos recados (resolvida pela decisão 004), prova e retirada do consentimento, alternativa ao aceite | Consentimento |
| EM-1 a EM-4 | Rodapé, prazo (sem prorrogação), o que permanece após exclusão, prazo do titular | E-mails |

## Histórico

- **v0.2 (16/10/2026), devolução do Planejador (bloqueios B1 a B6):**
  - B1 papéis: plataforma controladora, casal co-controlador do álbum (Política §1, 3.2, 3.4);
  - B2 quem aparece nas fotos: linha própria com legítimo interesse, oposição e retirada; menores pelo art. 14; aceite em três caixas (ciência, consentimento, idade), sem coletar data de nascimento;
  - B3 promessas sem recurso: cada trecho recebeu 🔧 e uma chave de `features.json`; verificador criado;
  - B4 retenção: `{retencao_meses}` em vez de número fixo, teto para evento nunca revelado, sem promessa de prorrogar, cópia baixada fica fora do prazo;
  - B5 nome do autor: o casal só pode ocultar, nunca passar a exibir; o aceite grava a variante;
  - B6 recados: "Seu recado é só para os noivos" como padrão (decisão 004), mural opt-in.
  - Também: nome Lume em todos os textos; recomendações PP-6 (acessos no painel), CG-4 (autoapagar), PP-12 (captcha) e aviso ao remover convidado da lista.
- v0.1 (13/10/2026): primeira versão.

## Dados a preencher

Razão social, CNPJ, endereço, e-mail do suporte, nome e e-mail do encarregado, foro, lista de provedores (hospedagem, e-mail, monitoramento, anti-robô) com país, prazos finais (`{retencao_meses}`, `{teto_meses}`, registros, backups, resposta ao titular), domínio.
