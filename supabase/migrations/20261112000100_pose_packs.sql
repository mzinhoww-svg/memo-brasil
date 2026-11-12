-- Revela · pacote "Mais poses" (+12 poses por pessoa) para Festa e Celebração. ADITIVA e idempotente.
--
-- Desenho: o pacote é um PLANO-VARIANTE do catálogo (plans.pack_of aponta o plano-base), com os mesmos limites de convidados do
-- base e max_shots = 36. Ele reaproveita todo o pipeline existente (cotação, pedido, webhook, direito por evento,
-- effective_entitlement = maior limite, events_guard/photos_guard). Nada de cobrança, idempotência ou webhook muda.
--   * Oculto: list_public_plans NÃO devolve variantes (pack_of is not null); o seletor de planos normal nunca as vê.
--   * Visível só por list_public_pose_packs() (authenticated), que o assistente e o painel usam para o interruptor
--     (campo `available` = à venda agora).
--   * Nasce DESLIGADO (sandbox_active/production_active = false): o dono liga em Master → Planos quando quiser.
--   * Preço do pacote = preço da variante - preço do plano-base (padrão +R$ 19,90). Quem já tem o plano-base paga só a
--     diferença (payments_quote_internal já cobra variante - preço do plano pago vigente); aqui só se acrescenta o crédito do
--     plano-base concedido por cortesia/código, que hoje valeria 0.
-- Não altera linhas de planos, pedidos nem direitos existentes. Reversão: supabase/ops/rollback_pose_packs.sql.

-- ---------------------------------------------------------------- coluna
alter table public.plans add column if not exists pack_of text null references public.plans (code);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_pack_not_self' and conrelid = 'public.plans'::regclass) then
    alter table public.plans add constraint plans_pack_not_self check (pack_of is null or pack_of <> code);
  end if;
end $$;

-- ---------------------------------------------------------------- variantes (derivadas do plano-base vigente; desligadas)
-- Convidados e features copiados do plano-base; se o base não existir, não cria nada. Preço = base + R$ 19,90.
insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, is_free, sandbox_active, production_active, features, pack_of)
select b.code || '_36', b.name || ' + Mais poses', b.max_guests, 36, b.price_cents + 1990, b.sort, false, false, false, b.features, b.code
from public.plans b
where b.code in ('festa', 'celebracao') and not b.is_free
on conflict (code) do nothing;

-- ---------------------------------------------------------------- catálogo público: variantes ficam ocultas
create or replace function public.list_public_plans() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'features', p.features, 'highlighted', p.highlighted) order by p.sort, p.code), '[]')
  from public.plans p
  where p.pack_of is null
    and (p.is_free
     or (public.payments_env() = 'sandbox' and p.sandbox_active)
     or (public.payments_env() = 'production' and p.production_active))
$$;

-- Pacotes "Mais poses" conhecidos, com `available` = à venda no ambiente de pagamento vigente (variante E plano-base ativos).
-- Devolve também os desligados (available = false) para o painel reconhecer o plano atual de quem JÁ comprou o pacote
-- (effective_entitlement devolve o código da variante, que não está em list_public_plans). Só logado: o assistente só roda
-- com sessão e o painel é do anfitrião; anon nunca recebe nada. extraCents = quanto o pacote custa sobre o base.
create or replace function public.list_public_pose_packs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', k.code, 'baseCode', b.code, 'name', k.name, 'maxGuests', k.max_guests, 'maxShots', k.max_shots,
      'baseMaxShots', b.max_shots, 'priceCents', k.price_cents, 'extraCents', k.price_cents - b.price_cents,
      'available', ((public.payments_env() = 'sandbox' and k.sandbox_active and b.sandbox_active)
                 or (public.payments_env() = 'production' and k.production_active and b.production_active)))
      order by b.sort, k.code), '[]')
  from public.plans k
  join public.plans b on b.code = k.pack_of
  where auth.uid() is not null
    and k.pack_of is not null and b.pack_of is null and not b.is_free
    and k.max_shots is not null and b.max_shots is not null and k.max_shots > b.max_shots
    and k.price_cents > b.price_cents
$$;

-- ---------------------------------------------------------------- Master: a lista traz packOf (edição de preços das variantes)
create or replace function public.admin_list_plans() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'highlighted', p.highlighted, 'features', p.features, 'updatedAt', p.updated_at, 'packOf', p.pack_of,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'action', a.action, 'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action in ('plan.updated', 'plan.price_changed')
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $$;

-- ---------------------------------------------------------------- cotação: crédito do plano-base dado por cortesia/código
-- Idêntica à anterior, mais um ramo: pacote sobre plano-base já coberto por cortesia/código desconta o preço do plano-base
-- (antes, qualquer fonte que não fosse 'pago' valia 0). Legado continua pagando o preço cheio (Ruling 6).
create or replace function public.payments_quote_internal(p_event uuid, p_plan text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ev public.events;
  pl public.plans;
  eff record;
  env text := public.payments_env();
  from_price int := 0;
  amount int;
  reason text := 'ok';
begin
  select * into ev from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into pl from public.plans where code = p_plan;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into eff from public.effective_entitlement(p_event);
  if eff.source = 'pago' then
    select p.price_cents into from_price from public.plans p where p.code = eff.plan_code;
  elsif pl.pack_of is not null and eff.source in ('cortesia', 'codigo') and public.payments_plan_covered(p_event, pl.pack_of) then
    select p.price_cents into from_price from public.plans p where p.code = pl.pack_of;
  end if;
  amount := greatest(pl.price_cents - coalesce(from_price, 0), 0);
  if now() >= public.event_end(ev.start_at, ev.duration_hours, ev.ended_at) then
    reason := 'evento_encerrado';
  elsif env = 'desligado' or (env = 'sandbox' and not pl.sandbox_active) or (env = 'production' and not pl.production_active) then
    reason := 'plano_inativo';
  elsif pl.is_free or public.payments_plan_covered(p_event, p_plan) or amount = 0 then
    reason := 'ja_incluido';
  elsif amount < 100 then
    reason := 'valor_minimo';
  end if;
  return jsonb_build_object('planCode', pl.code, 'fromPlanCode', eff.plan_code, 'amountCents', amount,
                            'payable', reason = 'ok', 'reason', reason);
end $$;

-- ---------------------------------------------------------------- privilégios (mesmo padrão de list_public_plans / admin_list_plans)
revoke all on function public.list_public_pose_packs() from public, anon;
grant execute on function public.list_public_pose_packs() to authenticated, service_role;
