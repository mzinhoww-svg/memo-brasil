-- MemoriesMT · COM-017 · códigos de cortesia. ADITIVA (tabelas e funções novas).
-- O Master gera um código que libera um plano sem pagamento; o anfitrião resgata no evento e ganha um direito
-- source='codigo', env='nenhum' (vale com pagamentos desligados, em sandbox e em produção).
--
-- Segurança do código:
--   * formato MMT-XXXX-XXXX, alfabeto sem ambiguidade (sem I, L, O, 0, 1), 8 caracteres de gen_random_bytes;
--   * o banco guarda só code_hash = sha256(maiúsculas, só letras e dígitos) e code_hint = 8 primeiros ("MMT-7KQ4");
--   * admin_create_code devolve o código inteiro uma única vez; nem a tabela nem a auditoria guardam o código;
--   * inexistente, expirado, esgotado e revogado: a mesma resposta 'invalido' (sem oráculo);
--   * 5 'invalido' do mesmo usuário em 10 min → 'muitas_tentativas' (contagem em audit_logs, por auth.uid());
--   * consumo de uso com select … for update na linha do código; unique(code_id, event_id) segura o duplo resgate.
-- Erros: MM004 forbidden · MM005 invalid · MM011 reasonrequired · MM002 eventended.

-- ---------------------------------------------------------------- tabelas
create table public.courtesy_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null check (code_hash ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (code_hint ~ '^MMT-[A-Z0-9]{4}$'),
  plan_code text not null references public.plans,
  max_uses int not null check (max_uses between 1 and 1000),
  uses int not null default 0 check (uses >= 0 and uses <= max_uses),
  expires_at timestamptz not null,
  note text not null check (char_length(note) between 3 and 200),
  created_by uuid not null,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create table public.courtesy_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid references public.courtesy_codes,
  event_id uuid references public.events on delete cascade,
  user_id uuid not null,
  entitlement_id uuid,
  created_at timestamptz default now(),
  unique (code_id, event_id)
);

-- sem grant direto para clientes: tudo passa pelas RPCs security definer abaixo
alter table public.courtesy_codes enable row level security;
alter table public.courtesy_redemptions enable row level security;
revoke all on public.courtesy_codes, public.courtesy_redemptions from public, anon, authenticated;

-- contagem do limite de tentativas: audit_logs (actor_id, action, at) — o índice por ator já existe (audit_logs_actor_idx)

-- ---------------------------------------------------------------- auxiliares
-- Normalização única para hash: maiúsculas, só letras e dígitos; o corpo de 8 caracteres sem o prefixo ganha "MMT".
create function public.courtesy_code_hash(p_code text) returns text
language plpgsql immutable set search_path = '' as $$
declare s text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if char_length(s) = 8 then s := 'MMT' || s; end if;
  return encode(extensions.digest(s, 'sha256'), 'hex');
end $$;

-- Sobe os limites do evento ao plano concedido, como pagamento e cortesia fazem (null = sem limite vence; nunca baixa).
create function public.entitlement_raise_limits(p_event uuid, p_plan text) returns void
language sql security definer set search_path = '' as $$
  update public.events e set
    capacity = case when e.capacity is null or p.max_guests is null then null else greatest(e.capacity, p.max_guests) end,
    shots_per_person = case when e.shots_per_person is null or p.max_shots is null then null
                            else greatest(e.shots_per_person, p.max_shots) end
  from public.plans p
  where e.id = p_event and p.code = p_plan
$$;

create function public.courtesy_code_json(c public.courtesy_codes, p_plan_name text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'hint', c.code_hint, 'planCode', c.plan_code, 'planName', p_plan_name, 'maxUses', c.max_uses, 'uses', c.uses,
    'expiresAt', c.expires_at, 'note', c.note, 'createdAt', c.created_at, 'revokedAt', c.revoked_at,
    'status', case when c.revoked_at is not null then 'revogado'
                   when c.uses >= c.max_uses then 'usado'
                   when c.expires_at <= now() then 'expirado'
                   else 'ativo' end)
$$;

