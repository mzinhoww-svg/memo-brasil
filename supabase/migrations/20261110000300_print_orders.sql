-- Revela 2.0 · Pedido de impressão (tela 19b "Revelados-album"), SEM pagamento: cobrança e preço serão definidos depois. ADITIVA.
--
-- print_orders: um pedido de produto impresso de um evento já revelado. Produtos do desenho: 'album' (álbum de capa de linho, até 60 fotos)
--   e 'caixa' (caixa com 30 fotos soltas). Escolha de fotos: lista de ids (só fotos que a pessoa pode ver) ou todas (`all_photos`).
--   Status: solicitado → em_producao → enviado → entregue; cancelado (pelo solicitante/anfitrião só enquanto solicitado; pelo Master até enviar).
-- Privacidade: o contato e o endereço são dados pessoais; ficam só no pedido. Nenhuma foto é copiada. `note_internal` é só do Master.
--   Se o evento ou a conta forem apagados, event_id/requester_id viram null e o pedido continua (produção em curso); o título fica em `event_title`.
-- RLS: anfitrião do evento vê os do próprio evento; quem pediu vê os seus; Master vê todos. A tabela não aceita escrita direta e a coluna
--   `note_internal` não é concedida a `authenticated`: leituras e escritas passam pelas RPCs abaixo.
-- Erros: MM004 forbidden · MM005 invalid · MM006 ratelimited · MM009 estado não permite · MM011 motivo obrigatório.

create table public.print_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events on delete set null,
  event_title text not null default '',
  requester_id uuid references auth.users on delete set null,
  requester_kind text not null check (requester_kind in ('anfitriao', 'convidado')),
  product text not null check (product in ('album', 'caixa')),
  quantity int not null check (quantity between 1 and 10),
  photo_ids uuid[] not null default '{}',
  all_photos boolean not null default false,
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9]{10,13}$'),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  shipping jsonb not null check (jsonb_typeof(shipping) = 'object'),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'solicitado' check (status in ('solicitado', 'em_producao', 'enviado', 'entregue', 'cancelado')),
  note_internal text check (note_internal is null or char_length(note_internal) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  production_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  updated_by uuid,
  check (contact_phone is not null or contact_email is not null),
  check (all_photos or cardinality(photo_ids) between 1 and 60)
);
create index print_orders_event_idx on public.print_orders (event_id, created_at desc);
create index print_orders_requester_idx on public.print_orders (requester_id, created_at desc);
create index print_orders_status_idx on public.print_orders (status, created_at desc);

alter table public.print_orders enable row level security;
create policy print_orders_select on public.print_orders for select to authenticated
  using (requester_id = (select auth.uid()) or (event_id is not null and public.is_host(event_id)) or public.is_master());
revoke all on public.print_orders from anon, authenticated;
grant select (id, event_id, event_title, requester_id, requester_kind, product, quantity, photo_ids, all_photos, contact_name, contact_phone, contact_email,
              shipping, note, status, created_at, updated_at, production_at, shipped_at, delivered_at, cancelled_at) on public.print_orders to authenticated;

-- JSON do pedido para quem pediu / anfitrião (sem nota interna)
create function public.print_order_json(o public.print_orders, p_mine boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'eventId', o.event_id, 'eventTitle', o.event_title, 'product', o.product, 'quantity', o.quantity,
    'photoCount', case when o.all_photos then null else cardinality(o.photo_ids) end, 'allPhotos', o.all_photos,
    'contactName', o.contact_name, 'contactPhone', o.contact_phone, 'contactEmail', o.contact_email, 'shipping', o.shipping,
    'note', o.note, 'status', o.status, 'mine', p_mine, 'requesterKind', o.requester_kind,
    'createdAt', o.created_at, 'updatedAt', o.updated_at, 'shippedAt', o.shipped_at, 'deliveredAt', o.delivered_at, 'cancelledAt', o.cancelled_at)
$$;

-- Criar. Anfitrião ou convidado (não bloqueado) de evento revelado; fotos só as que a pessoa enxerga; limites: 5 pedidos abertos por pessoa e
-- evento, 6 pedidos por hora. `p_id` torna o envio idempotente (duplo clique devolve o mesmo pedido).
create function public.create_print_order(p_id uuid, p_event uuid, p_product text, p_quantity int, p_photo_ids uuid[], p_all_photos boolean,
                                          p_contact_name text, p_contact_phone text, p_contact_email text, p_shipping jsonb, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); ev public.events; host boolean; ids uuid[]; cap int; ok_count int;
  nm text := btrim(coalesce(p_contact_name, '')); ph text := nullif(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9]', '', 'g'), '');
  em text := nullif(lower(btrim(coalesce(p_contact_email, ''))), ''); nt text := nullif(btrim(coalesce(p_note, '')), '');
  sh jsonb; cep text; uf text; existing public.print_orders; o public.print_orders; k text;
begin
  if uid is null or p_id is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
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
  if coalesce(p_all_photos, false) then
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
  values (p_id, p_event, ev.title, uid, case when host then 'anfitriao' else 'convidado' end, p_product, p_quantity, ids, coalesce(p_all_photos, false),
          nm, ph, em, sh, nt, uid)
  returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (uid, case when host then 'organizador' else 'convidado' end, p_event, 'print_order.created', 'print_order', o.id::text,
          jsonb_build_object('product', p_product, 'quantity', p_quantity, 'photos', case when o.all_photos then null else cardinality(ids) end, 'allPhotos', o.all_photos));
  return public.print_order_json(o, true);
