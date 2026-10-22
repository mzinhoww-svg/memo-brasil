-- MemoriesMT · COM-003 (RV-M-01/02) · limites de plano impostos pelo servidor e tolerância de lotação. ADITIVA.
-- Recria events_guard, join_event e event_preview a partir da versão vigente (schema 0100, rls_and_rpcs 0200,
-- security_hardening 0700), mudando só o necessário.
--
-- Códigos de erro de domínio (SQLSTATE próprio), lista atualizada:
--   MM001 shotlimitreached · MM002 eventended · MM003 capacityfull · MM004 forbidden · MM005 invalid
--   MM006 ratelimited · MM007 invalidinvite · MM008 revealed · MM009 reopenforbidden/último master
--   MM010 imutável (auditoria/histórico) · MM011 reasonrequired · MM012 notentitled (limite acima do plano efetivo)
--   MM090 entitlementunavailable (effective_entitlement sem direito nem plano grátis: falha fechada)
--
-- Quem passa pela checagem MM012 (chamador "privilegiado" de events_guard, critério inalterado:
-- current_user not in ('authenticated', 'anon')):
--   * service_role (Edge Functions/servidor com a chave de serviço);
--   * o dono das funções (postgres) — inclui toda RPC SECURITY DEFINER, que roda como o dono: é por elas que as
--     tasks de pagamento/cortesia (4, 7, 7A) sobem capacity/shots_per_person depois de gravar o direito;
--   * migrations e superusuários (supabase_admin).
-- authenticated (anfitrião, inclusive sessão anônima) e anon sempre passam pela checagem.