-- ---------------------------------------------------------------- Master
create function public.admin_create_code(p_plan text, p_max_uses int, p_expires_at timestamptz, p_note text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 símbolos
  clean_note text := btrim(coalesce(p_note, ''));
  pl public.plans;
  body text; b bytea; i int; v int; full_code text; new_id uuid; attempt int := 0;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(clean_note) < 3 or char_length(clean_note) > 200 then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 1000 then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_expires_at is null or p_expires_at <= now() then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into pl from public.plans where plans.code = p_plan;
  if not found or pl.is_free then raise exception 'invalid' using errcode = 'MM005'; end if;

  loop
    attempt := attempt + 1;
    body := '';
    -- amostragem por rejeição: só bytes < 248 (8 × 31) para não enviesar o alfabeto
    while char_length(body) < 8 loop
      b := extensions.gen_random_bytes(16);
      for i in 0 .. 15 loop
        v := get_byte(b, i);
        if v < 248 and char_length(body) < 8 then body := body || substr(alphabet, (v % 31) + 1, 1); end if;
      end loop;
    end loop;
    full_code := 'MMT-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
    begin
      insert into public.courtesy_codes (code_hash, code_hint, plan_code, max_uses, expires_at, note, created_by)
      values (public.courtesy_code_hash(full_code), left(full_code, 8), pl.code, p_max_uses, p_expires_at, clean_note, auth.uid())
      returning id into new_id;
      exit;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (auth.uid(), 'master', 'code.created', 'courtesy_code', new_id::text,
          jsonb_build_object('codeId', new_id, 'hint', left(full_code, 8), 'plan', pl.code, 'maxUses', p_max_uses,
                             'expiresAt', p_expires_at, 'note', clean_note));
  return full_code; -- única vez em que o código inteiro sai do banco
end $$;

create function public.admin_list_codes() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select public.courtesy_code_json(c, p.name)
    from public.courtesy_codes c
    left join public.plans p on p.code = c.plan_code
    order by c.created_at desc, c.id
    limit 500;
end $$;

-- Revogar não desfaz planos já liberados: o código só para de funcionar.
create function public.admin_revoke_code(p_code_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text; c public.courtesy_codes;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into c from public.courtesy_codes where id = p_code_id for update;
  if not found or c.revoked_at is not null then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.courtesy_codes set revoked_at = now() where id = c.id;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', 'code.revoked', 'courtesy_code', c.id::text, why,
          jsonb_build_object('codeId', c.id, 'hint', c.code_hint, 'plan', c.plan_code, 'uses', c.uses, 'maxUses', c.max_uses));
end $$;

-- ---------------------------------------------------------------- organizador
-- {applied, planCode, reason}; reason ∈ ok | ja_incluido | invalido | muitas_tentativas.
-- planCode: o plano do código quando ele é válido para este evento (ok/ja_incluido); null em invalido/muitas_tentativas.
create function public.redeem_code(p_event uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ev public.events;
  c public.courtesy_codes;
  pl public.plans;
  ent_id uuid;
  fails int;
begin
  if uid is null or not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;

  -- limite de tentativas: antes de olhar o código, para não servir de oráculo a quem está bloqueado
  select count(*) into fails from public.audit_logs
   where actor_id = uid and action = 'code.redeem_invalid' and at > now() - interval '10 minutes';
  if fails >= 5 then
    return jsonb_build_object('applied', false, 'planCode', null, 'reason', 'muitas_tentativas');
  end if;

  select * into ev from public.events where id = p_event and deleted_at is null for update;
  if now() >= public.event_end(ev.start_at, ev.duration_hours, ev.ended_at) then
    raise exception 'eventended' using errcode = 'MM002';
  end if;

  select * into c from public.courtesy_codes where code_hash = public.courtesy_code_hash(p_code) for update;
  if found and c.revoked_at is null and c.expires_at > now()
     and exists (select 1 from public.courtesy_redemptions r where r.code_id = c.id and r.event_id = ev.id) then
    -- mesmo código no mesmo evento: já liberado, não consome
    return jsonb_build_object('applied', false, 'planCode', c.plan_code, 'reason', 'ja_incluido');
  end if;
  if not found or c.revoked_at is not null or c.expires_at <= now() or c.uses >= c.max_uses then
    insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
    values (uid, 'organizador', ev.id, 'code.redeem_invalid', 'event', ev.id::text, '{}'); -- sem o texto tentado
    return jsonb_build_object('applied', false, 'planCode', null, 'reason', 'invalido');
  end if;

  select * into pl from public.plans where code = c.plan_code;
  if public.payments_plan_covered(ev.id, pl.code) then
    return jsonb_build_object('applied', false, 'planCode', pl.code, 'reason', 'ja_incluido');
  end if;

  update public.courtesy_codes set uses = uses + 1 where id = c.id;
  insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, created_by, reason)
  values (ev.id, pl.code, pl.max_guests, pl.max_shots, 'codigo', 'nenhum', uid, 'código ' || c.code_hint)
  returning id into ent_id;
  insert into public.courtesy_redemptions (code_id, event_id, user_id, entitlement_id) values (c.id, ev.id, uid, ent_id);
  perform public.entitlement_raise_limits(ev.id, pl.code);
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (uid, 'organizador', ev.id, 'code.redeemed', 'courtesy_code', c.id::text,
          jsonb_build_object('codeId', c.id, 'hint', c.code_hint, 'plan', pl.code, 'entitlementId', ent_id,
                             'maxGuests', pl.max_guests, 'maxShots', pl.max_shots));
  return jsonb_build_object('applied', true, 'planCode', pl.code, 'reason', 'ok');
end $$;

-- ---------------------------------------------------------------- privilégios
revoke execute on function
  public.courtesy_code_hash(text), public.entitlement_raise_limits(uuid, text), public.courtesy_code_json(public.courtesy_codes, text),
  public.admin_create_code(text, int, timestamptz, text), public.admin_list_codes(), public.admin_revoke_code(uuid, text),
  public.redeem_code(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.admin_create_code(text, int, timestamptz, text), public.admin_list_codes(), public.admin_revoke_code(uuid, text),
  public.redeem_code(uuid, text)
  to authenticated;
