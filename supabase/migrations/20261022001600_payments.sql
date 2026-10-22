-- MemoriesMT · COM-002 (RV-M-09) · pedidos Pix, eventos do provedor, idempotência e máquina de estados. ADITIVA.
--
-- Novos códigos de erro de domínio:
--   MM013 pedidoaberto           já existe Pix aberto (criado|pendente e não vencido) de OUTRO plano no evento
--   MM014 pagamentoindisponivel  payments_env() = 'desligado' ou plano inativo no ambiente vigente
-- Reusados: MM002 eventended (evento encerrado) · MM004 forbidden · MM005 invalid (plano/chave/fonte/cobrança inválidos,
-- plano já incluído).
--
-- Quem escreve: só as RPCs SECURITY DEFINER abaixo (rodam como o dono, o que também as torna "privilegiadas" em
-- events_guard para subir/baixar capacity e shots_per_person). Cliente só lê os próprios pedidos (RLS).

-- ---------------------------------------------------------------- estados
create type public.payment_status as enum
  ('criado', 'pendente', 'pago', 'expirado', 'cancelado', 'falhou', 'estornado', 'em_disputa', 'perdido');

-- ---------------------------------------------------------------- pedidos
-- event_id null = evento purgado (retention apaga o evento de verdade após 30 dias). O pedido é registro financeiro
-- (cobrança, needs_refund, estorno) e sobrevive à purga; payments_apply_status continua aplicando status nele.
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid null references public.events on delete set null,
  host_id uuid not null,
  plan_code text not null references public.plans,
  from_plan_code text null,
  amount_cents int not null check (amount_cents >= 100),
  currency text not null default 'BRL',
  status public.payment_status not null default 'criado',
  provider text not null default 'abacatepay',
  provider_env text not null check (provider_env in ('sandbox', 'production')),
  provider_charge_id text unique,
  idempotency_key uuid not null,
  brcode text,
  brcode_base64 text,
  expires_at timestamptz,
  paid_at timestamptz,
  last_checked_at timestamptz,
  refund_requested_at timestamptz,
  refund_reason text check (refund_reason is null or char_length(refund_reason) <= 500),
  needs_refund boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create unique index payment_orders_idem on public.payment_orders (host_id, idempotency_key);
create unique index payment_orders_one_open on public.payment_orders (event_id) where status in ('criado', 'pendente');
create index payment_orders_host_idx on public.payment_orders (host_id, created_at desc);
create index payment_orders_status_idx on public.payment_orders (status, updated_at desc);

create function public.payment_orders_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end $$;
create trigger payment_orders_touch before update on public.payment_orders for each row execute function public.payment_orders_touch();

alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from public, anon, authenticated;
grant select on public.payment_orders to authenticated; -- sem escrita de cliente
create policy payment_orders_select on public.payment_orders for select to authenticated
  using (host_id = auth.uid() or public.is_master());

-- ---------------------------------------------------------------- eventos do provedor e resultados de aplicação
-- provider_event_id null = linha gerada por payments_apply_status (resultado de uma aplicação), sem deduplicação.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null default 'abacatepay',
  provider_event_id text,
  event_type text,
  order_id uuid null references public.payment_orders on delete set null,
  received_at timestamptz not null default now(),
  outcome text,
  detail jsonb,
  unique (provider, provider_event_id)
);
create index payment_events_order_idx on public.payment_events (order_id, id);
create index payment_events_outcome_idx on public.payment_events (outcome, received_at desc);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from public, anon, authenticated; -- leitura do Master vem na Task 7

-- ---------------------------------------------------------------- direitos ← pedidos
alter table public.event_entitlements
  add constraint event_entitlements_order_fk foreign key (order_id) references public.payment_orders on delete set null;
create unique index event_entitlements_order_idx on public.event_entitlements (order_id) where order_id is not null;

