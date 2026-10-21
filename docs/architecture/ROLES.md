# Papéis: convidado, organizador e administrador master

| Papel | Pode | Não pode | Hoje (pré-backend) |
|---|---|---|---|
| **Convidado** | entrar no evento, postar no rolo, reagir, ver o álbum depois da revelação | configurar, moderar, excluir | identidade local; "Entrar como outra pessoa" para demonstração |
| **Organizador** | configurar, revelar, moderar e excluir **os próprios eventos**; baixar o álbum | tocar em eventos de outros; supervisionar a plataforma | dono local do evento (`hostId`); painel em `/painel/[id]` |
| **Administrador master** | supervisionar eventos, revelações e operações de toda a plataforma, com registro em `audit_logs` | nada fora das ações auditadas | **não existe**: `/master` é só um ponto de integração sem login |

## Contrato de política (`web/src/domain/roles.ts`)
`can(actor, action, event?)` é a mesma tabela que o backend aplicará (RLS + claims). Ações: `event.view`, `event.configure`, `reveal.configure`, `photo.moderate`, `event.delete`, `platform.supervise`. `MasterRepository` descreve `listEvents`, `overrideReveal` e `suspendEvent`; hoje devolve `BackendRequiredError`.

## Regras de segurança
1. **Isto não é segurança de produção.** No cliente qualquer pessoa altera o código ou o IndexedDB; a política serve para a interface e para fixar o contrato.
2. **Master nunca vem de senha fixa, parâmetro de URL ou estado do navegador.** Só de claim emitida pelo servidor de autenticação (`app_metadata.role = 'master'`), que será gravada por processo administrativo fora do app. Testes E2E provam que `?role=master`, `?admin=1&token=…` não mudam nada.
3. Toda ação de master grava `audit_logs` (quem, o quê, evento, motivo, quando) e o organizador é notificado de intervenções em seu evento.
4. Rotas do master ficam sob `/master/*`, protegidas por middleware que valida a claim no servidor (não por esconder o link).
