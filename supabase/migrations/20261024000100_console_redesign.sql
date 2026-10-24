-- MemoriesMT · redesign do console master (docs/plans/console-redesign.md, Tarefa 1). ADITIVA.
-- Colunas is_test (events, profiles) com backfill; trigger que preenche actor_role/alvo da auditoria; RPCs de leitura do
-- console (staff) e três ações sensíveis do master (revelar agora, marcar teste, soft delete de testes) com motivo e
-- admin_log; rotina de órfãos anônimos criada INATIVA. Não toca pagamentos nem payments_env.
-- Reversão: supabase/rollback/20261024000100_console_redesign.down.sql
-- Erros: MM004 forbidden · MM005 invalid · MM008 revealed · MM011 reasonrequired
--
-- actor_role segue o vocabulário já validado pelo check de audit_logs (sistema, organizador, convidado, master, support,
-- auditor, operador). audit_logs é imutável (UPDATE barrado por trigger ENABLE ALWAYS + event trigger): as linhas antigas
-- NÃO são reescritas; o papel/alvo derivado é calculado na leitura (admin_list_audit_v2, admin_event_detail).

-- ---------------------------------------------------------------- colunas is_test
alter table public.events add column is_test boolean not null default false;
alter table public.profiles add column is_test boolean not null default false;
create index events_is_test_idx on public.events (is_test) where is_test;

-- cliente (anfitrião) não marca nem desmarca teste: só o master pela RPC (ou o dono/service_role).
-- Evento NOVO com título de teste (mesma regra de título do backfill) já nasce is_test, venha de onde vier; sem isso
-- os eventos "TESTE ..." criados depois da migration entrariam nos números até alguém marcá-los à mão.
create function public.is_test_guard() returns trigger
language plpgsql set search_path = '' as $$
declare titled boolean := false;
begin
  if tg_op = 'INSERT' and tg_table_name = 'events' then
    titled := new.title like 'TESTE%' or new.title ilike 'teste homologa%' or new.title like 'RT %';
  end if;
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.is_test := titled; else new.is_test := old.is_test; end if;
  elsif titled then
    new.is_test := true;
  end if;
  return new;
end $$;
create trigger events_is_test_guard before insert or update on public.events for each row execute function public.is_test_guard();
create trigger profiles_is_test_guard before insert or update on public.profiles for each row execute function public.is_test_guard();

-- backfill: títulos de teste (TESTE em maiúsculas, "Teste homologação", "RT ") e contas @memoriesmt.test (perfil e eventos
-- que hospeda). Só liga a marca, nunca desliga. Idempotente; só o dono executa.
create function public.console_backfill_test_flags() returns int
language plpgsql security definer set search_path = '' as $$
declare a int; b int;
begin
  update public.profiles p set is_test = true
    from auth.users u
   where u.id = p.id and not p.is_test and u.email ilike '%@memoriesmt.test';
  get diagnostics a = row_count;
  update public.events e set is_test = true
   where not e.is_test
     and (e.title like 'TESTE%' or e.title ilike 'teste homologa%' or e.title like 'RT %'
          or exists (select 1 from public.profiles p where p.id = e.host_id and p.is_test));
  get diagnostics b = row_count;
  return a + b;
end $$;
select public.console_backfill_test_flags();

