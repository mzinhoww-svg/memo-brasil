-- Avisos por WhatsApp · link de volta que funciona sem sessão prévia (base do futuro login por WhatsApp). ADITIVA.
--
-- O bot responde com /e/<código>/voltar?r=<token>. O link costuma abrir no navegador do WhatsApp ou num navegador diferente do usado na
-- entrada, sem a sessão do convidado. O token troca isso por uma sessão do MESMO convidado.
--   * Token: 32 bytes aleatórios (base64url) gerados na Edge Function whatsapp-optin; aqui só o SHA-256 (o valor nunca vai ao banco
--     nem a log). Uso único, expira em 2 h, preso a (evento, convidado). Participante bloqueado ou removido não troca.
--   * A troca (Edge Function whatsapp-return) usa a API admin do Auth para emitir um link mágico ao mesmo usuário e, se ele era anônimo,
--     devolve a marcação de anônimo (whatsapp_restore_anonymous): a pessoa continua convidada, sem virar conta.
--   * participant_whatsapp entra na publicação do Realtime: a tela vira "Ativado ✓" assim que o webhook grava (RLS: só a própria linha).

create table public.whatsapp_return_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  event_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  foreign key (event_id, user_id) references public.participants (event_id, user_id) on delete cascade
);
create index whatsapp_return_tokens_expiry_idx on public.whatsapp_return_tokens (expires_at);
alter table public.whatsapp_return_tokens enable row level security;
revoke all on public.whatsapp_return_tokens from anon, authenticated;

create function public.whatsapp_issue_return_token(p_event uuid, p_user uuid, p_hash text, p_ttl_minutes int default 120) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_ttl_minutes is null or p_ttl_minutes not between 5 and 1440 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if not exists (select 1 from public.participants where event_id = p_event and user_id = p_user and blocked_at is null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  delete from public.whatsapp_return_tokens where expires_at < now() - interval '1 day'; -- limpeza oportunista
  insert into public.whatsapp_return_tokens (token_hash, event_id, user_id, expires_at)
  values (p_hash, p_event, p_user, now() + make_interval(mins => p_ttl_minutes));
end $$;

-- troca: {status: ok|used|expired|invalid|blocked, userId?, code?, title?}. "ok" marca o token como usado na mesma transação.
create function public.whatsapp_consume_return_token(p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.whatsapp_return_tokens; e public.events; blocked timestamptz; found_participant boolean;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'invalid'); end if;
  select * into t from public.whatsapp_return_tokens where token_hash = p_hash for update;
  if t.token_hash is null then return jsonb_build_object('status', 'invalid'); end if;
  select * into e from public.events where id = t.event_id and deleted_at is null;
  if e.id is null then return jsonb_build_object('status', 'invalid'); end if;
  if t.used_at is not null then return jsonb_build_object('status', 'used', 'code', e.code, 'title', e.title); end if;
  if t.expires_at < now() then return jsonb_build_object('status', 'expired', 'code', e.code, 'title', e.title); end if;
  select true, p.blocked_at into found_participant, blocked from public.participants p where p.event_id = t.event_id and p.user_id = t.user_id;
  if not coalesce(found_participant, false) or blocked is not null then
    return jsonb_build_object('status', 'blocked', 'code', e.code, 'title', e.title);
  end if;
  update public.whatsapp_return_tokens set used_at = now() where token_hash = p_hash;
  insert into public.audit_logs (actor_id, event_id, action, detail) values (null, t.event_id, 'whatsapp.return', jsonb_build_object('user', t.user_id));
  return jsonb_build_object('status', 'ok', 'userId', t.user_id, 'code', e.code, 'title', e.title);
end $$;

-- a API admin do Auth tira a marcação de anônimo ao gravar o e-mail técnico do link mágico; aqui ela volta. Só para o e-mail técnico
-- (wa-<id>@retorno.invalid): nunca promove nem rebaixa conta de verdade.
create function public.whatsapp_restore_anonymous(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update auth.users set is_anonymous = true where id = p_user and email = 'wa-' || p_user::text || '@retorno.invalid';
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.whatsapp_issue_return_token(uuid, uuid, text, int), public.whatsapp_consume_return_token(text),
  public.whatsapp_restore_anonymous(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_issue_return_token(uuid, uuid, text, int), public.whatsapp_consume_return_token(text),
  public.whatsapp_restore_anonymous(uuid) to service_role;

-- Realtime: "Ativado ✓" sem esperar o próximo polling (a política participant_whatsapp_own_select limita à própria linha)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participant_whatsapp') then
    alter publication supabase_realtime add table public.participant_whatsapp;
  end if;
end $$;
