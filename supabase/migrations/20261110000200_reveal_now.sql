-- Revela 2.0 · "Revelar agora": UM caminho só, para o anfitrião (17c) e para o Master (M08). ADITIVA (create function / create or replace).
-- Erros: MM004 forbidden (nem anfitrião deste evento nem master) · MM005 invalid (evento inexistente/excluído/sem revelação ligada)
--        MM008 revealed (já revelado) · MM011 reasonrequired (master sem motivo de 10 a 500 caracteres).
-- A revelação em si continua no ponto único release_reveal (atualiza o evento, grava reveal.released e enfileira o e-mail uma vez só).
create function public.reveal_now(p_event uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ev public.events; by_host boolean; by_master boolean; why text; moment timestamptz := now();
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  by_master := public.is_master();
  select * into ev from public.events where id = p_event for update;
  if not found then
    if by_master then raise exception 'invalid' using errcode = 'MM005'; end if;
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  by_host := ev.host_id = uid;
  if not (by_host or by_master) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if ev.deleted_at is not null or not ev.reveal_enabled then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ev.revealed_at is not null then raise exception 'revealed' using errcode = 'MM008'; end if;
  -- anfitrião: motivo opcional; master (que não é o anfitrião): motivo obrigatório, como em toda ação sensível da equipe
  why := case when by_host then nullif(left(btrim(coalesce(p_reason, '')), 500), '') else public.admin_reason(p_reason) end;
  if not public.release_reveal(ev.id, moment, case when by_host then 'anfitriao' else 'admin' end) then raise exception 'revealed' using errcode = 'MM008'; end if;
  if by_host then
    insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
    values (uid, 'organizador', ev.id, 'reveal.now', 'event', ev.id::text, why, jsonb_build_object('at', moment));
  else
    perform public.admin_log('admin.reveal_now', 'event', ev.id::text, why, ev.id);
  end if;
  return jsonb_build_object('ok', true, 'eventId', ev.id, 'revealedAt', moment);
end $$;

-- Mesma assinatura de antes; agora só confere o papel de master, valida o motivo e delega ao caminho único.
create or replace function public.admin_reveal_now(p_event uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return public.reveal_now(p_event, public.admin_reason(p_reason));
end $$;

revoke all on function public.reveal_now(uuid, text) from public, anon;
grant execute on function public.reveal_now(uuid, text) to authenticated;