-- ---------------------------------------------------------------- auditoria: papel do ator e alvo
-- Ordem: sem ator → sistema · anfitrião do evento → organizador · papel de plataforma ativo → o papel · senão convidado.
create function public.audit_actor_role_for(p_actor uuid, p_event uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_actor is null then 'sistema'
    when p_event is not null and exists (select 1 from public.events e where e.id = p_event and e.host_id = p_actor) then 'organizador'
    else coalesce((select r.role from public.platform_roles r where r.user_id = p_actor and r.revoked_at is null
                    order by case r.role when 'master' then 0 when 'support' then 1 else 2 end limit 1), 'convidado')
  end
$$;

-- O papel sai de actor_id, nunca de auth.uid(): quem grava actor_id nulo está registrando um efeito do sistema
-- (reveal.released, retention.expired, account.deleted), mesmo quando isso roda dentro de uma ação de usuário/master
-- (admin_reveal_now grava reveal.released sem ator e admin.reveal_now com o master). Assim a linha de sistema não é
-- atribuída a quem chamou.
create function public.audit_logs_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_role is null then
    new.actor_role := public.audit_actor_role_for(new.actor_id, new.event_id);
  end if;
  if new.target_type is null and new.target_id is null and new.event_id is not null then
    new.target_type := 'event'; new.target_id := new.event_id::text;
  end if;
  return new;
end $$;
create trigger audit_logs_fill_actor before insert on public.audit_logs for each row execute function public.audit_logs_fill();

-- ---------------------------------------------------------------- revelação: uma rotina só (servidor e master)
-- Mesmo UPDATE e a mesma trilha (reveal.released) que reveal_due_events já fazia; agora ela chama esta função.
create function public.release_reveal(p_event uuid, p_at timestamptz, p_source text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.events set revealed_at = p_at, reveal_status = 'revelada'
   where id = p_event and reveal_enabled and revealed_at is null and deleted_at is null;
  if not found then return false; end if;
  insert into public.audit_logs (actor_id, event_id, action, detail)
  values (null, p_event, 'reveal.released', jsonb_build_object('at', p_at, 'ran_at', now())
          || case when p_source is null then '{}'::jsonb else jsonb_build_object('source', p_source) end);
  return true;
end $$;

create or replace function public.reveal_due_events() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select id, reveal_at from public.events
    where reveal_enabled and revealed_at is null and deleted_at is null and reveal_at <= now()
    for update skip locked
  loop
    if public.release_reveal(r.id, r.reveal_at) then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- admin_storage_breakdown (só leitura)
-- órfão = objeto em event-photos sem a linha correspondente em photos (original ou .thumb)
create function public.admin_storage_breakdown() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare tz constant text := 'America/Cuiaba'; r jsonb; growth jsonb; d0 date := (now() at time zone 'America/Cuiaba')::date - 29;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with o as (
    select ob.created_at, coalesce((ob.metadata ->> 'size')::bigint, 0) as sz,
           case when ob.bucket_id = 'event-branding' then 'branding'
                when not exists (select 1 from public.photos ph where ph.id = public.photo_id_from_path(ob.name)
                                   and ob.name in (ph.storage_path, ph.storage_path || '.thumb')) then 'orphan'
                when ob.name like '%.thumb' then 'derived' else 'original' end as cls
    from storage.objects ob where ob.bucket_id in ('event-photos', 'event-branding')
  )
  select jsonb_build_object(
    'originals', jsonb_build_object('n', count(*) filter (where cls = 'original'), 'bytes', coalesce(sum(sz) filter (where cls = 'original'), 0)),
    'derived', jsonb_build_object('n', count(*) filter (where cls = 'derived'), 'bytes', coalesce(sum(sz) filter (where cls = 'derived'), 0)),
    'orphans', jsonb_build_object('n', count(*) filter (where cls = 'orphan'), 'bytes', coalesce(sum(sz) filter (where cls = 'orphan'), 0)),
    'branding', jsonb_build_object('n', count(*) filter (where cls = 'branding'), 'bytes', coalesce(sum(sz) filter (where cls = 'branding'), 0)),
    'avgPhotoBytes', coalesce(round(avg(sz) filter (where cls = 'original')), 0)::bigint,
    'totalBytes', coalesce(sum(sz), 0))
  into r from o;

  select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'bytes', coalesce(x.b, 0)) order by g), '[]') into growth
  from generate_series(d0::timestamp, (d0 + 29)::timestamp, interval '1 day') g
  left join (select (ob.created_at at time zone tz)::date as day, sum(coalesce((ob.metadata ->> 'size')::bigint, 0)) as b
               from storage.objects ob
              where ob.bucket_id in ('event-photos', 'event-branding') and ob.created_at >= (d0::timestamp at time zone tz)
              group by 1) x on x.day = g::date;
  return r || jsonb_build_object('growth', growth);
end $$;

