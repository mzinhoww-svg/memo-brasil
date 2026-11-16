-- Revela 2.0 · Master · Configurações revisada (M31). ADITIVA (create function / create or replace; nenhuma tabela alterada).
--
-- * admin_config_overview(): tudo o que a tela mostra numa chamada só (só master, MM004): ambiente do pagamento (somente leitura), as chaves
--   validapay_checkout, validapay_card e printed_album, os parâmetros editáveis e o estado do webhook da ValidaPay (validapay_webhook_inbox, que o
--   cliente não lê direto).
-- * admin_set_setting: motivo de 10 a 500 caracteres (MM011; antes só o mínimo), `payments_env` NUNCA muda por aqui (somente leitura, MM005) e os
--   parâmetros do desenho são validados no servidor: validade do Pix inteira de 5 a 1.440 minutos, folga de capacidade de 0 a 100, e-mail com forma
--   válida, telefone/CNPJ/razão social com tamanho máximo. Chaves desconhecidas seguem aceitas como antes (limites.*).
-- * admin_set_feature_flag: motivo também limitado a 500.
-- * settings_audit: a auditoria passa a guardar valor antigo e novo das chaves e dos parâmetros PÚBLICOS da tela (os mesmos que get_public_settings
--   já entrega a qualquer visitante); os demais continuam só com o tamanho.
-- Erros: MM004 forbidden · MM005 invalid · MM011 motivo de 10 a 500.

create or replace function public.settings_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  why text := nullif(btrim(coalesce(current_setting('mm.audit_reason', true), '')), '');
  r record; oldj jsonb := null; newj jsonb; d jsonb;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  newj := to_jsonb(r);
  if tg_op = 'UPDATE' then oldj := to_jsonb(old); end if;
  if tg_table_name = 'feature_flags' then
    d := jsonb_build_object('enabled', newj -> 'enabled', 'rollout', newj -> 'rollout');
    if oldj is not null then d := d || jsonb_build_object('old', oldj -> 'enabled'); end if;
  else
    d := jsonb_build_object('value_bytes', octet_length(newj ->> 'value')); -- valor de configuração não vai para o log, salvo os públicos abaixo
    if newj ->> 'key' in ('validapay_pix_expiry_minutes', 'capacity_grace_pct', 'support_email', 'support_phone', 'company_legal_name', 'company_cnpj') then
      d := d || jsonb_build_object('new', newj -> 'value');
      if oldj is not null then d := d || jsonb_build_object('old', oldj -> 'value'); end if;
    end if;
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (auth.uid(), case when public.is_master() then 'master' else 'operador' end,
          tg_table_name || '.' || lower(tg_op), tg_table_name, r.key, left(why, 500), d);
  return r;
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text := btrim(coalesce(p_reason, '')); n numeric; s text;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(why) < 10 or char_length(why) > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_value is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_key = 'payments_env' then raise exception 'invalid' using errcode = 'MM005'; end if; -- ambiente do pagamento: definido na instalação, somente leitura
  if p_key in ('validapay_pix_expiry_minutes', 'capacity_grace_pct') then
    if jsonb_typeof(p_value) <> 'number' then raise exception 'invalid' using errcode = 'MM005'; end if;
    n := (p_value #>> '{}')::numeric;
    if n <> trunc(n) then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_key = 'validapay_pix_expiry_minutes' and (n < 5 or n > 1440) then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_key = 'capacity_grace_pct' and (n < 0 or n > 100) then raise exception 'invalid' using errcode = 'MM005'; end if;
  elsif p_key in ('support_email', 'support_phone', 'company_legal_name', 'company_cnpj') then
    if jsonb_typeof(p_value) <> 'string' then raise exception 'invalid' using errcode = 'MM005'; end if;
    s := btrim(p_value #>> '{}');
    if p_key = 'support_email' and s <> '' and (char_length(s) > 254 or s !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_key = 'support_phone' and char_length(s) > 40 then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_key = 'company_cnpj' and char_length(s) > 24 then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_key = 'company_legal_name' and char_length(s) > 120 then raise exception 'invalid' using errcode = 'MM005'; end if;
  end if;
  perform set_config('mm.audit_reason', why, true);
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
end $$;

create or replace function public.admin_set_feature_flag(p_key text, p_enabled boolean, p_rollout jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(why) < 10 or char_length(why) > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_enabled is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', why, true);
  insert into public.feature_flags (key, enabled, rollout, updated_by) values (p_key, p_enabled, coalesce(p_rollout, '{}'), auth.uid())
  on conflict (key) do update set enabled = excluded.enabled, rollout = excluded.rollout, updated_by = excluded.updated_by;
end $$;

create function public.admin_config_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare st jsonb; fl jsonb; wh jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) into st from public.platform_settings s
   where s.key in ('validapay_pix_expiry_minutes', 'capacity_grace_pct', 'support_email', 'support_phone', 'company_legal_name', 'company_cnpj');
  select jsonb_build_object(
           'validapay_checkout', coalesce(bool_or(f.enabled) filter (where f.key = 'validapay_checkout'), false),
           'validapay_card', coalesce(bool_or(f.enabled) filter (where f.key = 'validapay_card'), false),
           'printed_album', coalesce(bool_or(f.enabled) filter (where f.key = 'printed_album'), false)) into fl from public.feature_flags f;
  select jsonb_build_object('lastAt', max(i.received_at), 'pending', count(*) filter (where i.processed_at is null),
                            'failing', count(*) filter (where i.processed_at is null and i.attempts >= 3)) into wh from public.validapay_webhook_inbox i;
  return jsonb_build_object(
    'paymentsEnv', public.payments_env(),
    'flags', fl,
    'settings', jsonb_build_object(
      'pixMinutes', case when jsonb_typeof(st -> 'validapay_pix_expiry_minutes') = 'number' and (st ->> 'validapay_pix_expiry_minutes') ~ '^[0-9]+$'
                         then (st ->> 'validapay_pix_expiry_minutes')::int else 15 end,
      'supportEmail', nullif(btrim(coalesce(st ->> 'support_email', '')), ''),
      'supportPhone', nullif(btrim(coalesce(st ->> 'support_phone', '')), ''),
      'companyLegalName', nullif(btrim(coalesce(st ->> 'company_legal_name', '')), ''),
      'companyCnpj', nullif(btrim(coalesce(st ->> 'company_cnpj', '')), ''),
      'capacityGracePct', case when jsonb_typeof(st -> 'capacity_grace_pct') = 'number' then least(greatest((st ->> 'capacity_grace_pct')::numeric, 0), 100) else 0 end),
    'webhook', wh);
end $$;

revoke all on function public.admin_config_overview() from public, anon;
grant execute on function public.admin_config_overview() to authenticated;
