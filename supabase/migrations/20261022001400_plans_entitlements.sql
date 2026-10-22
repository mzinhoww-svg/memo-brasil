-- MemoriesMT · COM-001 · planos, direitos por evento e backfill legado. ADITIVA.
-- effective_entitlement(evento) é a fonte única de limites (convidados e fotos por pessoa).
-- payments_env() decide quais direitos ligados a um ambiente de pagamento valem; env 'nenhum' vale sempre.
-- Escrita em plans/event_entitlements: só por RPC security definer (tasks seguintes) ou service_role.

-- ---------------------------------------------------------------- planos
create table public.plans (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,31}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  max_guests int null check (max_guests is null or max_guests between 1 and 1000),
  max_shots int null check (max_shots is null or max_shots between 1 and 1000),
  price_cents int not null check (price_cents >= 0),
  sort int not null,
  is_free boolean not null default false,
  sandbox_active boolean not null default false,
  production_active boolean not null default false,
  features jsonb not null default '[]' check (jsonb_typeof(features) = 'array'),
  updated_at timestamptz not null default now()
);
create unique index plans_single_free on public.plans (is_free) where is_free; -- um único plano grátis

alter table public.plans enable row level security;
revoke all on public.plans from public, anon, authenticated; -- leitura de cliente só via list_public_plans (Task 7)
create trigger plans_touch before insert or update on public.plans for each row execute function public.settings_touch();

-- o plano 'gratis' é o piso de effective_entitlement: não pode ser apagado nem renomeado
create function public.plans_protect_free() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.code = 'gratis' and (tg_op = 'DELETE' or new.code is distinct from old.code) then
    raise exception 'gratisprotected' using errcode = 'MM005';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger plans_protect_free before update or delete on public.plans for each row execute function public.plans_protect_free();

-- planos aprovados em 22/10/2026 (D1). O executor não altera esses valores; o dono altera pelo Master (M2).
insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, is_free, sandbox_active, production_active) values
  ('gratis',     'Grátis',     10,  10,   0,     0, true,  true, true),
  ('festa',      'Festa',      30,  24,   2900,  1, false, true, true),
  ('celebracao', 'Celebração', 100, 24,   8900,  2, false, true, true),
  ('casamento',  'Casamento',  250, 36,   18900, 3, false, true, true),
  ('grande',     'Grande',     500, null, 34900, 4, false, true, true);

-- ---------------------------------------------------------------- direitos por evento
-- max_guests/max_shots ficam no próprio direito (fotografia do plano na concessão): mudar o plano depois não altera direitos.
-- order_id ainda sem FK: a tabela de pedidos nasce na Task 4.
create table public.event_entitlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  plan_code text not null references public.plans,
  max_guests int null check (max_guests is null or max_guests >= 1),
  max_shots int null check (max_shots is null or max_shots >= 1),
  source text not null check (source in ('gratis', 'legado', 'pago', 'cortesia', 'codigo')),
  order_id uuid null,
  status text not null default 'ativo' check (status in ('ativo', 'estornado', 'revogado')),
  env text not null check (env in ('sandbox', 'production', 'nenhum')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index event_entitlements_event_idx on public.event_entitlements (event_id) where status = 'ativo';

alter table public.event_entitlements enable row level security;
revoke all on public.event_entitlements from public, anon, authenticated;
grant select on public.event_entitlements to authenticated; -- sem insert/update/delete de cliente
create policy event_entitlements_select on public.event_entitlements for select to authenticated
  using (public.is_host(event_id) or public.is_master());

-- ---------------------------------------------------------------- configurações de pagamento e contato
-- mesmo formato das demais chaves: valor jsonb. Sem auth.uid() aqui: o trigger de auditoria registra como 'operador'.
insert into public.platform_settings (key, value) values
  ('payments_env', '"desligado"'),
  ('capacity_grace_pct', '10'),
  ('support_email', 'null'),
  ('support_phone', 'null'),
  ('company_legal_name', 'null'),
  ('company_cnpj', 'null')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- ambiente e plano efetivo
-- 'desligado' | 'sandbox' | 'production'. Ausente ou valor desconhecido = 'desligado' (falha fechada).
create function public.payments_env() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.value #>> '{}' from public.platform_settings s
      where s.key = 'payments_env' and s.value #>> '{}' in ('desligado', 'sandbox', 'production')),
    'desligado')