-- ---------------------------------------------------------------- admin_overview
create function public.admin_overview(p_days int default 30, p_include_tests boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/Cuiaba';
  inc boolean := coalesce(p_include_tests, false);
  master boolean := public.is_master();
  cron_ok boolean := to_regclass('cron.job') is not null;
  d0 date; t0 timestamptz; tp timestamptz;
  series jsonb; sp_photos jsonb; sp_joins jsonb; sp_rev jsonb; sp_active jsonb;
  v_photos bigint; v_joins bigint; v_rev bigint; p_photos bigint; p_joins bigint; p_rev bigint; v_active bigint; p_active bigint;
  funnel jsonb; upcoming jsonb; st jsonb; jobs jsonb := '[]'; failing int := 0; readiness jsonb; filled int; divergences int;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_days is null or p_days < 1 or p_days > 366 then raise exception 'invalid' using errcode = 'MM005'; end if;
  d0 := (now() at time zone tz)::date - (p_days - 1);
  t0 := d0::timestamp at time zone tz;          -- início do período (meia-noite local de d0)
  tp := t0 - p_days * interval '1 day';         -- início do período anterior, de mesmo tamanho

  with days as (
    select g::date as day, least((g + interval '1 day') at time zone tz, now()) as de
    from generate_series(d0::timestamp, (d0 + (p_days - 1))::timestamp, interval '1 day') g
  ), ph as (
    select (x.created_at at time zone tz)::date as day, count(*) as n
      from public.photos x join public.events e on e.id = x.event_id
     where x.upload_status = 'pronta' and e.deleted_at is null and (inc or not e.is_test) and x.created_at >= t0 group by 1
  ), pj as (
    select (x.joined_at at time zone tz)::date as day, count(*) as n
      from public.participants x join public.events e on e.id = x.event_id
     where e.deleted_at is null and (inc or not e.is_test) and x.joined_at >= t0 group by 1
  ), ec as (
    select (e.created_at at time zone tz)::date as day, count(*) as n
      from public.events e where e.deleted_at is null and (inc or not e.is_test) and e.created_at >= t0 group by 1
  ), rv as (
    select (o.paid_at at time zone tz)::date as day, sum(o.amount_cents) as n
      from public.payment_orders o left join public.events e on e.id = o.event_id
     where master and o.status = 'pago' and o.paid_at >= t0 and (inc or e.id is null or not e.is_test) group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'photos', coalesce(ph.n, 0), 'joins', coalesce(pj.n, 0),
                                               'eventsCreated', coalesce(ec.n, 0)) order by d.day), '[]'),
         coalesce(jsonb_agg(coalesce(ph.n, 0) order by d.day), '[]'),
         coalesce(jsonb_agg(coalesce(pj.n, 0) order by d.day), '[]'),
         coalesce(jsonb_agg(coalesce(rv.n, 0) order by d.day), '[]'),
         coalesce(jsonb_agg((select count(*) from public.events e
                              where e.deleted_at is null and (inc or not e.is_test) and e.created_at <= d.de and e.start_at <= d.de
                                and public.event_end(e.start_at, e.duration_hours, e.ended_at) > d.de) order by d.day), '[]'),
         coalesce(sum(ph.n), 0), coalesce(sum(pj.n), 0), coalesce(sum(rv.n), 0)
    into series, sp_photos, sp_joins, sp_rev, sp_active, v_photos, v_joins, v_rev
    from days d left join ph on ph.day = d.day left join pj on pj.day = d.day left join ec on ec.day = d.day left join rv on rv.day = d.day;

  select count(*) into p_photos from public.photos x join public.events e on e.id = x.event_id
   where x.upload_status = 'pronta' and e.deleted_at is null and (inc or not e.is_test) and x.created_at >= tp and x.created_at < t0;
  select count(*) into p_joins from public.participants x join public.events e on e.id = x.event_id
   where e.deleted_at is null and (inc or not e.is_test) and x.joined_at >= tp and x.joined_at < t0;
  select coalesce(sum(o.amount_cents), 0) into p_rev from public.payment_orders o left join public.events e on e.id = o.event_id
   where master and o.status = 'pago' and o.paid_at >= tp and o.paid_at < t0 and (inc or e.id is null or not e.is_test);
  select count(*) filter (where now() < public.event_end(e.start_at, e.duration_hours, e.ended_at) and e.start_at <= now()),
         count(*) filter (where e.created_at <= now() - p_days * interval '1 day' and e.start_at <= now() - p_days * interval '1 day'
                            and public.event_end(e.start_at, e.duration_hours, e.ended_at) > now() - p_days * interval '1 day')
    into v_active, p_active
    from public.events e where e.deleted_at is null and (inc or not e.is_test);

  select jsonb_build_object(
      'created', count(*),
      'withParticipant', count(*) filter (where exists (select 1 from public.participants p where p.event_id = e.id and p.user_id <> e.host_id)),
      'withPhoto', count(*) filter (where exists (select 1 from public.photos x where x.event_id = e.id and x.upload_status = 'pronta' and x.deleted_at is null)),
      'revealed', count(*) filter (where e.revealed_at is not null))
    into funnel
    from public.events e where e.deleted_at is null and (inc or not e.is_test) and e.created_at >= t0;

  select coalesce(jsonb_agg(jsonb_build_object('eventId', x.id, 'title', x.title, 'revealAt', x.reveal_at, 'isTest', x.is_test) order by x.reveal_at, x.id), '[]')
    into upcoming
    from (select e.id, e.title, e.reveal_at, e.is_test from public.events e
           where e.reveal_enabled and e.revealed_at is null and e.deleted_at is null and (inc or not e.is_test)
           order by e.reveal_at, e.id limit 10) x;

  st := public.admin_storage_breakdown();

  if cron_ok then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'ok', coalesce(l.status, '') <> 'failed') order by j.jobname), '[]'),
             count(*) filter (where j.active and l.status = 'failed')
        from cron.job j
        left join lateral (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) l on true
       where j.jobname like 'mm-%'
    $q$ into jobs, failing;
  end if;

  select jsonb_build_object(
      'companyCnpj', coalesce(bool_or(s.key = 'company_cnpj'), false),
      'companyLegalName', coalesce(bool_or(s.key = 'company_legal_name'), false),
      'supportEmail', coalesce(bool_or(s.key = 'support_email'), false),
      'supportPhone', coalesce(bool_or(s.key = 'support_phone'), false)),
         count(*)
    into readiness, filled
    from public.platform_settings s
   where s.key in ('company_cnpj', 'company_legal_name', 'support_email', 'support_phone')
     and jsonb_typeof(s.value) <> 'null' and btrim(coalesce(s.value #>> '{}', '')) <> '';
  readiness := readiness || jsonb_build_object('paymentsEnv', public.payments_env(),
                                               'lastWebhookAt', (select max(pe.received_at) from public.payment_events pe));

  if master then
    select count(*) into divergences from public.admin_payment_divergences() d where not coalesce((d ->> 'refundInProgress')::boolean, false);
  end if;

  return jsonb_build_object(
    'days', p_days, 'from', t0, 'to', now(), 'includeTests', inc, 'generatedAt', now(),
    'kpis', jsonb_build_object(
      'activeEvents', jsonb_build_object('value', v_active, 'previous', p_active, 'spark', sp_active),
      'participants', jsonb_build_object('value', v_joins, 'previous', p_joins, 'spark', sp_joins),
      'photos', jsonb_build_object('value', v_photos, 'previous', p_photos, 'spark', sp_photos),
      'revenueCents', case when master then jsonb_build_object('value', v_rev, 'previous', p_rev, 'spark', sp_rev)
                           else jsonb_build_object('value', null, 'previous', null, 'spark', '[]'::jsonb) end),
    'series', series,
    'funnel', funnel,
    'upcomingReveals', upcoming,
    'storage', jsonb_build_object('originals', (st -> 'originals' ->> 'n')::bigint, 'derived', (st -> 'derived' ->> 'n')::bigint,
                                  'orphans', (st -> 'orphans' ->> 'n')::bigint, 'bytes', (st ->> 'totalBytes')::bigint),
    'jobs', jobs,
    'readiness', readiness,
    'alerts', jsonb_build_object(
      'pendingReveals', (select count(*) from public.events e where e.reveal_enabled and e.revealed_at is null and e.deleted_at is null and (inc or not e.is_test)),
      'overdueReveals', (select count(*) from public.events e where e.reveal_enabled and e.revealed_at is null and e.deleted_at is null
                           and (inc or not e.is_test) and e.reveal_at < now()),
      'lgpdPending', (select count(*) from public.account_deletion_requests where processed_at is null),
      'lgpdOverdue', (select count(*) from public.account_deletion_requests where processed_at is null and requested_at < now() - interval '15 days'),
      'settingsMissing', 4 - filled,
      'paymentDivergences', divergences,
      'failingJobs', failing));
end $$;

-- ---------------------------------------------------------------- admin_list_events_v2
-- p_status: ativo | encerrado | excluido (só os com deleted_at) | null (todos não excluídos)
-- p_sort: createdAt (padrão) | startAt | title | hostName | participants | photos | revealAt | status · p_dir: asc | desc (padrão)
create function public.admin_list_events_v2(p_limit int default 25, p_offset int default 0, p_search text default null,
                                            p_status text default null, p_include_tests boolean default false,
                                            p_sort text default null, p_dir text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        dir text := lower(coalesce(nullif(btrim(p_dir), ''), 'desc'));
        sort_expr text; total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_status is not null and p_status not in ('ativo', 'encerrado', 'excluido') then raise exception 'invalid' using errcode = 'MM005'; end if;
  sort_expr := case coalesce(nullif(btrim(p_sort), ''), 'createdAt')
    when 'createdAt' then 'created_at' when 'startAt' then 'start_at' when 'title' then 'lower(title)'
    when 'hostName' then 'lower(host_display)' when 'participants' then 'participants' when 'photos' then 'photos'
    when 'revealAt' then 'reveal_at' when 'status' then 'status' end;
  if sort_expr is null or dir not in ('asc', 'desc') then raise exception 'invalid' using errcode = 'MM005'; end if;

  execute format($q$
    with f as (
      select e.id, e.title, e.host_id, coalesce(nullif(e.host_name, ''), pr.display_name, '') as host_display, e.start_at, e.created_at,
             e.deleted_at, e.reveal_enabled, e.reveal_at, e.revealed_at, e.capacity, e.shots_per_person, e.is_test,
             case when e.deleted_at is not null then 'excluido'
                  when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end as status,
             (select count(*) from public.participants p where p.event_id = e.id) as participants,
             (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.deleted_at is null) as photos,
             (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'falhou') as failed
        from public.events e left join public.profiles pr on pr.id = e.host_id
       where ($1 or not e.is_test)
         and (case when $2 = 'excluido' then e.deleted_at is not null else e.deleted_at is null end)
         and ($2 is null or $2 = 'excluido' or ($2 = 'ativo') = (now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)))
         and ($3 is null or e.title ilike $3 or e.host_name ilike $3 or pr.display_name ilike $3)
    ), ranked as (select f.*, row_number() over (order by %s %s nulls last, f.id) as rn from f)
    select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'hostName', r.host_display, 'hostId', r.host_id, 'status', r.status, 'startAt', r.start_at,
        'createdAt', r.created_at,
        'revealState', case when not r.reveal_enabled then 'desativada' when r.revealed_at is not null then 'revelada'
                            when r.reveal_at < now() then 'atrasada' else 'pendente' end,
        'revealAt', r.reveal_at, 'participants', r.participants, 'photos', r.photos, 'failedUploads', r.failed,
        'capacity', r.capacity, 'shotsPerPerson', r.shots_per_person,
        'planCode', (select ee.plan_code from public.effective_entitlement(r.id) ee),
        'isTest', r.is_test, 'deletedAt', r.deleted_at) order by r.rn), '[]')
      from ranked r where r.rn > $4 and r.rn <= $4 + $5
  $q$, sort_expr, dir) into total, items using coalesce(p_include_tests, false), p_status, pat, off, lim;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