end $$;

-- Meus pedidos (e, para o anfitrião, os de todo o evento). p_event nulo = todos os meus + os dos eventos que eu organizo.
create function public.list_my_print_orders(p_event uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return coalesce((select jsonb_agg(public.print_order_json(o, o.requester_id = uid) order by o.created_at desc, o.id)
                     from (select * from public.print_orders x
                            where (p_event is null or x.event_id = p_event)
                              and (x.requester_id = uid or (x.event_id is not null and public.is_host(x.event_id)))
                            order by x.created_at desc, x.id limit 100) o), '[]'::jsonb);
end $$;

-- Cancelar: quem pediu ou o anfitrião do evento, só enquanto 'solicitado'
create function public.cancel_print_order(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); o public.print_orders;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into o from public.print_orders where id = p_id for update;
  if not found or not (o.requester_id = uid or (o.event_id is not null and public.is_host(o.event_id))) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if o.status = 'cancelado' then return public.print_order_json(o, o.requester_id = uid); end if;
  if o.status <> 'solicitado' then raise exception 'estado' using errcode = 'MM009'; end if;
  update public.print_orders set status = 'cancelado', cancelled_at = now(), updated_at = now(), updated_by = uid where id = p_id returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (uid, case when o.event_id is not null and public.is_host(o.event_id) then 'organizador' else 'convidado' end, o.event_id,
          'print_order.cancelled', 'print_order', o.id::text, '{}');
  return public.print_order_json(o, o.requester_id = uid);
end $$;

-- Master: lista com filtro de status, busca (contato, e-mail, telefone, evento, id), contagens por status e paginação
create function public.admin_print_orders(p_filter text default null, p_search text default null, p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        total bigint; counts jsonb; items jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_filter is not null and p_filter not in ('solicitado', 'em_producao', 'enviado', 'entregue', 'cancelado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  with b as (
    select o.* from public.print_orders o
     where pat is null or o.contact_name ilike pat or o.contact_email ilike pat or o.contact_phone ilike pat or o.event_title ilike pat or o.id::text ilike pat
  ), f as (select b.* from b where p_filter is null or b.status = p_filter),
  page as (select f.* from f order by f.created_at desc, f.id limit lim offset off)
  select (select count(*) from f),
         (select jsonb_build_object('todos', count(*), 'solicitado', count(*) filter (where status = 'solicitado'), 'em_producao', count(*) filter (where status = 'em_producao'),
                                    'enviado', count(*) filter (where status = 'enviado'), 'entregue', count(*) filter (where status = 'entregue'),
                                    'cancelado', count(*) filter (where status = 'cancelado')) from b),
         coalesce(jsonb_agg(public.print_order_json(row(p.*)::public.print_orders, false) || jsonb_build_object('noteInternal', p.note_internal, 'requesterId', p.requester_id)
                            order by p.created_at desc, p.id), '[]'::jsonb)
    into total, counts, items from page p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'counts', counts, 'items', items);
end $$;

-- Master: muda o status (para frente, ou cancela até o envio) e grava a nota interna. Cancelar exige motivo (10 a 500). Auditado.
create function public.admin_set_print_order_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.print_orders; why text := nullif(btrim(coalesce(p_note, '')), ''); old text;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_status not in ('em_producao', 'enviado', 'entregue', 'cancelado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if why is not null and char_length(why) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into o from public.print_orders where id = p_id for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  old := o.status;
  if not ((old = 'solicitado' and p_status in ('em_producao', 'cancelado')) or (old = 'em_producao' and p_status in ('enviado', 'cancelado'))
          or (old = 'enviado' and p_status = 'entregue')) then
    raise exception 'estado' using errcode = 'MM009';
  end if;
  if p_status = 'cancelado' and (why is null or char_length(why) < 10) then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  update public.print_orders set status = p_status, note_internal = coalesce(why, note_internal), updated_at = now(), updated_by = auth.uid(),
         production_at = case when p_status = 'em_producao' then now() else production_at end,
         shipped_at = case when p_status = 'enviado' then now() else shipped_at end,
         delivered_at = case when p_status = 'entregue' then now() else delivered_at end,
         cancelled_at = case when p_status = 'cancelado' then now() else cancelled_at end
   where id = p_id returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', o.event_id, 'print_order.status_changed', 'print_order', o.id::text, why, jsonb_build_object('from', old, 'to', p_status));
  return public.print_order_json(o, false) || jsonb_build_object('noteInternal', o.note_internal);
end $$;

revoke all on function public.print_order_json(public.print_orders, boolean) from public, anon, authenticated;
revoke all on function public.create_print_order(uuid, uuid, text, int, uuid[], boolean, text, text, text, jsonb, text),
  public.list_my_print_orders(uuid), public.cancel_print_order(uuid), public.admin_print_orders(text, text, int, int),
  public.admin_set_print_order_status(uuid, text, text) from public, anon;
grant execute on function public.create_print_order(uuid, uuid, text, int, uuid[], boolean, text, text, text, jsonb, text),
  public.list_my_print_orders(uuid), public.cancel_print_order(uuid), public.admin_print_orders(text, text, int, int),
  public.admin_set_print_order_status(uuid, text, text) to authenticated;