-- ---------------------------------------------------------------- tolerância de lotação
-- capacity_grace_pct vem de platform_settings (alterável no Master sem deploy, D4). Ausente, não numérico ou negativo
-- vale 0 (sem folga: falha fechada para a lotação). Devolve quantas vagas extras a capacidade ganha.
create function public.capacity_grace_slots(p_capacity int) returns int
language sql stable security definer set search_path = '' as $$
  select case when p_capacity is null then 0 else ceil(p_capacity * coalesce(
    (select greatest((s.value #>> '{}')::numeric, 0) from public.platform_settings s
      where s.key = 'capacity_grace_pct' and jsonb_typeof(s.value) = 'number'), 0) / 100.0)::int end
$$;
revoke execute on function public.capacity_grace_slots(int) from public, anon, authenticated, service_role;
grant execute on function public.capacity_grace_slots(int) to service_role;

-- ---------------------------------------------------------------- eventos: integridade, autoridade do servidor e plano
create or replace function public.events_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  privileged boolean := current_user not in ('authenticated', 'anon');
  was_revealed boolean;
  new_end timestamptz := public.event_end(new.start_at, new.duration_hours, new.ended_at);
  ev_id uuid;
  cap_changed boolean := false;
  shots_changed boolean := false;
  ent record;
begin
  -- COM-003: limites do plano efetivo. Só confere o campo cujo valor mudou (sempre no INSERT): editar outros campos de
  -- um evento que ficou acima do plano (por exemplo, depois de um estorno) nunca é bloqueado.
  if not privileged then
    if tg_op = 'INSERT' then
      ev_id := new.id; cap_changed := true; shots_changed := true;
    else
      ev_id := old.id;
      cap_changed := new.capacity is distinct from old.capacity;
      shots_changed := new.shots_per_person is distinct from old.shots_per_person;
    end if;
    if cap_changed or shots_changed then
      select * into ent from public.effective_entitlement(ev_id); -- uma linha ou MM090
      if tg_op = 'INSERT' then
        -- evento novo ainda não tem direito: o efetivo é o grátis. Sem limite informado, nasce com o do grátis.
        new.capacity := coalesce(new.capacity, ent.max_guests);
        new.shots_per_person := coalesce(new.shots_per_person, ent.max_shots);
      end if;
      if cap_changed and ent.max_guests is not null and (new.capacity is null or new.capacity > ent.max_guests) then
        raise exception 'notentitled' using errcode = 'MM012';
      end if;
      if shots_changed and ent.max_shots is not null and (new.shots_per_person is null or new.shots_per_person > ent.max_shots) then
        raise exception 'notentitled' using errcode = 'MM012';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.version := 1; new.created_at := now(); new.updated_at := now();
    if not privileged then new.revealed_at := null; new.deleted_at := null; end if;
    if new.reveal_enabled and new.reveal_anchor = 'fim' then
      new.reveal_at := new_end + new.reveal_offset_days * interval '1 day';
    end if;
    if not new.reveal_enabled then new.reveal_at := null; end if;
    new.reveal_status := case when not new.reveal_enabled then 'desativada' else 'pendente' end;
    return new;
  end if;

  -- imutáveis para o cliente
  if not privileged then
    new.host_id := old.host_id; new.created_at := old.created_at; new.code := old.code; new.deleted_at := old.deleted_at;
    new.revealed_at := old.revealed_at; new.reveal_status := old.reveal_status;
  end if;
  if new.revealed_at is distinct from old.revealed_at and old.revealed_at is not null then
    new.revealed_at := old.revealed_at; -- monotônico: nunca volta a null (BG-102)
  end if;

  was_revealed := old.reveal_enabled and (old.revealed_at is not null or now() >= old.reveal_at);
  -- ligar a revelação com fotos já visíveis esconderia o que já foi visto (regra canEditReveal do domínio)
  if not old.reveal_enabled and new.reveal_enabled and exists (select 1 from public.photos p where p.event_id = old.id and p.status <> 'removida') then
    raise exception 'revealed' using errcode = 'MM008';
  end if;
  if was_revealed and (new.reveal_enabled is distinct from old.reveal_enabled or new.reveal_at is distinct from old.reveal_at
      or new.reveal_anchor is distinct from old.reveal_anchor or new.reveal_offset_days is distinct from old.reveal_offset_days) then
    raise exception 'revealed' using errcode = 'MM008'; -- não esconde de novo o que já foi visto
  end if;

  -- álbum encerrado com fotos não reabre (AC-11)
  if now() >= public.event_end(old.start_at, old.duration_hours, old.ended_at) and new_end > public.event_end(old.start_at, old.duration_hours, old.ended_at)
     and exists (select 1 from public.photos p where p.event_id = old.id and p.status <> 'removida') then
    raise exception 'reopenforbidden' using errcode = 'MM009';
  end if;

  if new.reveal_enabled and not was_revealed then
    if new.reveal_anchor = 'fim' then
      new.reveal_at := new_end + new.reveal_offset_days * interval '1 day'; -- relativo ao fim: o servidor recalcula (BG-101)
    elsif new.reveal_at is distinct from old.reveal_at and new.reveal_at < now() + interval '1 minute' then
      raise exception 'invalid' using errcode = 'MM005';
    end if;
  end if;
  if not new.reveal_enabled then new.reveal_at := null; end if;
  if privileged then null; else
    new.reveal_status := case when not new.reveal_enabled then 'desativada' when new.revealed_at is not null then 'revelada' else 'pendente' end;
  end if;

  if new.reveal_at is distinct from old.reveal_at or new.reveal_enabled is distinct from old.reveal_enabled then
    perform public.audit(old.id, 'reveal.configured', jsonb_build_object('enabled', new.reveal_enabled, 'at', new.reveal_at, 'anchor', new.reveal_anchor));
  end if;
  new.version := old.version + 1; new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- entrada na festa com tolerância de lotação
-- Ninguém é barrado no meio da festa por 1 ou 2 a mais (RV-M-02): recusa só ao esgotar capacity + folga.
-- Passar de capacity grava capacity.grace_used para o anfitrião ser avisado.
create or replace function public.join_event(p_code text, p_name text, p_table text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  e public.events;
  inv public.invitations;
  existing public.participants;
  clean text := btrim(coalesce(p_name, ''));
  n int;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('join:' || uid, 20, interval '10 minutes');
  if clean = '' or char_length(clean) > 40 then raise exception 'invalid' using errcode = 'MM005'; end if;

  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null for update;
  if not found then
    perform public.check_rate_limit('badcode:' || uid, 8, interval '10 minutes'); -- tentativa de adivinhar código
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if e.host_id = uid then return jsonb_build_object('role', 'organizador', 'eventId', e.id); end if;

  select * into existing from public.participants where event_id = e.id and user_id = uid;
  if found then
    if existing.blocked_at is not null then raise exception 'forbidden' using errcode = 'MM004'; end if;
    update public.participants set name = clean, table_label = coalesce(p_table, table_label) where event_id = e.id and user_id = uid;
    return jsonb_build_object('role', 'membro', 'eventId', e.id);
  end if;

  if now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then raise exception 'eventended' using errcode = 'MM002'; end if;
  if e.capacity is not null then
    select count(*) into n from public.participants where event_id = e.id; -- serializado pelo FOR UPDATE do evento
    if n >= e.capacity + public.capacity_grace_slots(e.capacity) then
      raise exception 'capacityfull' using errcode = 'MM003';
    end if;
  end if;

  if p_token is not null then
    select * into inv from public.invitations
      where event_id = e.id and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
    if not found or inv.revoked_at is not null or (inv.expires_at is not null and inv.expires_at < now())
       or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
      perform public.check_rate_limit('badinvite:' || uid, 8, interval '10 minutes');
      raise exception 'invalidinvite' using errcode = 'MM007';
    end if;
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  insert into public.participants (event_id, user_id, name, table_label, invitation_id)
  values (e.id, uid, clean, coalesce(p_table, inv.label), inv.id);
  perform public.audit(e.id, 'participant.joined', jsonb_build_object('user', uid, 'invitation', inv.id));
  if e.capacity is not null and n + 1 > e.capacity then
    perform public.audit(e.id, 'capacity.grace_used', jsonb_build_object('count', n + 1));
  end if;
  return jsonb_build_object('role', 'membro', 'eventId', e.id);
end $$;

-- ---------------------------------------------------------------- prévia do convite
-- Mantém todas as chaves anteriores e acrescenta shotsPerPerson, revealAt, revealStatus, timezone, everyoneSeesAll e
-- planCode (plano efetivo; para direito legado devolve o plan_code do direito como está). 'full' passa a considerar a
-- tolerância: só está lotado quando join_event de fato recusaria.
create or replace function public.event_preview(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare e public.events; n int; t public.event_themes; th jsonb; plan text;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('preview:' || auth.uid(), 120, interval '1 hour');
  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null;
  if not found then return null; end if;
  select count(*) into n from public.participants where event_id = e.id;
  select * into t from public.event_themes where event_id = e.id;
  if found then
    th := jsonb_build_object('preset', t.preset, 'colors', t.colors, 'font', t.font, 'welcomeMessage', t.welcome_message,
                             'qrStyle', t.qr_style, 'decor', t.decor);
  end if;
  select x.plan_code into plan from public.effective_entitlement(e.id) x;
  return jsonb_build_object(
    'code', e.code, 'title', e.title, 'category', e.category, 'hostName', e.host_name, 'startAt', e.start_at, 'place', e.place,
    'palette', e.palette, 'eventFont', e.event_font, 'capacity', e.capacity,
    'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
    'full', e.capacity is not null and n >= e.capacity + public.capacity_grace_slots(e.capacity),
    'theme', th,
    'shotsPerPerson', e.shots_per_person, 'revealAt', e.reveal_at, 'revealStatus', e.reveal_status,
    'timezone', e.timezone, 'everyoneSeesAll', e.everyone_sees_all, 'planCode', plan);
end $$;
revoke execute on function public.event_preview(text) from public, anon;
grant execute on function public.event_preview(text) to authenticated;