-- ---------------------------------------------------------------- admin_event_detail (sem fotos, sem código do evento)
create function public.admin_event_detail(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; host_display text; ev_end timestamptz; master boolean := public.is_master();
        ent jsonb; timeline jsonb; parts jsonb; orders jsonb := '[]'; aud jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select coalesce(nullif(e.host_name, ''), pr.display_name, '') into host_display from public.profiles pr where pr.id = e.host_id;
  ev_end := public.event_end(e.start_at, e.duration_hours, e.ended_at);

  select jsonb_build_object('planCode', x.plan_code, 'maxGuests', x.max_guests, 'maxShots', x.max_shots, 'source', x.source)
    into ent from public.effective_entitlement(e.id) x;

  select coalesce(jsonb_agg(jsonb_build_object('at', t.at, 'kind', t.kind, 'label', t.label) order by t.at, t.ord), '[]') into timeline
  from (
    select e.created_at as at, 'created' as kind, 'Evento criado' as label, 1 as ord
    union all select e.start_at, 'started', case when e.start_at > now() then 'Início previsto' else 'Início' end, 2
    union all select (select min(p.joined_at) from public.participants p where p.event_id = e.id and p.user_id <> e.host_id),
                     'first_join', 'Primeira entrada de convidado', 3
    union all select (select min(x.created_at) from public.photos x where x.event_id = e.id and x.upload_status = 'pronta'),
                     'first_photo', 'Primeira foto enviada', 4
    union all select ev_end, 'ended', case when ev_end > now() then 'Encerramento previsto' else 'Encerramento' end, 5
    union all select case when e.revealed_at is not null then e.revealed_at when e.reveal_enabled then e.reveal_at end,
                     case when e.revealed_at is not null then 'revealed' else 'reveal_scheduled' end,
                     case when e.revealed_at is not null then 'Revelação liberada' else 'Revelação agendada' end, 6
    union all select e.deleted_at, 'deleted', 'Evento excluído', 7
  ) t where t.at is not null;

  select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'joinedAt', x.joined_at, 'isHost', x.user_id = e.host_id) order by x.joined_at, x.user_id), '[]')
    into parts
    from (select * from public.participants p where p.event_id = e.id order by p.joined_at, p.user_id limit 200) x;

  if master then -- pedidos de pagamento: mesma regra de admin_list_payments (só master)
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status, 'amountCents', o.amount_cents, 'createdAt', o.created_at)
                              order by o.created_at desc, o.id), '[]')
      into orders
      from (select * from public.payment_orders o where o.event_id = e.id order by o.created_at desc, o.id limit 50) o;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action,
                                               'actorRole', coalesce(a.actor_role, public.audit_actor_role_for(a.actor_id, a.event_id)),
                                               'reason', a.reason) order by a.at desc, a.id desc), '[]')
    into aud
    from (select * from public.audit_logs l where l.event_id = e.id order by l.at desc, l.id desc limit 50) a;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'category', e.category, 'hostId', e.host_id, 'hostName', coalesce(host_display, ''),
      'status', case when e.deleted_at is not null then 'excluido' when now() >= ev_end then 'encerrado' else 'ativo' end,
      'startAt', e.start_at, 'endAt', ev_end, 'createdAt', e.created_at, 'deletedAt', e.deleted_at,
      'revealEnabled', e.reveal_enabled, 'revealAt', e.reveal_at, 'revealedAt', e.revealed_at,
      'revealState', case when not e.reveal_enabled then 'desativada' when e.revealed_at is not null then 'revelada'
                          when e.reveal_at < now() then 'atrasada' else 'pendente' end,
      'capacity', e.capacity, 'shotsPerPerson', e.shots_per_person, 'isTest', e.is_test, 'timezone', e.timezone,
      'participants', (select count(*) from public.participants p where p.event_id = e.id),
      'photos', (select count(*) from public.photos x where x.event_id = e.id and x.upload_status = 'pronta' and x.deleted_at is null),
      'failedUploads', (select count(*) from public.photos x where x.event_id = e.id and x.upload_status = 'falhou')),
    'entitlement', ent, 'timeline', timeline, 'participants', parts, 'orders', orders, 'audit', aud);
