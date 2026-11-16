-- Avisos por WhatsApp · pedir o aviso já no formulário de entrada (antes de virar participante). ADITIVA.
--
-- O convidado digita o WhatsApp no lugar do e-mail. Para o toque em "Aceitar" abrir o WhatsApp NA HORA (sem esperar rede), o código do
-- gateway e o token de volta são preparados enquanto ele preenche o formulário, ainda sem ser participante. Garantias:
--   * whatsapp_prejoin_event: só evento existente, não excluído, ainda não revelado, com o recurso ligado; nunca para o anfitrião nem para
--     quem foi bloqueado no evento.
--   * O opt-in só é aplicado se a pessoa de fato entrar: whatsapp_apply_event continua exigindo participante (sem participante =
--     unknown_subject) e a troca do token de volta (whatsapp_consume_return_token) também.
--   * whatsapp_return_tokens deixa de exigir participante na criação (FK para evento e usuário); a troca continua exigindo.

alter table public.whatsapp_return_tokens drop constraint if exists whatsapp_return_tokens_event_id_user_id_fkey;
alter table public.whatsapp_return_tokens
  add constraint whatsapp_return_tokens_event_fkey foreign key (event_id) references public.events on delete cascade,
  add constraint whatsapp_return_tokens_user_fkey foreign key (user_id) references auth.users on delete cascade;
create index if not exists whatsapp_return_tokens_user_idx on public.whatsapp_return_tokens (event_id, user_id);

create or replace function public.whatsapp_issue_return_token(p_event uuid, p_user uuid, p_hash text, p_ttl_minutes int default 120) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_ttl_minutes is null or p_ttl_minutes not between 5 and 1440 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if not exists (select 1 from public.events where id = p_event and deleted_at is null)
     or exists (select 1 from public.participants where event_id = p_event and user_id = p_user and blocked_at is not null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  delete from public.whatsapp_return_tokens where expires_at < now() - interval '1 day';
  insert into public.whatsapp_return_tokens (token_hash, event_id, user_id, expires_at)
  values (p_hash, p_event, p_user, now() + make_interval(mins => p_ttl_minutes));
end $$;

-- {status: ok|disabled|forbidden|not_found, eventId?}: pode preparar o aviso antes de entrar?
create function public.whatsapp_prejoin_event(p_code text, p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events;
begin
  if p_user is null or p_code is null or p_code !~ '^[A-Za-z0-9]{4,16}$' then return jsonb_build_object('status', 'not_found'); end if;
  if not exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled) then return jsonb_build_object('status', 'disabled'); end if;
  select * into e from public.events where code = upper(p_code) and deleted_at is null;
  if e.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if public.is_revealed(e.id) or e.host_id = p_user
     or exists (select 1 from public.participants where event_id = e.id and user_id = p_user and blocked_at is not null) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  return jsonb_build_object('status', 'ok', 'eventId', e.id);
end $$;

revoke all on function public.whatsapp_prejoin_event(text, uuid), public.whatsapp_issue_return_token(uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.whatsapp_prejoin_event(text, uuid), public.whatsapp_issue_return_token(uuid, uuid, text, int) to service_role;

-- o formulário de entrada só mostra o campo de WhatsApp com o recurso ligado (feature_flags é só da equipe; aqui sai só o booleano)
create function public.whatsapp_available() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled)
$$;
revoke all on function public.whatsapp_available() from public;
grant execute on function public.whatsapp_available() to anon, authenticated;
