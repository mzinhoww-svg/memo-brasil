-- Revela 2.0 · 4/4 · e-mail opcional do convidado e aviso de revelação por e-mail (Brevo). ADITIVA.
-- O e-mail só é guardado com consentimento explícito e finalidade única (avisar que a festa revelou). Opt-out por token no próprio e-mail.
-- Os dados de e-mail ficam numa tabela à parte, sem nenhum GRANT para clientes: nem a RLS de participants, nem o Realtime,
-- nem um `select *` os expõem. Só as RPCs abaixo (security definer) leem e gravam.
create table public.participant_emails (
  event_id uuid not null,
  user_id uuid not null,
  email text check (email is null or (char_length(email) between 5 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  consent_at timestamptz,
  opt_out_at timestamptz,
  optout_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (event_id, user_id) references public.participants (event_id, user_id) on delete cascade,
  constraint participant_emails_consent check (email is null or consent_at is not null)
);
create unique index participant_emails_token_idx on public.participant_emails (optout_token);
alter table public.participant_emails enable row level security;
revoke all on public.participant_emails from public, anon, authenticated;

-- Fila idempotente: uma linha por evento e pessoa. O job de revelação insere; o envio marca sent_at uma única vez.
create table public.reveal_email_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  email text not null,
  optout_token uuid not null,
  event_title text not null,
  event_code text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text,
  unique (event_id, user_id)
);
alter table public.reveal_email_queue enable row level security;
revoke all on public.reveal_email_queue from public, anon, authenticated; -- só service_role e funções definer

-- Guardar / trocar o e-mail do convidado, com consentimento. p_email nulo remove. Só o próprio participante.
create function public.set_my_email(p_event uuid, p_email text, p_consent boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); em text := lower(btrim(coalesce(p_email, '')));
begin
  if uid is null or not exists (select 1 from public.participants where event_id = p_event and user_id = uid and blocked_at is null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  perform public.check_rate_limit('email:' || uid, 10, interval '1 hour');
  if em = '' then
    update public.participant_emails set email = null, consent_at = null where event_id = p_event and user_id = uid;
    return;
  end if;
  if p_consent is not true then raise exception 'consentrequired' using errcode = 'MM018'; end if;
  if char_length(em) > 254 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  insert into public.participant_emails (event_id, user_id, email, consent_at)
  values (p_event, uid, em, now())
  on conflict (event_id, user_id) do update set email = excluded.email, consent_at = now(), opt_out_at = null;
end $$;

-- O que o participante pode saber do próprio cadastro de e-mail (nunca o token).
create function public.get_my_email(p_event uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', p.email, 'consent', p.consent_at is not null, 'optedOut', p.opt_out_at is not null)
  from public.participant_emails p where p.event_id = p_event and p.user_id = auth.uid()
$$;

-- Sair da lista: pelo link do e-mail (sem login, por token) ou dentro do app.
create function public.email_opt_out(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate_limit('optout:' || coalesce(auth.uid()::text, 'anon'), 60, interval '1 hour');
  update public.participant_emails set opt_out_at = coalesce(opt_out_at, now()), email = null, consent_at = null
   where optout_token = p_token;
  return found;
end $$;
create function public.email_opt_out_mine(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.participant_emails set opt_out_at = coalesce(opt_out_at, now()), email = null, consent_at = null
   where event_id = p_event and user_id = auth.uid();
end $$;

-- Revelação: release_reveal (20261024000100) é o ponto único usado pelo job reveal_due_events e pelo "revelar agora" do Master.
-- Mantém o corpo vigente e, só quando a revelação acontece de fato, enfileira o aviso por e-mail para quem consentiu e não saiu
-- da lista. `unique (event_id, user_id)` garante uma linha por pessoa mesmo que a função rode de novo.
create or replace function public.release_reveal(p_event uuid, p_at timestamptz, p_source text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare ev public.events;
begin
  update public.events set revealed_at = p_at, reveal_status = 'revelada'
   where id = p_event and reveal_enabled and revealed_at is null and deleted_at is null
  returning * into ev;
  if not found then return false; end if;
  insert into public.audit_logs (actor_id, event_id, action, detail)
  values (null, p_event, 'reveal.released', jsonb_build_object('at', p_at, 'ran_at', now())
          || case when p_source is null then '{}'::jsonb else jsonb_build_object('source', p_source) end);
  insert into public.reveal_email_queue (event_id, user_id, email, optout_token, event_title, event_code)
    select pe.event_id, pe.user_id, pe.email, pe.optout_token, ev.title, ev.code
    from public.participant_emails pe join public.participants p on p.event_id = pe.event_id and p.user_id = pe.user_id
    where pe.event_id = p_event and pe.email is not null and pe.consent_at is not null and pe.opt_out_at is null and p.blocked_at is null
  on conflict (event_id, user_id) do nothing;
  return true;
end $$;

-- Envio (Edge Function reveal-emails, com service_role): reivindica um lote com trava, sem repetir quem já foi enviado.
create function public.claim_reveal_emails(p_limit int default 50) returns setof public.reveal_email_queue
language plpgsql security definer set search_path = '' as $$
begin
  return query
    update public.reveal_email_queue q set claimed_at = now(), attempts = q.attempts + 1
     where q.id in (
       select id from public.reveal_email_queue
        where sent_at is null and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '10 minutes')
          and exists (select 1 from public.participant_emails p where p.event_id = reveal_email_queue.event_id and p.user_id = reveal_email_queue.user_id
                       and p.opt_out_at is null and p.email is not null)
        order by created_at limit least(greatest(p_limit, 1), 200) for update skip locked)
    returning q.*;
end $$;
create function public.mark_reveal_email_sent(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.reveal_email_queue set sent_at = now(), last_error = null where id = p_id and sent_at is null;
  return found;
end $$;
create function public.mark_reveal_email_failed(p_id uuid, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.reveal_email_queue set last_error = left(coalesce(p_error, ''), 300), claimed_at = null where id = p_id and sent_at is null;
end $$;

-- Exclusão de conta apaga o e-mail junto com o participante (linha removida) e a fila da pessoa.
create or replace function public.process_account_deletion(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.photos set author_id = null, author_name = 'Participante removido' where author_id = p_user;
  update public.photo_comments set author_id = null, author_name = 'Participante removido' where author_id = p_user;
  delete from public.comment_likes where user_id = p_user;
  delete from public.comment_reports where user_id = p_user;
  delete from public.reveal_email_queue where user_id = p_user;
  delete from public.reactions where author_id = p_user;
  delete from public.participants where user_id = p_user;
  insert into public.storage_purge_queue (path)
    select storage_path from public.photos ph join public.events e on e.id = ph.event_id where e.host_id = p_user
  on conflict do nothing;
  update public.photos set deleted_at = now() where event_id in (select id from public.events where host_id = p_user) and deleted_at is null;
  update public.events set deleted_at = now() where host_id = p_user and deleted_at is null;
  update public.profiles set display_name = '' where id = p_user;
  update public.account_deletion_requests set processed_at = now() where user_id = p_user;
  insert into public.audit_logs (actor_id, event_id, action, detail) values (null, null, 'account.deleted', jsonb_build_object('user', p_user));
end $$;

revoke all on function public.set_my_email(uuid, text, boolean), public.get_my_email(uuid), public.email_opt_out(uuid), public.email_opt_out_mine(uuid),
  public.claim_reveal_emails(int), public.mark_reveal_email_sent(uuid), public.mark_reveal_email_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.set_my_email(uuid, text, boolean), public.get_my_email(uuid), public.email_opt_out_mine(uuid) to authenticated;
grant execute on function public.email_opt_out(uuid) to anon, authenticated; -- link de descadastro do e-mail (token imprevisível)
grant execute on function public.claim_reveal_emails(int), public.mark_reveal_email_sent(uuid), public.mark_reveal_email_failed(uuid, text) to service_role;