end $$;

-- ---------------------------------------------------------------- admin_search (até 5 de cada; termo com 2+ caracteres)
-- Usuário por e-mail e pedidos: só master. Demais papéis buscam usuário por nome/id e veem e-mail mascarado.
create function public.admin_search(p_q text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := left(btrim(coalesce(p_q, '')), 80); master boolean := public.is_master(); pat text;
        evs jsonb; usrs jsonb; ords jsonb := '[]';
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(q) < 2 then return jsonb_build_object('events', '[]'::jsonb, 'users', '[]'::jsonb, 'orders', '[]'::jsonb); end if;
  pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title) order by x.created_at desc, x.id), '[]') into evs
    from (select e.id, e.title, e.created_at from public.events e
           where e.title ilike pat or e.id::text = lower(q) or e.code = upper(q)
           order by e.created_at desc, e.id limit 5) x;

  select coalesce(jsonb_agg(jsonb_build_object('userId', x.id,
                                               'email', case when x.email is null then null when master then x.email
                                                             else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end)
                            order by x.created_at desc, x.id), '[]') into usrs
    from (select u.id, u.email, u.created_at from auth.users u left join public.profiles pr on pr.id = u.id
           where u.id::text = lower(q) or pr.display_name ilike pat or (master and u.email ilike pat)
           order by u.created_at desc, u.id limit 5) x;

  if master then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'eventId', x.event_id, 'status', x.status) order by x.created_at desc, x.id), '[]') into ords
      from (select o.id, o.event_id, o.status, o.created_at from public.payment_orders o
             where o.id::text like replace(replace(lower(q), '%', ''), '_', '') || '%' or o.provider_charge_id = q
             order by o.created_at desc, o.id limit 5) x;
  end if;
  return jsonb_build_object('events', evs, 'users', usrs, 'orders', ords);
