-- Revela 2.0 · Master · Impressões (M29/M30). ADITIVA (coluna nova, funções novas e create or replace; nenhuma linha existente muda).
--
-- * print_orders.seq + print_order_code(): código curto do pedido ("IMP-7K2Q"), único e com cara de aleatório (permutação de 20 bits do número de ordem,
--   alfabeto de 32 símbolos sem 0/1/I/O). Aparece só no Master; a URL do detalhe usa o id.
-- * admin_print_orders: o mesmo contrato, com `code` em cada item e busca também pelo código.
-- * admin_print_order_detail(p_id): contato, endereço, observação, fotos escolhidas SÓ COMO NÚMEROS (posição da foto no evento, nunca id nem URL),
--   histórico de status (com quem mudou e, no cancelamento, o motivo) e a nota interna. Só master (MM004). Pedido inexistente devolve null.
-- * admin_set_print_order_note(p_id, p_note): grava a nota interna (até 500 caracteres). Só master. Auditada sem o conteúdo.
-- * admin_set_print_order_status: mesma regra de ordem (solicitado → em_producao → enviado → entregue; cancelar até o envio). Mudança: o motivo do
--   cancelamento (10 a 500, MM011 fora disso) vai para a auditoria e NÃO sobrescreve mais a nota interna; nas demais mudanças `p_note` continua sendo
--   a nota interna. Acima de 500 caracteres passa a ser MM011 (antes MM005).
-- Erros: MM004 forbidden · MM005 invalid · MM009 estado não permite · MM011 motivo obrigatório.

alter table public.print_orders add column seq bigint generated always as identity;
create unique index print_orders_seq_idx on public.print_orders (seq);

create function public.print_order_code(p_seq bigint) returns text
language sql immutable set search_path = '' as $$
  select 'IMP-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + ((((p_seq * 7919 + 12345) % 1048576) >> s) & 31)::int, 1), '' order by s desc)
    from unnest(array[15, 10, 5, 0]) as s
$$;

create or replace function public.admin_print_orders(p_filter text default null, p_search text default null, p_limit int default 25, p_offset int default 0) returns jsonb
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
        or public.print_order_code(o.seq) ilike pat
  ), f as (select b.* from b where p_filter is null or b.status = p_filter),
  page as (select f.* from f order by f.created_at desc, f.id limit lim offset off)
  select (select count(*) from f),
         (select jsonb_build_object('todos', count(*), 'solicitado', count(*) filter (where status = 'solicitado'), 'em_producao', count(*) filter (where status = 'em_producao'),
                                    'enviado', count(*) filter (where status = 'enviado'), 'entregue', count(*) filter (where status = 'entregue'),
                                    'cancelado', count(*) filter (where status = 'cancelado')) from b),
         coalesce(jsonb_agg(public.print_order_json(row(p.*)::public.print_orders, false)
                            || jsonb_build_object('noteInternal', p.note_internal, 'requesterId', p.requester_id, 'code', public.print_order_code(p.seq))
                            order by p.created_at desc, p.id), '[]'::jsonb)
    into total, counts, items from page p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'counts', counts, 'items', items);
end $$;

create function public.admin_print_order_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o public.print_orders; nums jsonb; sel int; hist jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into o from public.print_orders where id = p_id;
  if not found then return null; end if;
  -- só a posição da foto na galeria do evento (1, 2, 3…): nenhum id, caminho ou URL sai daqui
  with ph as (
    select p.id, row_number() over (order by p.created_at, p.id) as n from public.photos p
     where p.event_id = o.event_id and p.deleted_at is null and p.upload_status = 'pronta'
  ), chosen as (select ph.n from ph where o.all_photos or ph.id = any (o.photo_ids))
  select (select count(*) from chosen), coalesce((select jsonb_agg(c.n order by c.n) from (select n from chosen order by n limit 18) c), '[]'::jsonb) into sel, nums;
  hist := jsonb_build_array(jsonb_build_object('status', 'solicitado', 'at', o.created_at, 'by', o.contact_name))
    || coalesce((select jsonb_agg(jsonb_build_object('status', a.detail ->> 'to', 'at', a.at, 'by', coalesce(nullif(pr.display_name, ''), 'Equipe Revela'),
                                                     'reason', case when a.detail ->> 'to' = 'cancelado' then a.reason end) order by a.at, a.id)
                   from public.audit_logs a left join public.profiles pr on pr.id = a.actor_id
                  where a.target_type = 'print_order' and a.target_id = o.id::text and a.action = 'print_order.status_changed'), '[]'::jsonb);
  return jsonb_build_object(
    'id', o.id, 'code', public.print_order_code(o.seq), 'status', o.status, 'product', o.product, 'quantity', o.quantity,
    'eventId', o.event_id, 'eventTitle', o.event_title, 'requesterKind', o.requester_kind,
    'contactName', o.contact_name, 'contactPhone', o.contact_phone, 'contactEmail', o.contact_email, 'shipping', o.shipping, 'note', o.note,
    'allPhotos', o.all_photos, 'photoCount', sel, 'photoNums', nums, 'history', hist, 'noteInternal', o.note_internal,
    'createdAt', o.created_at, 'updatedAt', o.updated_at);
end $$;

create function public.admin_set_print_order_note(p_id uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare txt text := nullif(btrim(coalesce(p_note, '')), ''); o public.print_orders;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if txt is not null and char_length(txt) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.print_orders set note_internal = txt, updated_at = now(), updated_by = auth.uid() where id = p_id returning * into o;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (auth.uid(), 'master', o.event_id, 'print_order.note_updated', 'print_order', o.id::text, jsonb_build_object('length', coalesce(char_length(txt), 0)));
  return jsonb_build_object('noteInternal', o.note_internal);
end $$;

create or replace function public.admin_set_print_order_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.print_orders; why text := nullif(btrim(coalesce(p_note, '')), ''); old text;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_status not in ('em_producao', 'enviado', 'entregue', 'cancelado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if why is not null and char_length(why) > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  select * into o from public.print_orders where id = p_id for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  old := o.status;
  if not ((old = 'solicitado' and p_status in ('em_producao', 'cancelado')) or (old = 'em_producao' and p_status in ('enviado', 'cancelado'))
          or (old = 'enviado' and p_status = 'entregue')) then
    raise exception 'estado' using errcode = 'MM009';
  end if;
  if p_status = 'cancelado' and (why is null or char_length(why) < 10) then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  update public.print_orders set status = p_status,
         note_internal = case when p_status = 'cancelado' then note_internal else coalesce(why, note_internal) end,
         updated_at = now(), updated_by = auth.uid(),
         production_at = case when p_status = 'em_producao' then now() else production_at end,
         shipped_at = case when p_status = 'enviado' then now() else shipped_at end,
         delivered_at = case when p_status = 'entregue' then now() else delivered_at end,
         cancelled_at = case when p_status = 'cancelado' then now() else cancelled_at end
   where id = p_id returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', o.event_id, 'print_order.status_changed', 'print_order', o.id::text, why, jsonb_build_object('from', old, 'to', p_status));
  return public.print_order_json(o, false) || jsonb_build_object('noteInternal', o.note_internal);
end $$;

revoke all on function public.print_order_code(bigint) from public, anon, authenticated;
revoke all on function public.admin_print_order_detail(uuid), public.admin_set_print_order_note(uuid, text) from public, anon;
grant execute on function public.admin_print_order_detail(uuid), public.admin_set_print_order_note(uuid, text) to authenticated;