-- ---------------------------------------------------------------- auxiliares (sem grant a clientes)
-- Allowlist: em qualquer profundidade, só ficam chaves operacionais (ids, status, valores, ambiente, datas, tipo do
-- evento) e os contêineres que as carregam. Qualquer outra chave (customer, payerName, email, taxId...) é descartada.
create function public.payments_scrub(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; r jsonb;
begin
  if p is null then return null; end if;
  if jsonb_typeof(p) = 'object' then
    r := '{}';
    for k, v in select * from jsonb_each(p) loop
      if k not in ('id', 'status', 'amount', 'paidAmount', 'platformFee', 'fee', 'devMode', 'dev_mode', 'event', 'type', 'kind',
                   'method', 'currency', 'createdAt', 'updatedAt', 'paidAt', 'expiresAt', 'created_at', 'updated_at', 'paid_at',
                   'expires_at', 'data', 'transparent', 'pixQrCode', 'payment', 'billing', 'outcome', 'source', 'from', 'to') then
        continue;
      end if;
      r := r || jsonb_build_object(k, public.payments_scrub(v));
    end loop;
    return r;
  elsif jsonb_typeof(p) = 'array' then
    select coalesce(jsonb_agg(public.payments_scrub(x)), '[]') into r from jsonb_array_elements(p) x;
    return r;
  end if;
  return p;
end $$;

-- O plano p_plan já está coberto pelos limites efetivos (null = sem limite cobre tudo)?
create function public.payments_plan_covered(p_event uuid, p_plan text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (e.max_guests is null or (p.max_guests is not null and e.max_guests >= p.max_guests))
     and (e.max_shots is null or (p.max_shots is not null and e.max_shots >= p.max_shots))
  from public.effective_entitlement(p_event) e cross join public.plans p
  where p.code = p_plan
$$;

-- Cotação sem checagem de acesso (as RPCs públicas checam antes). Preço de referência do plano atual: o preço de
-- CATÁLOGO vigente (plans.price_cents) do plano pago efetivo — literal da spec, não o valor pago no pedido original
-- (decisão do controlador); grátis/legado/cortesia/código valem 0 (Ruling 6: upgrade de legado paga o preço cheio).
-- reason: evento_encerrado | plano_inativo | ja_incluido | valor_minimo (diferença > 0 e < 100 centavos, não cobrável
-- pelo Pix; extensão do enum do contrato 3.2) | ok.
create function public.payments_quote_internal(p_event uuid, p_plan text) returns jsonb
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

-- Reaplica os limites do plano efetivo ao evento após estorno/perda: nunca acima do plano, nunca abaixo dos participantes,
-- nunca acima do que o anfitrião já tinha escolhido. Sem limite no plano efetivo: mantém o valor atual.
create function public.payments_reapply_limits(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare eff record; n int;
begin
  select * into eff from public.effective_entitlement(p_event);
  select count(*) into n from public.participants where event_id = p_event;
  update public.events e set
    capacity = case when eff.max_guests is null then e.capacity
                    else least(greatest(least(coalesce(e.capacity, eff.max_guests), eff.max_guests), n, 1), 1000) end,
    shots_per_person = case when eff.max_shots is null then e.shots_per_person
                            else least(coalesce(e.shots_per_person, eff.max_shots), eff.max_shots) end
  where e.id = p_event;
end $$;

-- ---------------------------------------------------------------- RPCs do organizador
create function public.payments_quote(p_event uuid, p_plan text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if public.payments_env() = 'desligado' then raise exception 'pagamentoindisponivel' using errcode = 'MM014'; end if;
  return public.payments_quote_internal(p_event, p_plan);
end $$;

create function public.payments_order_json(o public.payment_orders, p_reused boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('orderId', o.id, 'status', o.status, 'amountCents', o.amount_cents, 'brCode', o.brcode,
                            'brCodeBase64', o.brcode_base64, 'expiresAt', o.expires_at, 'reused', p_reused)
$$;

-- Aberto = criado|pendente e não vencido. Vencido por tempo (expires_at passou, ou criado sem cobrança há mais de
-- 30 min) vira 'expirado' aqui, liberando o índice de pedido único aberto; pagamento tardio continua aceito (expirado → pago).
create function public.payments_open_order(p_event uuid, p_plan text, p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ev public.events;
  o public.payment_orders;
  q jsonb;
  env text;
  stale text;
begin
  if uid is null or p_idempotency_key is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into ev from public.events where id = p_event and deleted_at is null for update; -- serializa pedidos do evento
  if not found or ev.host_id <> uid then raise exception 'forbidden' using errcode = 'MM004'; end if;
  env := public.payments_env();
  if env = 'desligado' then raise exception 'pagamentoindisponivel' using errcode = 'MM014'; end if;

  -- idempotência: a mesma chave devolve o mesmo pedido (em qualquer estado), só para o mesmo evento e plano
  select * into o from public.payment_orders where host_id = uid and idempotency_key = p_idempotency_key;
  if found then
    -- event_id null (evento purgado) também recusa
    if o.event_id is distinct from p_event or o.plan_code <> p_plan then raise exception 'invalid' using errcode = 'MM005'; end if;
    return public.payments_order_json(o, true);
  end if;

  -- vencidos por tempo deixam de estar abertos (expirado); aberto de outro ambiente de pagamento não é reusado (cancelado)
  for o in select * from public.payment_orders
           where event_id = p_event and status in ('criado', 'pendente')
             and (provider_env <> env or expires_at <= now()
                  or (expires_at is null and provider_charge_id is null and created_at < now() - interval '30 minutes'))
           for update loop
    stale := case when o.provider_env <> env then 'cancelado' else 'expirado' end;
    update public.payment_orders set status = stale::public.payment_status where id = o.id;
    perform public.audit(p_event, 'payment.' || stale,
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env, 'source', 'open_order'));
  end loop;

  select * into o from public.payment_orders where event_id = p_event and status in ('criado', 'pendente') for update;
  if found then
    if o.plan_code <> p_plan then raise exception 'pedidoaberto' using errcode = 'MM013'; end if;
    return public.payments_order_json(o, true);
  end if;

  q := public.payments_quote_internal(p_event, p_plan);
  case q ->> 'reason'
    when 'ok' then null;
    when 'evento_encerrado' then raise exception 'eventended' using errcode = 'MM002';
    when 'plano_inativo' then raise exception 'pagamentoindisponivel' using errcode = 'MM014';
    else raise exception 'invalid' using errcode = 'MM005'; -- ja_incluido
  end case;

  begin
    insert into public.payment_orders (event_id, host_id, plan_code, from_plan_code, amount_cents, provider_env, idempotency_key)
    values (p_event, uid, p_plan, q ->> 'fromPlanCode', (q ->> 'amountCents')::int, env, p_idempotency_key)
    returning * into o;
  exception when unique_violation then
    raise exception 'invalid' using errcode = 'MM005'; -- corrida na chave de idempotência (mesma chave em outro evento)
  end;
  perform public.audit(p_event, 'payment.criado',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env));
  return public.payments_order_json(o, false);
end $$;

create function public.payments_order_status(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id = p_order;
  if auth.uid() is null or not found or o.host_id <> auth.uid() or not public.is_host(o.event_id) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  return jsonb_build_object('orderId', o.id, 'status', o.status, 'planCode', o.plan_code, 'amountCents', o.amount_cents,
                            'brCode', o.brcode, 'brCodeBase64', o.brcode_base64, 'expiresAt', o.expires_at, 'paidAt', o.paid_at);
end $$;

-- ---------------------------------------------------------------- RPCs de serviço
-- dev_mode do provedor precisa bater com o ambiente do pedido: true ⇔ sandbox.
create function public.payments_attach_charge(p_order uuid, p_charge_id text, p_brcode text, p_brcode_base64 text,
                                              p_expires_at timestamptz, p_dev_mode boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.payment_orders;
begin
  if coalesce(btrim(p_charge_id), '') = '' or p_dev_mode is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into o from public.payment_orders where id = p_order for update;
  if not found or p_dev_mode <> (o.provider_env = 'sandbox') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.provider_charge_id is not null then
    if o.provider_charge_id <> p_charge_id then raise exception 'invalid' using errcode = 'MM005'; end if;
    return; -- reenvio da mesma cobrança: idempotente
  end if;
  if o.status <> 'criado' then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.payment_orders
     set provider_charge_id = p_charge_id, brcode = p_brcode, brcode_base64 = p_brcode_base64, expires_at = p_expires_at,
         status = 'pendente', last_checked_at = now()
   where id = p_order;
  perform public.audit(o.event_id, 'payment.pendente',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env));
end $$;

-- Aplica o estado reconsultado no provedor. Toda chamada grava uma linha em payment_events com o resultado:
-- aplicado | duplicado | transicao_ignorada | pago_ignorado_reembolsar | divergencia_valor | divergencia_ambiente |
-- divergencia_cobranca; e, no estorno/perda de um plano base, upgrade_base_estornado no pedido de upgrade apoiado nele.
-- Dinheiro recebido sem direito concedido sempre marca needs_refund: plano já coberto, evento excluído/encerrado/purgado,
-- ou PAID reconsultado num pedido já cancelado/estornado/perdido.
create function public.payments_apply_status(p_order uuid, p_charge_id text, p_status public.payment_status, p_amount_cents int,
                                             p_dev_mode boolean, p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.payment_orders;
  ev public.events;
  pl public.plans;
  u public.payment_orders;
  outcome text;
  ent_id uuid;
  refund boolean := false;
  allowed boolean;
  event_live boolean := false;
begin
  if p_source is null or p_source not in ('webhook', 'status', 'reconcile') or p_status is null then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  -- mesma ordem de travas de payments_open_order (evento → pedido): evita deadlock e serializa direitos do evento.
  -- Pedido de evento purgado (event_id null): sem trava de evento e sem direito, mas o status continua sendo aplicado.
  select * into ev from public.events e where e.id = (select x.event_id from public.payment_orders x where x.id = p_order) for update;
  select * into o from public.payment_orders where id = p_order for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.event_id is not null and ev.id = o.event_id then
    event_live := ev.deleted_at is null and now() < public.event_end(ev.start_at, ev.duration_hours, ev.ended_at);
  end if;

  allowed := (o.status, p_status) in (
    ('criado', 'pendente'), ('criado', 'falhou'),
    ('pendente', 'pago'), ('pendente', 'expirado'), ('pendente', 'cancelado'), ('pendente', 'falhou'),
    ('expirado', 'pago'), ('falhou', 'pago'),
    ('pago', 'estornado'), ('pago', 'em_disputa'),
    ('em_disputa', 'pago'), ('em_disputa', 'perdido'), ('em_disputa', 'estornado'))
    -- Ruling 16: Pix recebido em pedido cancelado (needs_refund) é reembolsado pelo Master; o estorno fecha o pedido.
    -- Sem needs_refund não houve dinheiro: continua ignorado. Não há direito a revogar (pedido cancelado não concede).
    or (o.status = 'cancelado' and p_status = 'estornado' and o.needs_refund);

  if o.provider_charge_id is null or p_charge_id is distinct from o.provider_charge_id then
    outcome := 'divergencia_cobranca';
  elsif p_dev_mode is null or p_dev_mode <> (o.provider_env = 'sandbox') then
    outcome := 'divergencia_ambiente';
  elsif (p_status = 'pago' and p_amount_cents is distinct from o.amount_cents)
     or (p_amount_cents is not null and p_amount_cents <> o.amount_cents) then
    outcome := 'divergencia_valor';
  elsif o.status = p_status then
    outcome := 'duplicado';
  elsif p_status = 'pago' and o.status in ('cancelado', 'estornado', 'perdido') then
    outcome := 'pago_ignorado_reembolsar'; -- transição não aplicada, mas o dinheiro entrou
    refund := true;
  elsif not allowed then
    outcome := 'transicao_ignorada';
  else
    outcome := 'aplicado';
  end if;

  update public.payment_orders set last_checked_at = now(), needs_refund = needs_refund or refund where id = o.id;
  if outcome = 'pago_ignorado_reembolsar' then
    perform public.audit(o.event_id, 'payment.pago_ignorado_reembolsar',
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source, 'needsRefund', true));
  end if;

  if outcome = 'aplicado' then
    select * into pl from public.plans where code = o.plan_code;
    if p_status = 'pago' then
      select id into ent_id from public.event_entitlements where order_id = o.id;
      if ent_id is null then
        if not event_live or public.payments_plan_covered(o.event_id, o.plan_code) then
          -- evento excluído/encerrado/purgado, ou já tem o plano (pagamento tardio, cortesia no meio): sem direito novo
          refund := true;
        else
          insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, order_id, env, created_by, reason)
          values (o.event_id, o.plan_code, pl.max_guests, pl.max_shots, 'pago', o.id, o.provider_env, o.host_id, 'pedido ' || o.id)
          returning id into ent_id;
          if o.provider_env = public.payments_env() then -- direito de outro ambiente não vale agora: não mexe no evento
            update public.events e set
              capacity = case when e.capacity is null or pl.max_guests is null then null else greatest(e.capacity, pl.max_guests) end,
              shots_per_person = case when e.shots_per_person is null or pl.max_shots is null then null
                                      else greatest(e.shots_per_person, pl.max_shots) end
            where e.id = o.event_id;
          end if;
        end if;
      end if;
      update public.payment_orders set status = 'pago', paid_at = coalesce(paid_at, now()),
             needs_refund = needs_refund or refund where id = o.id;
    elsif p_status in ('estornado', 'perdido') then
      update public.event_entitlements set status = 'estornado' where order_id = o.id and status = 'ativo' returning id into ent_id;
      update public.payment_orders set status = p_status, needs_refund = false where id = o.id;
      if ent_id is not null and o.event_id is not null then perform public.payments_reapply_limits(o.event_id); end if;
      -- upgrade apoiado neste plano (cotado com desconto dele) ainda vale ou está aberto: não revoga (Task 7 decide), mas sinaliza.
      -- Estorno de pedido cancelado (Ruling 16) não era base de nada: sem sinal.
      if o.event_id is not null and o.status <> 'cancelado' then
        for u in select x.* from public.payment_orders x
                 where x.event_id = o.event_id and x.id <> o.id and x.from_plan_code = o.plan_code
                   and (x.status in ('criado', 'pendente')
                        or exists (select 1 from public.event_entitlements z where z.order_id = x.id and z.status = 'ativo')) loop
          insert into public.payment_events (provider, event_type, order_id, outcome, detail)
          values (u.provider, 'apply.' || p_source, u.id, 'upgrade_base_estornado',
                  jsonb_build_object('baseOrderId', o.id, 'baseTo', p_status, 'upgradeStatus', u.status, 'env', u.provider_env));
          perform public.audit(o.event_id, 'payment.upgrade_base_estornado',
            jsonb_build_object('orderId', u.id, 'baseOrderId', o.id, 'plan', u.plan_code, 'amountCents', u.amount_cents,
                               'env', u.provider_env));
        end loop;
      end if;
    else
      update public.payment_orders set status = p_status where id = o.id;
    end if;
    perform public.audit(o.event_id, 'payment.' || p_status::text,
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source)
      || case when refund then jsonb_build_object('needsRefund', true) else '{}'::jsonb end);
  end if;

  insert into public.payment_events (provider, event_type, order_id, outcome, detail)
  values (o.provider, 'apply.' || p_source, o.id, outcome,
          jsonb_build_object('from', o.status, 'to', p_status, 'amountCents', p_amount_cents, 'expectedCents', o.amount_cents,
                             'devMode', p_dev_mode, 'env', o.provider_env, 'needsRefund', refund));

  return jsonb_build_object('applied', outcome = 'aplicado', 'from', o.status, 'to', p_status, 'entitlementId', ent_id);
end $$;

-- Pedido 'criado' sem cobrança há mais de 5 min (a criação falhou ou terminou sem resposta e a reconciliação não achou
-- a cobrança pelo externalId) → 'falhou', liberando um novo checkout. Não passa por payments_apply_status, que exige a
-- cobrança. true se mudou o estado; qualquer outro caso é no-op.
create function public.payments_fail_unattached(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.status <> 'criado' or o.provider_charge_id is not null or o.created_at >= now() - interval '5 minutes' then
    return false;
  end if;
  update public.payment_orders set status = 'falhou', last_checked_at = now() where id = o.id;
  insert into public.payment_events (provider, event_type, order_id, outcome, detail)
  values (o.provider, 'apply.reconcile', o.id, 'sem_cobranca', jsonb_build_object('from', o.status, 'to', 'falhou', 'env', o.provider_env));
  perform public.audit(o.event_id, 'payment.falhou',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                       'from', o.status, 'source', 'reconcile'));
  return true;
end $$;

-- Deduplicação de eventos do provedor (webhook): false se (provider, provider_event_id) já foi gravado.
create function public.payments_record_event(p_provider_event_id text, p_type text, p_order uuid, p_outcome text, p_detail jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if coalesce(btrim(p_provider_event_id), '') = '' then raise exception 'invalid' using errcode = 'MM005'; end if;
  insert into public.payment_events (provider, provider_event_id, event_type, order_id, outcome, detail)
  values ('abacatepay', left(p_provider_event_id, 200), left(p_type, 100),
          (select id from public.payment_orders where id = p_order), left(p_outcome, 100), public.payments_scrub(p_detail))
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ---------------------------------------------------------------- privilégios
revoke execute on function
  public.payments_scrub(jsonb), public.payments_plan_covered(uuid, text), public.payments_quote_internal(uuid, text),
  public.payments_reapply_limits(uuid), public.payments_order_json(public.payment_orders, boolean), public.payment_orders_touch(),
  public.payments_quote(uuid, text), public.payments_open_order(uuid, text, uuid), public.payments_order_status(uuid),
  public.payments_attach_charge(uuid, text, text, text, timestamptz, boolean),
  public.payments_apply_status(uuid, text, public.payment_status, int, boolean, text),
  public.payments_record_event(text, text, uuid, text, jsonb), public.payments_fail_unattached(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.payments_quote(uuid, text), public.payments_open_order(uuid, text, uuid), public.payments_order_status(uuid)
  to authenticated;
grant execute on function
  public.payments_attach_charge(uuid, text, text, text, timestamptz, boolean),
  public.payments_apply_status(uuid, text, public.payment_status, int, boolean, text),
  public.payments_record_event(text, text, uuid, text, jsonb), public.payments_fail_unattached(uuid)
  to service_role;