end $$;

-- ---------------------------------------------------------------- admin_list_users_v2
-- p_kind: google | email | anon | null. Itens = os de admin_list_users + eventsLinked, isTest, orphanAnon.
-- summary conta a base (respeitando p_include_tests), sem o filtro de tipo e de busca.
create function public.admin_list_users_v2(p_limit int default 50, p_offset int default 0, p_kind text default null,
                                           p_include_tests boolean default false, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        inc boolean := coalesce(p_include_tests, false); master boolean := public.is_master();
        q text := nullif(left(btrim(coalesce(p_search, '')), 80), '');
        pat text; total bigint; items jsonb; summary jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_kind is not null and p_kind not in ('google', 'email', 'anon') then raise exception 'invalid' using errcode = 'MM005'; end if;
  pat := case when q is null then null else '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with base as (
    select u.id, u.created_at, coalesce(u.is_anonymous, false) as anon, coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
           u.email, u.last_sign_in_at, pr.display_name, coalesce(pr.is_test, false) as is_test,
           coalesce(u.is_anonymous, false) and not exists (select 1 from public.participants p where p.user_id = u.id) as orphan
      from auth.users u left join public.profiles pr on pr.id = u.id
     where inc or not coalesce(pr.is_test, false)
  ), f as (
    select * from base b
     where (p_kind is null or (p_kind = 'anon' and b.anon) or (p_kind = 'google' and not b.anon and b.provider = 'google')
            or (p_kind = 'email' and not b.anon and b.provider = 'email'))
       and (q is null or b.id::text = lower(q) or b.display_name ilike pat or (master and b.email ilike pat))
  )
  select (select count(*) from f),
         (select jsonb_build_object('google', count(*) filter (where not anon and provider = 'google'),
                                    'email', count(*) filter (where not anon and provider = 'email'),
                                    'anon', count(*) filter (where anon), 'orphanAnon', count(*) filter (where orphan)) from base),
         coalesce(jsonb_agg(jsonb_build_object(
      'userId', x.id, 'isAnonymous', x.anon, 'provider', x.provider,
      'email', case when x.email is null then null when master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end,
      'createdAt', x.created_at, 'lastSignInAt', x.last_sign_in_at,
      'platformRole', (select r.role from public.platform_roles r where r.user_id = x.id and r.revoked_at is null
                        order by case r.role when 'master' then 0 when 'support' then 1 else 2 end limit 1),
      'eventsLinked', (select count(*) from (select e.id from public.events e where e.host_id = x.id and e.deleted_at is null
                                             union select p.event_id from public.participants p where p.user_id = x.id) l),
      'isTest', x.is_test, 'orphanAnon', x.orphan) order by x.created_at desc, x.id), '[]')
    into total, summary, items
    from (select * from f order by created_at desc, id limit lim offset off) x;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items, 'summary', summary);
