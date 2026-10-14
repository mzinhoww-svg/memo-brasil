# Textos do Memo Brasil (pt-BR)

Rascunho v0.1 · 13/10/2026 · Redator. Tom acolhedor de casamento. Nada copiado do app Memo – Capture momentos.

| Arquivo | Para quê |
|---|---|
| `politica-privacidade.md` | Política de Privacidade (LGPD) |
| `termos-de-uso.md` | Termos de Uso, incluindo aviso de acesso da plataforma ao conteúdo |
| `consentimento-convidado.md` | Aviso e aceite do convidado ("suas fotos serão vistas por todos os convidados") |
| `convite-e-ui.md` | Textos de interface de todas as telas atuais, convite e mensagem para repassar |
| `emails.md` | E-mails: link mágico, revelação aberta, fim do prazo, exclusão, pedido do titular |

Convenções: ⚖️ = revisão humana jurídica antes de publicar · 🔧 = depende de funcionalidade ainda inexistente · `[colchetes]` / `{chaves}` = dado ou variável a preencher.

## Revisão jurídica (humana) — resumo

| Id | Tema | Onde |
|---|---|---|
| PP-1 | Controlador × operador | Política §1 |
| PP-2 | Nome e canal do encarregado (DPO) | Política §1 |
| PP-3 | Bases legais por finalidade; consentimento e legítimo interesse | Política §3 |
| PP-4 | Guarda de registros de acesso (Marco Civil, art. 15); IP em claro ou hash | Política §3.3 |
| PP-5 | Dados de convidados inseridos pelo organizador | Política §3.4 |
| PP-6 | Acesso da plataforma ao conteúdo; notificar organizador? | Política §5 |
| PP-7 | Crianças e adolescentes (LGPD art. 14); idade mínima; consentimento dos pais | Política §6 |
| PP-8 | Transferência internacional (provedores) | Política §7 |
| PP-9 | Prazos de retenção (12 meses, registros, backups) | Política §8 |
| PP-10 | Pedido de remoção de foto de terceiro | Política §9 |
| PP-11 | Incidente de segurança e comunicação à ANPD | Política §10 |
| PP-12 | Cookies e armazenamento local | Política §11 |
| TU-1 a TU-8 | Natureza do serviço, idade, responsabilidade do organizador, licença e direito de imagem, disponibilidade, acesso administrativo, moderação, limitação de responsabilidade | Termos |
| CG-1 a CG-5 | Menores, push, visibilidade dos recados, prova e retirada do consentimento, alternativa ao aceite | Consentimento |
| EM-1 a EM-4 | Rodapé, prazo estendido, o que permanece após exclusão, prazo do titular | E-mails |

## O que o produto precisa ter antes de publicar os textos (🔧)

Os textos descrevem o comportamento **desejado** (checklist do MVP). Hoje o README informa: sem e-mail, retenção só registrada, sem login real. Não publicar uma frase cuja funcionalidade não exista:

1. Job de **retenção** que apaga eventos 12 meses depois da revelação (hoje só `retencaoDiasAposRevelacao: 365` registrado).
2. **Exportar e apagar** todos os dados de um evento em um comando.
3. **Aceite registrado** do convidado antes de entrar (caixa de seleção + versão do texto).
4. **Link mágico** por e-mail e envio de e-mail (revelação, fim do prazo, exclusão).
5. **Ocultar** e **denunciar** foto; remoção por responsável de menor.
6. **Remoção de EXIF/GPS** nas fotos enviadas.
7. **Auditoria** de todo acesso do master ao conteúdo, com motivo.
8. Decidir **visibilidade dos recados** (hoje todos os convidados leem, com nome).
9. Definir **nome e domínio** definitivos para trocar `{marca}`.

## Dados a preencher

Razão social, CNPJ, endereço, e-mail do suporte, nome e e-mail do encarregado, foro, lista de provedores (hospedagem, e-mail, monitoramento, anti-robô) com país, prazos finais (registros, backups, resposta ao titular).
