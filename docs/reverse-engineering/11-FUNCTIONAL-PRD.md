# 11 — PRD funcional (web/PWA)

## Visão
Reproduzir a **experiência e o comportamento** do Memo (câmera colaborativa de eventos com revelação programada) como PWA em Next.js/React/TypeScript/Tailwind, **com marca, textos de identidade e ativos próprios** (o original é protegido).

## Personas
- **Anfitrião:** cria o evento, convida, administra, recebe o álbum.
- **Convidado:** entra por link/código/QR, tira fotos, vê o álbum após a revelação.

## Princípios
1. Só o que tem evidência (`02`). Itens "sem evidência" ficam fora.
2. Mobile-first retrato; desktop = coluna centralizada.
3. Backend atrás de interfaces (`09`); fase 1 local (IndexedDB), fase 2 Supabase.
4. Tema escuro e tipografia serif editorial (ver `06`), identidade visual própria.

## Escopo MVP (P0)
Onboarding mínimo + login (local/Google), nome; Home (hero, álbuns); criar evento (wizard 9 passos exceto pagamento real); entrar por código/link; câmera com rolo e estilos; sincronização offline-first; galeria com revelação; convite (link/QR/share); regras de tempo e capacidade.
## Pós-MVP (P1–P3)
Reações; visualizador; exportar/baixar; configurações do evento; notificações (push); perfil/excluir conta; paywall/billing; editor (desenho/texto/colagem); Scrapbook (adiado — placeholder no original).

## Requisitos funcionais (resumo; detalhe em `02` e `13`)
- RF-01 Criar evento com título, categoria, término (≥30 min futuro), revelação (3 modos), estilo, capa, capacidade (5…ilimitado), fotos/pessoa (5,10,16,24,36,∞), visibilidade, reações.
- RF-02 Código de 8 caracteres do alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ`; link `/<code>`.
- RF-03 Entrada: resolver código, nome do convidado, erros (inexistente/encerrado/lotado).
- RF-04 Câmera: captura, inverter, zoom (quando suportado), contador do rolo, bloqueio ao zerar.
- RF-05 Fotos sincronizam em segundo plano; recusa por limite remove a foto local.
- RF-06 Revelação: DURING / AFTER / AFTER+N dias; fotos não reveladas ocultas.
- RF-07 Reações 🔥❤️😂😮 (1 por usuário/foto), "Quem reagiu".
- RF-08 Exportar: baixar fotos (ZIP/individual/share).
- RF-09 Host: editar nome/capa/término/etc.; excluir evento; **não reabrir encerrado com fotos**.
- RF-10 Preço: ≤10 convidados grátis; acima exige compra/assinatura (fase 1: simulado).
- RF-11 Notificações: 1 dia/1 h/10 min antes do fim, fim, revelação.
- RF-12 Conta: nome, sair, excluir.

## Requisitos não funcionais
Instalável (PWA), offline para fotos já capturadas, LGPD (consentimento de câmera, exclusão de dados), acessibilidade WCAG AA (contraste do tema verificado a implementar), desempenho: LCP < 2,5 s em 4G, imagens otimizadas, privacidade (fotos só aos participantes).

## Fora de escopo / não confirmado
E-mail+senha (inativo no original), Scrapbook, vídeo, comentários, chat, flash.

## Métricas de sucesso (propostas)
Eventos criados, taxa de entrada por link, fotos por convidado, % de álbuns revelados abertos.