end $$;

-- ---------------------------------------------------------------- admin_list_audit_v2
-- p_category: participante | consentimento | revelacao | admin | pagamento | null. Linhas antigas sem actor_role/alvo recebem
-- o valor derivado na leitura (a trilha é imutável).
create function public.audit_category_pattern(p_category text) returns text
language sql immutable set search_path = '' as $$
  select case p_category
    when 'participante' then '^(participant|invitation)\.'
    when 'consentimento' then '^(consent|account)\.'
    when 'revelacao' then '^reveal\.'
    when 'admin' then '^(admin|platform_role|platform_settings|feature_flags|plan|entitlement|audit|code|system|retention|event)\.|^photo\.access'
    when 'pagamento' then '^(payment|apply)\.'
  end
$$;

create function public.admin_list_audit_v2(p_limit int default 50, p_offset int default 0, p_category text default null,
                                           p_event uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        re text := public.audit_category_pattern(p_category);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_category is not null and re is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs a where (re is null or a.action ~ re) and (p_event is null or a.event_id = p_event)),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'actorId', a.actor_id,
        'actorRole', coalesce(a.actor_role, public.audit_actor_role_for(a.actor_id, a.event_id)),
        'eventId', a.event_id, 'action', a.action,
        'targetType', coalesce(a.target_type, case when a.target_id is null and a.event_id is not null then 'event' end),
        'targetId', coalesce(a.target_id, case when a.target_type is null and a.event_id is not null then a.event_id::text end),
        'reason', a.reason, 'eventTitle', e.title,
        'sensitive', a.reason is not null
                     or a.action ~ '^(admin\.|platform_role\.|platform_settings\.|feature_flags\.|plan\.updated|entitlement\.courtesy|payment\.refund|photo\.access|audit\.)')
        order by a.at desc, a.id desc), '[]')
      from (select * from public.audit_logs l where (re is null or l.action ~ re) and (p_event is null or l.event_id = p_event)
             order by l.at desc, l.id desc limit lim offset off) a
      left join public.events e on e.id = a.event_id));
end $$;

-- ---------------------------------------------------------------- admin_health_history
create function public.admin_health_history(p_limit int default 24) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 24), 1), 100); jobs jsonb := '[]'; cron_ok boolean := to_regclass('cron.job') is not null;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if cron_ok then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
          'name', j.jobname, 'schedule', j.schedule, 'active', j.active, 'runs', coalesce(r.runs, '[]'::jsonb),
          'consecutiveFailures', (select count(*) from cron.job_run_details d
                                   where d.jobid = j.jobid and d.status = 'failed'
                                     and d.start_time > coalesce((select max(s.start_time) from cron.job_run_details s
                                                                   where s.jobid = j.jobid and s.status = 'succeeded'), '-infinity'::timestamptz)))
        order by j.jobname), '[]')
        from cron.job j
        left join lateral (
          select jsonb_agg(jsonb_build_object('startedAt', d.start_time,
                                              'durationMs', (extract(epoch from d.end_time - d.start_time) * 1000)::bigint,
                                              'status', d.status) order by d.start_time desc) as runs
            from (select * from cron.job_run_details x where x.jobid = j.jobid order by x.start_time desc limit $1) d) r on true
       where j.jobname like 'mm-%'
    $q$ into jobs using lim;
  end if;
  return jsonb_build_object('cronAvailable', cron_ok, 'jobs', jobs);
end $$;

