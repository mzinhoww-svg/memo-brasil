-- Correções das pistas S9 da auditoria (13, 14, 15, 18). ADITIVA.
--
-- 13 · finalize_photo aceitava finalizar um upload expirado ('falhou'): somado aos slots liberados pela expiração, passava do
--      limite de poses por pessoa. Agora só finaliza o que ainda está 'enviando' (falhou = a pessoa envia de novo).
-- 14 · pedido de impressão "todas as fotos" de um convidado não passava pela visibilidade por foto: passa a virar a lista das fotos
--      que ELE pode ver (all_photos = false). O anfitrião continua com "todas".
-- 15 · purge_deleted_events deixou de enfileirar logo/capa (event-branding) na última reescrita: os arquivos de eventos apagados
--      ficavam no Storage. Volta a enfileirar, mantendo a retenção de 28/30 dias.
-- 18 · o relógio de retenção sai de start_at, que o organizador edita: agora start_at não pode passar de 400 dias da criação do
--      evento, o que limita quanto ele consegue empurrar o prazo de apagamento das fotos.

create or replace function public.finalize_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ph public.photos; obj record;
begin
  select * into ph from public.photos where id = p_id for update;
  if not found or ph.author_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform 1 from public.participants where event_id = ph.event_id and user_id = auth.uid() for share;
  if exists(select 1 from public.participants where event_id = ph.event_id and user_id = auth.uid() and blocked_at is not null) then
    raise exception 'blocked' using errcode = 'MM015';
  end if;
  if not (public.is_host(ph.event_id) or public.is_member(ph.event_id)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if ph.upload_status = 'pronta' then return jsonb_build_object('id', ph.id, 'uploadStatus', 'pronta'); end if;
  if ph.upload_status <> 'enviando' then raise exception 'invalid' using errcode = 'MM005'; end if; -- 'falhou' expirou e já liberou a vaga
  select (metadata ->> 'size')::int as size, metadata ->> 'mimetype' as mime into obj from storage.objects
    where bucket_id = 'event-photos' and name = ph.storage_path;
  if not found or obj.size is null or obj.size <= 0 or obj.size > 8388608 or obj.mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.photos set upload_status = 'pronta', mime = obj.mime, bytes = obj.size, version = version + 1 where id = p_id; -- trigger ignora campos do cliente; este UPDATE roda como dono
  return jsonb_build_object('id', ph.id, 'uploadStatus', 'pronta');
end $$;

create or replace function public.create_print_order(p_id uuid, p_event uuid, p_product text, p_quantity integer, p_photo_ids uuid[], p_all_photos boolean, p_contact_name text, p_contact_phone text, p_contact_email text, p_shipping jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  allp boolean; uid uuid := auth.uid(); ev public.events; host boolean; ids uuid[]; cap int; ok_count int;
  nm text := btrim(coalesce(p_contact_name, '')); ph text := nullif(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9]', '', 'g'), '');
  em text := nullif(lower(btrim(coalesce(p_contact_email, ''))), ''); nt text := nullif(btrim(coalesce(p_note, '')), '');
  sh jsonb; cep text; uf text; existing public.print_orders; o public.print_orders; k text;
begin
  if uid is null or p_id is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.printed_album_enabled() then raise exception 'forbidden' using errcode = 'MM004'; end if; -- álbum impresso desligado (chave printed_album)
  select * into existing from public.print_orders where id = p_id;
  if found then
    if existing.requester_id is distinct from uid then raise exception 'forbidden' using errcode = 'MM004'; end if;
    return public.print_order_json(existing, true);
  end if;
  select * into ev from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
  host := ev.host_id = uid;
  if not (host or public.is_member(p_event)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.is_revealed(p_event) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('print:' || uid, 6, interval '1 hour');
  if (select count(*) from public.print_orders x where x.requester_id = uid and x.event_id = p_event and x.status = 'solicitado') >= 5 then
    raise exception 'ratelimited' using errcode = 'MM006';
  end if;

  if p_product not in ('album', 'caixa') or p_quantity is null or p_quantity < 1 or p_quantity > 10 then raise exception 'invalid' using errcode = 'MM005'; end if;
  cap := case p_product when 'album' then 60 else 30 end;
  allp := coalesce(p_all_photos, false);
  if allp and not host then
    -- convidado: "todas" = as fotos que ele pode ver (nunca ocultas, removidas nem de outros quando a visibilidade é só das próprias)
    select coalesce(array_agg(ph2.id order by ph2.created_at), '{}') into ids from public.photos ph2
     where ph2.event_id = p_event and ph2.upload_status = 'pronta' and ph2.deleted_at is null and public.can_see_photo(ph2.id);
    if cardinality(ids) < 1 then raise exception 'invalid' using errcode = 'MM005'; end if;
    allp := false;
  elsif allp then
    ids := '{}';
  else
    select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_photo_ids, '{}')) x;
    if cardinality(ids) < 1 or cardinality(ids) > cap then raise exception 'invalid' using errcode = 'MM005'; end if;
    select count(*) into ok_count from public.photos ph2
     where ph2.id = any (ids) and ph2.event_id = p_event and ph2.upload_status = 'pronta' and ph2.deleted_at is null and public.can_see_photo(ph2.id);
    if ok_count <> cardinality(ids) then raise exception 'invalid' using errcode = 'MM005'; end if;
  end if;

  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ph is not null and (char_length(ph) < 10 or char_length(ph) > 13) then raise exception 'invalid' using errcode = 'MM005'; end if;
  if em is not null and (char_length(em) > 254 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ph is null and em is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  if nt is not null and char_length(nt) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;

  if p_shipping is null or jsonb_typeof(p_shipping) <> 'object' then raise exception 'invalid' using errcode = 'MM005'; end if;
  for k in select jsonb_object_keys(p_shipping) loop
    if k not in ('cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state') then raise exception 'invalid' using errcode = 'MM005'; end if;
  end loop;
  cep := regexp_replace(coalesce(p_shipping ->> 'cep', ''), '[^0-9]', '', 'g');
  uf := upper(btrim(coalesce(p_shipping ->> 'state', '')));
  if cep !~ '^[0-9]{8}$' or uf !~ '^[A-Z]{2}$'
     or char_length(btrim(coalesce(p_shipping ->> 'street', ''))) not between 3 and 120
     or char_length(btrim(coalesce(p_shipping ->> 'number', ''))) not between 1 and 20
     or char_length(btrim(coalesce(p_shipping ->> 'complement', ''))) > 60
     or char_length(btrim(coalesce(p_shipping ->> 'neighborhood', ''))) not between 2 and 80
     or char_length(btrim(coalesce(p_shipping ->> 'city', ''))) not between 2 and 80 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  sh := jsonb_build_object('cep', cep, 'street', btrim(p_shipping ->> 'street'), 'number', btrim(p_shipping ->> 'number'),
                           'complement', nullif(btrim(coalesce(p_shipping ->> 'complement', '')), ''), 'neighborhood', btrim(p_shipping ->> 'neighborhood'),
                           'city', btrim(p_shipping ->> 'city'), 'state', uf);

  insert into public.print_orders (id, event_id, event_title, requester_id, requester_kind, product, quantity, photo_ids, all_photos,
                                   contact_name, contact_phone, contact_email, shipping, note, updated_by)
  values (p_id, p_event, ev.title, uid, case when host then 'anfitriao' else 'convidado' end, p_product, p_quantity, ids, allp,
          nm, ph, em, sh, nt, uid)
  returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (uid, case when host then 'organizador' else 'convidado' end, p_event, 'print_order.created', 'print_order', o.id::text,
          jsonb_build_object('product', p_product, 'quantity', p_quantity, 'photos', case when o.all_photos then null else cardinality(ids) end, 'allPhotos', o.all_photos));
  return public.print_order_json(o, true);
end $function$;

create or replace function public.purge_deleted_events() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.storage_purge_queue (path)
    select ph.storage_path from public.photos ph join public.events e on e.id = ph.event_id
      where e.deleted_at < now() - interval '30 days' or (e.retention_policy is not null and e.deleted_at < now() - interval '28 days')
    union all
    select ph.storage_path || '.thumb' from public.photos ph join public.events e on e.id = ph.event_id
      where e.deleted_at < now() - interval '30 days' or (e.retention_policy is not null and e.deleted_at < now() - interval '28 days')
  on conflict do nothing;
  insert into public.storage_purge_queue (path, bucket)
    select a.storage_path, 'event-branding' from public.event_assets a join public.events e on e.id = a.event_id
      where e.deleted_at < now() - interval '30 days' or (e.retention_policy is not null and e.deleted_at < now() - interval '28 days')
  on conflict do nothing;
  with gone as (
    delete from public.events where deleted_at < now() - interval '30 days' or (retention_policy is not null and deleted_at < now() - interval '28 days') returning id
  ) select count(*) into n from gone;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

create or replace function public.events_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  privileged boolean := current_user not in ('authenticated', 'anon');
  was_revealed boolean;
  new_end timestamptz := public.event_end(new.start_at, new.duration_hours, new.ended_at);
  ev_id uuid;
  cap_up boolean := false;
  shots_up boolean := false;
  ent record;
begin
  -- COM-003: limites do plano efetivo. No INSERT confere sempre; no UPDATE só o campo que AUMENTA (ou vira null = sem
  -- limite) em relação ao valor antigo. Editar outros campos ou reduzir um limite de um evento que ficou acima do plano
  -- (por exemplo, depois de um estorno: 100 → 90 no grátis) nunca é bloqueado (ruling 7).
  if not privileged then
    if tg_op = 'INSERT' then
      ev_id := new.id; cap_up := true; shots_up := true;
    else
      ev_id := old.id;
      -- old null (sem limite, ex.: legado) não é "acima de tudo" para liberar qualquer número: trocar null por um valor
      -- conta como subir e o valor novo precisa caber no plano. Null → null não muda o limite e não é conferido.
      cap_up := new.capacity is distinct from old.capacity
        and (new.capacity is null or old.capacity is null or new.capacity > old.capacity);
      shots_up := new.shots_per_person is distinct from old.shots_per_person
        and (new.shots_per_person is null or old.shots_per_person is null or new.shots_per_person > old.shots_per_person);
    end if;
    if cap_up or shots_up then
      select * into ent from public.effective_entitlement(ev_id); -- uma linha ou MM090
      if tg_op = 'INSERT' then
        -- evento novo ainda não tem direito: o efetivo é o grátis. Sem limite informado, nasce com o do grátis.
        new.capacity := coalesce(new.capacity, ent.max_guests);
        new.shots_per_person := coalesce(new.shots_per_person, ent.max_shots);
      end if;
      if cap_up and ent.max_guests is not null and (new.capacity is null or new.capacity > ent.max_guests) then
        raise exception 'notentitled' using errcode = 'MM012';
      end if;
      if shots_up and ent.max_shots is not null and (new.shots_per_person is null or new.shots_per_person > ent.max_shots) then
        raise exception 'notentitled' using errcode = 'MM012';
      end if;
    end if;
  end if;

  -- relógio de retenção: start_at não pode ir além de 400 dias da criação (o organizador não empurra o prazo de apagamento)
  if not privileged and (tg_op = 'INSERT' or new.start_at is distinct from old.start_at)
     and new.start_at > coalesce(old.created_at, now()) + interval '400 days' then
    raise exception 'invalid' using errcode = 'MM005';
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
