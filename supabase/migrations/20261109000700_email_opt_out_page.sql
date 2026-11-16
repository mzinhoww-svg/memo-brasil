-- Revela 2.0 · 24j · página pública /email/sair. ADITIVA (não altera email_opt_out nem as demais RPCs).
-- A página recebe só o token do link do e-mail. Como email_opt_out apaga o e-mail, a página precisa ler o evento e o e-mail
-- ANTES de sair da lista (para dizer "bia@... não recebe mais avisos de Ana & Leo") e, se a pessoa se arrepender,
-- reativar pelo mesmo token. O token é um UUID aleatório que só existe no e-mail enviado à própria pessoa.

-- O que a página precisa mostrar: título e código do evento, o e-mail e se já saiu. Nulo = token inexistente.
create function public.email_opt_out_preview(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  perform public.check_rate_limit('optoutview:' || coalesce(auth.uid()::text, 'anon'), 300, interval '1 hour');
  select pe.email, pe.opt_out_at, e.title, e.code into r
    from public.participant_emails pe join public.events e on e.id = pe.event_id
   where pe.optout_token = p_token and e.deleted_at is null;
  if not found then return null; end if;
  return jsonb_build_object('title', r.title, 'code', r.code, 'email', r.email, 'optedOut', r.opt_out_at is not null);
end $$;

-- "Voltar a receber": só vale para quem já saiu pelo token; grava o e-mail de volta com consentimento novo.
create function public.email_resubscribe(p_token uuid, p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare em text := lower(btrim(coalesce(p_email, '')));
begin
  perform public.check_rate_limit('optin:' || coalesce(auth.uid()::text, 'anon'), 60, interval '1 hour');
  if char_length(em) > 254 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.participant_emails set email = em, consent_at = now(), opt_out_at = null
   where optout_token = p_token and opt_out_at is not null;
  return found;
end $$;

revoke all on function public.email_opt_out_preview(uuid), public.email_resubscribe(uuid, text) from public, anon, authenticated;
grant execute on function public.email_opt_out_preview(uuid), public.email_resubscribe(uuid, text) to anon, authenticated; -- link do e-mail (token imprevisível)