-- ---------------------------------------------------------------- ações sensíveis (só master, motivo, admin_log)
create function public.admin_reveal_now(p_event uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; ev public.events;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into ev from public.events where id = p_event for update;
  if not found or ev.deleted_at is not null or not ev.reveal_enabled then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ev.revealed_at is not null then raise exception 'revealed' using errcode = 'MM008'; end if;
  if not public.release_reveal(ev.id, now(), 'admin') then raise exception 'revealed' using errcode = 'MM008'; end if;
  perform public.admin_log('admin.reveal_now', 'event', ev.id::text, why, ev.id);
  return jsonb_build_object('ok', true, 'eventId', ev.id, 'revealedAt', now());
end $$;

-- marca (admin.set_test_flag) ou desmarca (admin.unset_test_flag) eventos; um registro de auditoria por evento alterado
create function public.admin_set_test_flag(p_events uuid[], p_value boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; r record; n int := 0;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_value is null or p_events is null or cardinality(p_events) = 0 or cardinality(p_events) > 500 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if exists (select 1 from unnest(p_events) x(id) where x.id is null or not exists (select 1 from public.events e where e.id = x.id)) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  for r in select e.id from public.events e where e.id = any (p_events) and e.is_test is distinct from p_value order by e.id for update loop
    update public.events set is_test = p_value where id = r.id;
    perform public.admin_log(case when p_value then 'admin.set_test_flag' else 'admin.unset_test_flag' end, 'event', r.id::text, why, r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;

-- Exclusão em lote só de eventos is_test, e só lógica (deleted_at): a retenção existente (purge_deleted_events) conclui
-- depois de 30 dias, como para qualquer evento excluído. Lote com algum evento real é recusado inteiro (MM005).
create function public.admin_soft_delete_test_events(p_events uuid[], p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; r record; n int := 0;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_events is null or cardinality(p_events) = 0 or cardinality(p_events) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform 1 from public.events e where e.id = any (p_events) order by e.id for update;
  if exists (select 1 from unnest(p_events) x(id) where x.id is null or not exists (select 1 from public.events e where e.id = x.id)) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if exists (select 1 from public.events e where e.id = any (p_events) and not e.is_test) then
    raise exception 'nottest' using errcode = 'MM005';
  end if;
  for r in select e.id from public.events e where e.id = any (p_events) and e.deleted_at is null order by e.id loop
    update public.events set deleted_at = now() where id = r.id and is_test;
    perform public.admin_log('admin.soft_delete_test_events', 'event', r.id::text, why, r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'deleted', n);
end $$;

-- ---------------------------------------------------------------- órfãos anônimos (rotina, não RPC)
-- Conta anônima criada há mais de 7 dias que nunca entrou em evento (sem linha em participants), não hospeda evento e não
-- tem papel de plataforma. Audita só a contagem (system.anon_orphans_purged).
create function public.purge_anon_orphans() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with gone as (
    delete from auth.users u
     where coalesce(u.is_anonymous, false) and u.created_at < now() - interval '7 days'
       and not exists (select 1 from public.participants p where p.user_id = u.id)
       and not exists (select 1 from public.events e where e.host_id = u.id)
       and not exists (select 1 from public.platform_roles r where r.user_id = u.id)
    returning u.id
  )
  select count(*) into n from gone;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (null, 'sistema', 'system.anon_orphans_purged', 'auth.users', 'anonymous',
          jsonb_build_object('count', n, 'olderThanDays', 7, 'ran_at', now()));
  return n;
end $$;

-- diária, criada INATIVA: o operador liga com `select cron.alter_job(jobid, active := true)` depois de revisar o volume
do $$
declare jid bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível: mm-purge-anon-orphans não criado (agende purge_anon_orphans() por outro meio)';
    return;
  end if;
  jid := cron.schedule('mm-purge-anon-orphans', '41 4 * * *', 'select public.purge_anon_orphans()');
  perform cron.alter_job(job_id := jid, active := false);
end $$;

-- ---------------------------------------------------------------- privilégios
-- internas: ninguém além do dono (trigger, rotina e auxiliares); purge_anon_orphans também para service_role (como reveal_due_events)
revoke execute on function public.is_test_guard(), public.console_backfill_test_flags(), public.audit_actor_role_for(uuid, uuid),
  public.audit_logs_fill(), public.release_reveal(uuid, timestamptz, text), public.audit_category_pattern(text),
  public.purge_anon_orphans()
  from public, anon, authenticated, service_role;
grant execute on function public.purge_anon_orphans() to service_role;

revoke execute on function
  public.admin_overview(int, boolean), public.admin_list_events_v2(int, int, text, text, boolean, text, text),
  public.admin_event_detail(uuid), public.admin_search(text), public.admin_list_users_v2(int, int, text, boolean, text),
  public.admin_list_audit_v2(int, int, text, uuid), public.admin_storage_breakdown(), public.admin_health_history(int),
  public.admin_reveal_now(uuid, text), public.admin_set_test_flag(uuid[], boolean, text), public.admin_soft_delete_test_events(uuid[], text)
  from public, anon;
grant execute on function
  public.admin_overview(int, boolean), public.admin_list_events_v2(int, int, text, text, boolean, text, text),
  public.admin_event_detail(uuid), public.admin_search(text), public.admin_list_users_v2(int, int, text, boolean, text),
  public.admin_list_audit_v2(int, int, text, uuid), public.admin_storage_breakdown(), public.admin_health_history(int),
  public.admin_reveal_now(uuid, text), public.admin_set_test_flag(uuid[], boolean, text), public.admin_soft_delete_test_events(uuid[], text)
  to authenticated;
