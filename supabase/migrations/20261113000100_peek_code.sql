-- Link de presente: a página /c/<código> mostra o plano do código ANTES de criar o evento.
-- Leitura pura: não consome uso, não grava nada e não revela nota nem contagem de usos.
-- {status, planCode, planName, maxGuests, maxShots, expiresAt}; status ∈ ativo | usado | expirado | revogado | invalido.
create function public.peek_code(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.courtesy_codes;
  pl public.plans;
begin
  select * into c from public.courtesy_codes where code_hash = public.courtesy_code_hash(p_code);
  if not found then return jsonb_build_object('status', 'invalido'); end if;
  select * into pl from public.plans where code = c.plan_code;
  return jsonb_build_object(
    'status', case when c.revoked_at is not null then 'revogado'
                   when c.uses >= c.max_uses then 'usado'
                   when c.expires_at <= now() then 'expirado'
                   else 'ativo' end,
    'planCode', c.plan_code, 'planName', pl.name, 'maxGuests', pl.max_guests, 'maxShots', pl.max_shots,
    'expiresAt', c.expires_at);
end $$;

revoke execute on function public.peek_code(text) from public, anon, authenticated, service_role;
grant execute on function public.peek_code(text) to anon, authenticated;
