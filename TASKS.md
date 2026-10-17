# TASKS — Memo Brasil

Atualizado em 2026-10-17. Dono = papel. "Bloqueia" = o que impede o merge/aceite. Estado vem de `STATUS.md`.

## Prontos para mergear (humano)
- [ ] #5 docs: decisões 001–004, fase 2, lojas — **aprovado** (Planejador)
- [ ] #4 identidade Lume — **aprovado**
- [ ] #6 textos de estados/painel — **aprovado com condições** (condições valem antes de publicar)

## Devolvidos / com ajustes
- [ ] **#9 autenticação** (dono: Forja-Auth) — corrigir B1–B4 obrigatórios e B5–B8; testes: vínculo por `eventoId` alheio, persistência após `save()`, auditoria de exclusão, `MASTER_TOKEN` rejeitado com conta master, produção sem e-mail/chave falha.
- [ ] **#7 persistência** (dono: Forja-Dados) — A1 `save()` sem delete+insert; A2 exclusão atômica + política de backup; A3 FKs de convidado. **Merge antes do #9.**
- [ ] **#2 textos** (dono: Redator) — B1–B6 do parecer; reler só o diff.
- [ ] **#1 testes/CI** (dono: QA/Forja-Testes) — teste da listagem pré-revelação; resolver a cobrança/Actions para o CI rodar e deixar a `main` verde.
- [ ] **#10 textos por tela** (dono: Redator) — revisar depois das correções do #2; Planejador audita antes do merge.

## Auditados em 17/10 (com condições)
- [ ] **#14 uploads** (dono: Forja) — **devolvido**: B1 rebasear no #13 e usar só hash; B2 remover `?guestToken=`; B3 cortar JPEG no EOI e respeitar tamanho do RIFF no WebP; B4 teste com JPEG real com GPS.
- [ ] **#13 convidado** — C1 unificar esquema com o #14; C2 convidados antigos; C3 `tokenHash` fora das respostas; C4 leitura sem token; C5 `intent://` sem query/hash.
- [ ] **#12 observabilidade** — filtrar `err.message` no Sentry (JSON malformado traz corpo); teste de token em caminho; retenção do hash de IP na política.
- [ ] **#9** — reauditar o head db94646 inteiro; remover `?token=` da rota de arquivo de foto.
- [ ] **#15 LGPD, #16 revelação, #17 deploy** — aguardam parecer do Planejador.

## Aceites formais pendentes (Orquestrador)
- [ ] Decisão 002 — auth do organizador (recomendada: link mágico por e-mail)
- [ ] Decisão 003 — auth do master (recomendada: senha + TOTP; scrypt aceito se o doc for atualizado)
- [ ] Decisão 004 — recados (recomendada: opção B, privados ao casal por padrão)

## Itens do checklist sem dono ativo
- [ ] Item 4 publicação HTTPS (bloqueado por plano/custo e credenciais)
- [ ] Item 6 painel: QR PNG/PDF A5, remover convidado
- [ ] Item 14 STATUS final (depois dos demais)

## Pós-MVP imediato
- [ ] Item 12 Postgres + RLS (início automático com o STATUS final; gatilhos G1–G4 em decisão 001)
- [ ] Item 12b lojas: Capacitor só convidado (docs/lojas.md)