$$;

-- Considera direitos ativos do ambiente vigente ou de env 'nenhum'. Limites: o maior valor; null (sem limite) vence.
-- plan_code/source: do direito de maior plano (plans.sort), desempate pelo mais recente.
-- Sem direito válido: o plano grátis, com source 'gratis'. Se nem o grátis existir: MM090 (nunca devolve vazio).
create function public.effective_entitlement(p_event uuid)
returns table (plan_code text, max_guests int, max_shots int, source text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with env as (select public.payments_env() as v),
  valid as (
    select ee.*, p.sort
    from public.event_entitlements ee
    join public.plans p on p.code = ee.plan_code
    where ee.event_id = p_event and ee.status = 'ativo' and ee.env in ((select v from env), 'nenhum')
  ),
  top as (select v.plan_code, v.source from valid v order by v.sort desc, v.created_at desc, v.id desc limit 1),
  agg as (
    select case when bool_or(v.max_guests is null) then null else max(v.max_guests) end as max_guests,
           case when bool_or(v.max_shots is null) then null else max(v.max_shots) end as max_shots
    from valid v
  )
  select t.plan_code, a.max_guests, a.max_shots, t.source from top t cross join agg a
  union all
  select p.code, p.max_guests, p.max_shots, 'gratis'
  from public.plans p
  where p.code = 'gratis' and not exists (select 1 from valid);
  -- sempre exatamente uma linha: zero linhas seria lido como "sem limite" (falha aberta). Falha fechada.
  if not found then raise exception 'entitlementunavailable' using errcode = 'MM090'; end if;
end $$;

-- ---------------------------------------------------------------- backfill legado
-- Um direito legado/nenhum/ativo por evento existente (não apagado), com capacity/shots_per_person atuais (null continua sem limite).
-- plan_code = 'gratis' é só referência obrigatória da FK: os limites vêm de max_* do próprio direito, e o preço de
-- referência 0 faz um upgrade de evento legado cobrar o preço cheio do plano escolhido.
-- Idempotente (não duplica legado). Só o dono roda: chamá-lo depois marcaria eventos novos como legado.
create function public.entitlements_backfill_legacy() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, status, reason)
  select e.id, 'gratis', e.capacity, e.shots_per_person, 'legado', 'nenhum', 'ativo',
         'COM-001: limites vigentes antes dos planos'
  from public.events e
  where e.deleted_at is null
    and not exists (select 1 from public.event_entitlements x where x.event_id = e.id and x.source = 'legado');
  get diagnostics n = row_count;
  return n;
end $$;

select public.entitlements_backfill_legacy();

-- ---------------------------------------------------------------- privilégios
-- payments_env/effective_entitlement: authenticated precisa executar porque events_guard (Task 3) é SECURITY INVOKER
-- e roda como o anfitrião; join_event (definer) não depende disso. Não há checagem de acesso dentro de
-- effective_entitlement: no INSERT do evento is_host() ainda é falso, e o dado (plano e limites) não é sensível —
-- event_preview já expõe a lotação a quem tem o código. anon não executa nenhuma das duas.
revoke execute on function public.payments_env(), public.effective_entitlement(uuid), public.entitlements_backfill_legacy()
  from public, anon, authenticated, service_role;
revoke execute on function public.plans_protect_free() from public, anon, authenticated, service_role;
grant execute on function public.payments_env(), public.effective_entitlement(uuid) to authenticated, service_role;
